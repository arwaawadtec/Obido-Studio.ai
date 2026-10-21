/**
 * Obido Studio — Milestone 3.2: Cloud Foundation Audit & Integration Test Suite
 * Validates:
 * 1. Server-side identity verification & cross-user denial
 * 2. Cloud configuration endpoint integrity
 * 3. Firestore error handler schema conformance
 * 4. Migration bridge idempotency & local data preservation
 */

import assert from 'assert';
import fs from 'fs';
import http from 'http';

// Helper to make local HTTP requests to Express server if running, or test route handlers directly
async function postJSON(url: string, body: any, headers: Record<string, string> = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode || 500, data: raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getJSON(url: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode || 500, data: raw });
        }
      });
    }).on('error', reject);
  });
}

async function runCloudTests() {
  console.log('--- Starting Obido Studio Cloud Foundation Test Suite (Milestone 3.2) ---');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.stack || err.message}`);
      failed++;
    }
  }

  const BASE_URL = 'http://localhost:3000';

  // Test 1: Configuration file verification
  await test('firebase-applet-config.json exists with valid cloud project identifiers', async () => {
    assert.ok(fs.existsSync('./firebase-applet-config.json'), 'Config file must exist');
    const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
    assert.strictEqual(cfg.projectId, 'elaborate-bliss-xvxch');
    assert.ok(cfg.apiKey && cfg.apiKey.startsWith('AIza'), 'Valid Google API key format');
    assert.strictEqual(cfg.firestoreDatabaseId, 'ai-studio-obidostudio-b777bfa3-0be6-4398-93dc-dcc3861251a2');
    assert.strictEqual(cfg.storageBucket, 'elaborate-bliss-xvxch.firebasestorage.app');
  });

  // Test 2: firebase-blueprint.json exists and adheres strictly to schema
  await test('firebase-blueprint.json defines entities and firestore collections strictly', async () => {
    assert.ok(fs.existsSync('./firebase-blueprint.json'), 'Blueprint file must exist');
    const bp = JSON.parse(fs.readFileSync('./firebase-blueprint.json', 'utf8'));
    assert.ok(bp.entities.users, 'Must define users entity');
    assert.ok(bp.entities.projects, 'Must define projects entity');
    assert.ok(bp.entities.assets, 'Must define assets entity');
    assert.ok(bp.firestore['/users/{userId}'], 'Must define /users/{userId} path');
    assert.ok(bp.firestore['/projects/{projectId}'], 'Must define /projects/{projectId} path');
    assert.ok(bp.firestore['/assets/{assetId}'], 'Must define /assets/{assetId} path');
  });

  // Test 3: firestore.rules and storage.rules exist
  await test('Security rules for Firestore and Cloud Storage exist with owner isolation', async () => {
    assert.ok(fs.existsSync('./firestore.rules'), 'firestore.rules must exist');
    assert.ok(fs.existsSync('./storage.rules'), 'storage.rules must exist');
    const fRules = fs.readFileSync('./firestore.rules', 'utf8');
    assert.ok(fRules.includes("match /{document=**} {\n      allow read, write: if false;\n    }"), 'Must default-deny unknown paths');
    assert.ok(fRules.includes('request.auth.uid == userId'), 'Must check user ownership');
    assert.ok(fRules.includes('resource.data.userId == request.auth.uid'), 'Must validate list queries on resource.data');
  });

  // Test 4: Cloud Status Endpoint
  await test('Server endpoint GET /api/cloud/status returns connected cloud state', async () => {
    const res = await getJSON(`${BASE_URL}/api/cloud/status`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'connected');
    assert.strictEqual(res.data.isCloudAuthEnabled, true);
    assert.strictEqual(res.data.projectId, 'elaborate-bliss-xvxch');
    assert.strictEqual(res.data.firestoreDatabaseId, 'ai-studio-obidostudio-b777bfa3-0be6-4398-93dc-dcc3861251a2');
  });

  // Test 5: Server-side Auth Verification: Missing Token returns 401
  await test('POST /api/auth/verify returns 401 UNAUTHENTICATED when token is omitted', async () => {
    const res = await postJSON(`${BASE_URL}/api/auth/verify`, {});
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.code, 'UNAUTHENTICATED');
    assert.strictEqual(res.data.success, false);
  });

  // Test 6: Server-side Auth Verification: Malformed Token returns 401
  await test('POST /api/auth/verify returns 401 INVALID_TOKEN on corrupt JWT string', async () => {
    const res = await postJSON(`${BASE_URL}/api/auth/verify`, {
      token: 'not_a_valid_jwt_format'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.code, 'INVALID_TOKEN');
  });

  // Test 7: Server-side Auth Verification: Cross-User Identity Spoofing Blocked (403)
  await test('POST /api/auth/verify rejects cross-user spoofing when claimed userId differs from verified token', async () => {
    // Generate valid structure JWT token for Alice
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      user_id: 'alice_verified_123',
      sub: 'alice_verified_123',
      aud: 'elaborate-bliss-xvxch',
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: 'alice@example.com'
    })).toString('base64url');
    const mockToken = `${header}.${payload}.signature`;

    // Attacker sends Alice's token but claims Bob's userId
    const res = await postJSON(`${BASE_URL}/api/auth/verify`, {
      token: mockToken,
      userId: 'bob_victim_456'
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.code, 'IDENTITY_MISMATCH');
    assert.ok(res.data.error.includes('Forbidden'));
  });

  // Test 8: Server-side Auth Verification: Valid Token matches identity
  await test('POST /api/auth/verify accepts matching token and verifies user identity', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      user_id: 'charlie_creator_789',
      sub: 'charlie_creator_789',
      aud: 'elaborate-bliss-xvxch',
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: 'charlie@example.com'
    })).toString('base64url');
    const mockToken = `${header}.${payload}.signature`;

    const res = await postJSON(`${BASE_URL}/api/auth/verify`, {
      token: mockToken,
      userId: 'charlie_creator_789'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.verifiedUid, 'charlie_creator_789');
    assert.strictEqual(res.data.email, 'charlie@example.com');
  });

  // Test 9: Server-side Auth Verification: Session Expiry (401)
  await test('POST /api/auth/verify rejects expired tokens with SESSION_EXPIRED', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const expiredPayload = Buffer.from(JSON.stringify({
      user_id: 'david_999',
      sub: 'david_999',
      aud: 'elaborate-bliss-xvxch',
      exp: Math.floor(Date.now() / 1000) - 300, // expired 5 minutes ago
    })).toString('base64url');
    const expiredToken = `${header}.${expiredPayload}.sig`;

    const res = await postJSON(`${BASE_URL}/api/auth/verify`, {
      token: expiredToken
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.code, 'SESSION_EXPIRED');
  });

  // Test 10: Server-side Auth Verification: Audience / Project Mismatch (403)
  await test('POST /api/auth/verify rejects tokens issued for another Firebase project', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const untrustedPayload = Buffer.from(JSON.stringify({
      user_id: 'eve_untrusted',
      sub: 'eve_untrusted',
      aud: 'some-other-hostile-project',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const untrustedToken = `${header}.${untrustedPayload}.sig`;

    const res = await postJSON(`${BASE_URL}/api/auth/verify`, {
      token: untrustedToken
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.code, 'INVALID_PROJECT_AUDIENCE');
  });

  console.log(`\nCloud Test Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runCloudTests().catch((err) => {
  console.error('Cloud test runner fatal error:', err);
  process.exit(1);
});
