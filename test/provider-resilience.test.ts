/**
 * Obido Studio — AI Provider Resilience & Normalization Test Suite
 * Validates bounded exponential backoff with jitter, retryable vs non-retryable status codes,
 * timeout boundaries, deduplication, sensitive credential sanitization, and output validation.
 */

import assert from 'assert';
import { executeWithRetry, normalizeAIError, sanitizeErrorMessage } from '../server/resilience/retry';
import { GeminiProviderAdapter } from '../server/providers/geminiAdapter';
import { AIProviderAdapter } from '../server/providers/types';

async function runTestSuite() {
  console.log('--- Starting Obido Studio AI Provider Resilience Test Suite ---');
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

  // Test 1: Error Normalization for Missing Credentials
  await test('Missing credentials returns UNAUTHENTICATED (401) and non-retryable', async () => {
    const unconfigured = new GeminiProviderAdapter('');
    assert.strictEqual(unconfigured.isAvailable(), false);

    try {
      await unconfigured.generateScript({ title: 'Test' });
      assert.fail('Should have thrown unauthenticated error');
    } catch (err: any) {
      assert.strictEqual(err.code, 'UNAUTHENTICATED');
      assert.strictEqual(err.retryable, false);
      assert.strictEqual(err.statusCode, 401);
    }
  });

  // Test 2: Error Normalization for 429 Rate Limiting
  await test('429 Rate Limit error normalizes to RATE_LIMITED (429) and retryable', async () => {
    const raw429 = new Error('Resource has been exhausted (e.g. check quota) 429');
    (raw429 as any).status = 429;

    const normalized = normalizeAIError(raw429, 'gemini');
    assert.strictEqual(normalized.code, 'RATE_LIMITED');
    assert.strictEqual(normalized.retryable, true);
    assert.strictEqual(normalized.statusCode, 429);
  });

  // Test 3: Error Normalization for 503 Service Unavailable
  await test('503 Service Unavailable normalizes to SERVICE_UNAVAILABLE (503) and retryable', async () => {
    const raw503 = new Error('The model is overloaded. Please try again later. 503');
    (raw503 as any).status = 503;

    const normalized = normalizeAIError(raw503, 'gemini');
    assert.strictEqual(normalized.code, 'SERVICE_UNAVAILABLE');
    assert.strictEqual(normalized.retryable, true);
    assert.strictEqual(normalized.statusCode, 503);
  });

  // Test 4: Bounded Exponential Backoff + Jitter on 429 (Transient Failure Recovery)
  await test('429 Rate limit recovers on retry with bounded exponential backoff', async () => {
    let callCount = 0;
    const task = async () => {
      callCount++;
      if (callCount === 1) {
        const err: any = new Error('429 RESOURCE_EXHAUSTED: Rate limit exceeded');
        err.status = 429;
        throw err;
      }
      return { success: true, attempts: callCount };
    };

    const startTime = Date.now();
    const result = await executeWithRetry(task, {
      maxRetries: 2,
      initialDelayMs: 60,
      maxDelayMs: 250,
      backoffFactor: 2,
    });
    const duration = Date.now() - startTime;

    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attempts, 2);
    // Verified backoff delay was introduced
    assert.ok(duration >= 25, `Expected delay >= 25ms, got ${duration}ms`);
  });

  // Test 5: Bounded Exponential Backoff on 503 (Transient Failure Recovery)
  await test('503 Service Unavailable recovers on retry', async () => {
    let callCount = 0;
    const task = async () => {
      callCount++;
      if (callCount < 3) {
        const err: any = new Error('503 UNAVAILABLE: Model server is warm starting');
        err.status = 503;
        throw err;
      }
      return 'recovered';
    };

    const result = await executeWithRetry(task, {
      maxRetries: 3,
      initialDelayMs: 40,
      maxDelayMs: 200,
    });

    assert.strictEqual(callCount, 3);
    assert.strictEqual(result, 'recovered');
  });

  // Test 6: Strict Request Timeout
  await test('Enforces strict request timeout boundary', async () => {
    const slowTask = async () => {
      await new Promise((res) => setTimeout(res, 200));
      return 'late_data';
    };

    try {
      await executeWithRetry(slowTask, {
        timeoutMs: 50,
        maxRetries: 0,
      });
      assert.fail('Expected timeout error');
    } catch (err: any) {
      assert.strictEqual(err.code, 'TIMEOUT');
      assert.strictEqual(err.statusCode, 504);
      assert.strictEqual(err.retryable, true);
    }
  });

  // Test 7: Exhausted Retries Boundary
  await test('Exhausts retries and returns final normalized error after maxRetries', async () => {
    let callCount = 0;
    const persistentFailure = async () => {
      callCount++;
      const err: any = new Error('503 Service Unavailable persistent issue');
      err.status = 503;
      throw err;
    };

    try {
      await executeWithRetry(persistentFailure, {
        maxRetries: 2,
        initialDelayMs: 30,
        maxDelayMs: 100,
      });
      assert.fail('Expected exhausted retries error');
    } catch (err: any) {
      // 1 initial attempt + 2 retries = 3 total invocations
      assert.strictEqual(callCount, 3);
      assert.strictEqual(err.code, 'SERVICE_UNAVAILABLE');
      assert.strictEqual(err.statusCode, 503);
    }
  });

  // Test 8: Non-Idempotent Concurrent Request Deduplication
  await test('Deduplicates concurrent in-flight requests with identical deduplicationKey', async () => {
    let underlyingExecutions = 0;
    const task = async () => {
      underlyingExecutions++;
      await new Promise((res) => setTimeout(res, 80));
      return { executionId: underlyingExecutions, timestamp: Date.now() };
    };

    const deduplicationKey = 'dedup_test_hash_123';

    // Fire 3 simultaneous invocations with the same key
    const [p1, p2, p3] = await Promise.all([
      executeWithRetry(task, { deduplicationKey }),
      executeWithRetry(task, { deduplicationKey }),
      executeWithRetry(task, { deduplicationKey }),
    ]);

    assert.strictEqual(underlyingExecutions, 1, 'Expected only 1 execution to occur due to deduplication');
    assert.deepStrictEqual(p1, p2);
    assert.deepStrictEqual(p2, p3);
  });

  // Test 9: Key & Path Sanitization (Zero Secret Exposure)
  await test('Sanitizes API keys, authorization tokens, and server paths from error output', async () => {
    const rawErrorWithSecret = 'Error in /Users/dev/obido/server.ts: AIzaSyD9x8y7z6w5v4u3t2s1r0q_google_key failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret';
    const sanitized = sanitizeErrorMessage(rawErrorWithSecret);

    assert.ok(!sanitized.includes('AIzaSyD9x8y7z6w5v4u3t2s1r0q_google_key'), 'API key must be redacted');
    assert.ok(!sanitized.includes('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret'), 'Bearer token must be redacted');
    assert.ok(!sanitized.includes('/Users/dev/obido/server.ts'), 'Server path must be redacted');
    assert.ok(sanitized.includes('[REDACTED_API_KEY]'));
    assert.ok(sanitized.includes('[INTERNAL_PATH]'));
  });

  // Test 10: Invalid Model Output Handling
  await test('Normalizes corrupted JSON output into INVALID_RESPONSE (502)', async () => {
    const parseError = new SyntaxError('Unexpected token < in JSON at position 0');
    const normalized = normalizeAIError(parseError, 'gemini');

    assert.strictEqual(normalized.code, 'INVALID_RESPONSE');
    assert.strictEqual(normalized.statusCode, 502);
    assert.strictEqual(normalized.retryable, false);
  });

  // Test 11: Real Provider Verification if GEMINI_API_KEY is present
  if (process.env.GEMINI_API_KEY) {
    await test('Real Gemini Provider executes structured script generation or cleanly normalizes upstream demand', async () => {
      const adapter = new GeminiProviderAdapter();
      assert.strictEqual(adapter.isAvailable(), true);

      try {
        const result = await adapter.generateScript({
          title: 'Quantum Telemetry',
          purpose: 'explainer',
          language: 'English',
          targetDurationSeconds: 15,
          visualStyle: 'cinematic_photorealistic',
          rawIdea: 'Automated telemetry for microservices',
        });

        assert.ok(result.title, 'Should have title');
        assert.ok(result.fullText, 'Should have fullText');
        assert.ok(typeof result.estimatedDurationSeconds === 'number', 'Should have estimatedDurationSeconds');
        console.log(`    Generated: "${result.title}" (~${result.estimatedDurationSeconds}s)`);
      } catch (err: any) {
        // If upstream Google server is temporarily overloaded under high demand,
        // verify that the resilience adapter caught and normalized it without crashing or exposing secrets
        assert.ok(err.code === 'SERVICE_UNAVAILABLE' || err.code === 'RATE_LIMITED', `Unexpected error code: ${err.code}`);
        assert.strictEqual(err.retryable, true);
        assert.ok(!err.message.includes('AIza'), 'No secrets should be in error message');
        console.log(`    Upstream transient status caught and normalized: ${err.code} (retryable: ${err.retryable})`);
      }
    });
  }

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
