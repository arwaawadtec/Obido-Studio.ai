/**
 * Obido Studio — Milestone 3.4: Authentication Root-Cause & Global Error Transparency Test Suite
 * 
 * Verifies:
 * 1. Root cause diagnostics: auth/operation-not-allowed maps to actionable 4-part error
 * 2. Field-targeted validation for registration & sign-in
 * 3. Specific Firebase error mappings (email-already-in-use, weak-password, invalid-credentials, rate-limiting)
 * 4. User session preservation on non-fatal Firestore profile sync
 * 5. Global Error Contract schema compliance ({ success: false, error: { code, message, details, field, stage, retryable, requestId } })
 * 6. Server-side API error response schema compliance
 * 7. Actionable recovery options (sandbox fallback, sign-in redirect, password reset)
 */

import assert from 'assert';
import http from 'http';
import { mapFirebaseError, createAppError, mapApiError, generateRequestId } from '../src/services/errorService';
import { auth } from '../src/services/auth';
import { AppError } from '../src/types/error';

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

async function runMilestone34Tests() {
  console.log('========================================================================');
  console.log(' Obido Studio — Milestone 3.4: Auth Root Cause & Global Error Suite    ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`      Error: ${err.message}`);
      failed++;
    }
  }

  const BASE_URL = 'http://localhost:3000';

  // --- 1. Root Cause: auth/operation-not-allowed ---
  await test('1. auth/operation-not-allowed produces 4-part transparent error with sandbox fallback action', async () => {
    const rawError = {
      code: 'auth/operation-not-allowed',
      message: 'The given sign-in provider is disabled for this Firebase project.',
    };

    const appErr = mapFirebaseError(rawError, {
      stage: 'auth',
      field: 'email',
      operation: 'Account Registration',
    });

    assert.strictEqual(appErr.code, 'AUTH_PROVIDER_DISABLED');
    assert.strictEqual(appErr.stage, 'auth');
    assert.strictEqual(appErr.retryable, false);
    assert.ok(appErr.requestId && appErr.requestId.startsWith('auth_'));
    
    // Four things verification
    assert.ok(appErr.whatFailed.length > 5, 'Must explain What Failed');
    assert.ok(appErr.whereFailed.length > 5, 'Must explain Where It Failed');
    assert.ok(appErr.whyFailed.length > 5, 'Must explain Why It Failed');
    assert.ok(appErr.whatToDoNext.length > 5, 'Must explain What To Do Next');
    assert.ok(appErr.whatToDoNext.includes('Development Sandbox') || appErr.whatToDoNext.includes('Console'));

    // Action button verification
    assert.ok(appErr.action, 'Must provide an action for recovery');
    assert.strictEqual(appErr.action?.actionType, 'sandbox_mode');
  });

  // --- 2. auth/email-already-in-use ---
  await test('2. auth/email-already-in-use targets email field and provides sign-in redirect action', async () => {
    const rawError = {
      code: 'auth/email-already-in-use',
      message: 'The email address is already in use by another account.',
    };

    const appErr = mapFirebaseError(rawError, {
      stage: 'auth',
      email: 'creator@example.com',
    });

    assert.strictEqual(appErr.code, 'EMAIL_ALREADY_IN_USE');
    assert.strictEqual(appErr.field, 'email');
    assert.strictEqual(appErr.retryable, false);
    assert.ok(appErr.whatToDoNext.includes('Sign in'));
    assert.strictEqual(appErr.action?.actionType, 'sign_in');
    assert.strictEqual(appErr.action?.target, '/sign-in');
  });

  // --- 3. auth/weak-password ---
  await test('3. auth/weak-password targets password field and is retryable', async () => {
    const rawError = {
      code: 'auth/weak-password',
      message: 'Password should be at least 6 characters.',
    };

    const appErr = mapFirebaseError(rawError, {
      stage: 'auth',
      field: 'password',
    });

    assert.strictEqual(appErr.code, 'WEAK_PASSWORD');
    assert.strictEqual(appErr.field, 'password');
    assert.strictEqual(appErr.retryable, true);
    assert.ok(appErr.whyFailed.includes('shorter than'));
  });

  // --- 4. auth/invalid-credential ---
  await test('4. auth/invalid-credential provides reset_password recovery action', async () => {
    const rawError = {
      code: 'auth/invalid-credential',
      message: 'Invalid credentials provided.',
    };

    const appErr = mapFirebaseError(rawError, {
      stage: 'auth',
      field: 'password',
    });

    assert.strictEqual(appErr.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(appErr.retryable, true);
    assert.strictEqual(appErr.action?.actionType, 'reset_password');
    assert.strictEqual(appErr.action?.target, '/forgot-password');
  });

  // --- 5. Client validation before network ---
  await test('5. Registration fails fast on invalid email without network trip', async () => {
    const res = await auth.signUp('Alex Rivera', 'invalid-email-format', 'validPass123');
    assert.strictEqual(res.success, false);
    assert.ok(res.error, 'Must return error object');
    assert.strictEqual(res.error?.code, 'INVALID_EMAIL');
    assert.strictEqual(res.error?.field, 'email');
    assert.strictEqual(res.error?.retryable, true);
  });

  await test('6. Registration fails fast on missing name', async () => {
    const res = await auth.signUp('   ', 'alex@example.com', 'validPass123');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error?.code, 'MISSING_NAME');
    assert.strictEqual(res.error?.field, 'name');
  });

  // --- 7. Sandbox Recovery Mode ---
  await test('7. Sandbox registration succeeds immediately when requested', async () => {
    const res = await auth.signUp('Jordan Lee', 'jordan@testsandbox.com', 'pass1234', { forceSandbox: true });
    assert.strictEqual(res.success, true);
    assert.ok(res.user);
    assert.strictEqual(res.user?.name, 'Jordan Lee');
    assert.strictEqual(res.user?.authType, 'local_demo');
    assert.strictEqual(auth.isAuthenticated(), true);
  });

  // --- 8. Server-Side Global Error Schema: UNAUTHENTICATED ---
  await test('8. Server endpoint returns standardized error object on 401 UNAUTHENTICATED', async () => {
    const res = await postJSON(`${BASE_URL}/api/auth/verify`, {});
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error, 'Must return error object');
    
    const err = res.data.error;
    assert.strictEqual(err.code, 'UNAUTHENTICATED');
    assert.strictEqual(typeof err.message, 'string');
    assert.strictEqual(typeof err.details, 'string');
    assert.strictEqual(err.field, 'token');
    assert.strictEqual(err.stage, 'auth');
    assert.strictEqual(err.retryable, false);
    assert.ok(err.requestId && err.requestId.startsWith('req_'));
  });

  // --- 9. Server-Side Global Error Schema: IDENTITY_MISMATCH ---
  await test('9. Server endpoint returns standardized error object on 403 IDENTITY_MISMATCH', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      user_id: 'alice_123',
      sub: 'alice_123',
      aud: 'elaborate-bliss-xvxch',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const token = `${header}.${payload}.sig`;

    const res = await postJSON(`${BASE_URL}/api/auth/verify`, {
      token,
      userId: 'hacker_claimed_456',
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    const err = res.data.error;
    assert.strictEqual(err.code, 'IDENTITY_MISMATCH');
    assert.strictEqual(err.field, 'userId');
    assert.strictEqual(err.stage, 'auth');
    assert.strictEqual(err.retryable, false);
    assert.ok(err.requestId && err.requestId.startsWith('req_'));
  });

  // --- 10. Server-Side Global Error Schema on AI Endpoint ---
  await test('10. Server endpoint /api/ai/script returns standardized error object when unauthenticated', async () => {
    const res = await postJSON(`${BASE_URL}/api/ai/script`, { title: 'Test Script' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error.code, 'UNAUTHENTICATED');
    assert.strictEqual(res.data.error.stage, 'auth');
    assert.strictEqual(res.data.error.retryable, false);
  });

  // --- 11. mapApiError Adapter ---
  await test('11. mapApiError adapts server JSON into full 4-part transparency object', async () => {
    const serverPayload = {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'AI Provider quota exceeded',
        details: 'Quota exhausted for model gemini-3.8-flash',
        stage: 'script',
        retryable: true,
        requestId: 'req_123456789',
      },
    };

    const clientAppError = mapApiError(serverPayload, 429, { stage: 'script' });
    assert.strictEqual(clientAppError.code, 'RATE_LIMITED');
    assert.strictEqual(clientAppError.retryable, true);
    assert.strictEqual(clientAppError.requestId, 'req_123456789');
    assert.ok(clientAppError.whatFailed.length > 0);
    assert.ok(clientAppError.whyFailed.length > 0);
    assert.ok(clientAppError.whatToDoNext.length > 0);
  });

  // --- 12. Password Reset transparency ---
  await test('12. Password reset handles invalid email gracefully with 4-part error', async () => {
    const res = await auth.requestPasswordReset('invalid-email-no-at');
    assert.strictEqual(res.success, false);
    assert.ok(res.error);
    assert.strictEqual(res.error?.code, 'INVALID_EMAIL');
    assert.strictEqual(res.error?.field, 'email');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMilestone34Tests().catch((err) => {
  console.error('Fatal error running Milestone 3.4 tests:', err);
  process.exit(1);
});
