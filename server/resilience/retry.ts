/**
 * Obido Studio — AI Resilience Engine
 * Bounded exponential backoff with jitter, strict timeouts, error normalization,
 * and safe in-flight deduplication.
 */

import { NormalizedAIError, AIErrorCode } from '../providers/types';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  timeoutMs?: number;
  deduplicationKey?: string;
  providerName?: string;
}

// In-flight request deduplication map for concurrent non-idempotent operations
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Strips sensitive API keys, auth headers, and filesystem paths from error messages
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return 'An unexpected error occurred';

  let sanitized = message;

  // Mask Google AI / standard API keys
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{10,}/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/key=[0-9A-Za-z-_]{10,}/gi, 'key=[REDACTED]');
  sanitized = sanitized.replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]');
  sanitized = sanitized.replace(/([a-zA-Z0-9_\-]{32,})/g, (match) => {
    // If it looks like a 32+ hex/base64 key, mask it
    if (/^[0-9a-fA-F]{32,}$/.test(match) || /^[A-Za-z0-9_-]{40,}$/.test(match)) {
      return '[REDACTED_TOKEN]';
    }
    return match;
  });

  // Mask absolute system paths
  sanitized = sanitized.replace(/\/[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)+/g, '[INTERNAL_PATH]');

  // Remove stack trace markers
  sanitized = sanitized.replace(/at\s+.*\(.*:\d+:\d+\)/g, '');

  return sanitized.trim();
}

/**
 * Extracts retry delay in seconds from response headers, Google API error structures, or message text
 */
export function extractRetryDelay(error: any, rawMsg: string): number | undefined {
  // 1. From response headers (Retry-After)
  const headerVal =
    error?.response?.headers?.get?.('retry-after') ||
    error?.response?.headers?.['retry-after'] ||
    error?.headers?.['retry-after'] ||
    error?.retryAfter;

  if (headerVal !== undefined && headerVal !== null) {
    const parsed = parseInt(String(headerVal), 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }

  // 2. From statusDetails or retryDelay in Google API error format
  if (error?.statusDetails && Array.isArray(error.statusDetails)) {
    for (const detail of error.statusDetails) {
      if (detail?.retryDelay) {
        const sec = parseInt(String(detail.retryDelay).replace('s', ''), 10);
        if (!isNaN(sec) && sec >= 0) return sec;
      }
    }
  }

  // 3. Regex matching in raw message or details
  const searchStr = `${rawMsg} ${error?.details || ''}`;
  const matchers = [
    /retry-after:\s*(\d+)/i,
    /retry\s+after\s*(\d+)\s*(?:s|sec|seconds?)?/i,
    /retry\s+in\s*(\d+)\s*(?:s|sec|seconds?)?/i,
    /retrydelay[:=]\s*"?(\d+)s?"?/i,
    /quotaresetdelay[:=]\s*"?(\d+)s?"?/i,
    /wait\s*(\d+)\s*(?:s|sec|seconds?)/i,
    /cooling\s+period\s*(\d+)\s*(?:s|sec|seconds?)/i,
  ];

  for (const regex of matchers) {
    const match = searchStr.match(regex);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val >= 0) return val;
    }
  }

  return undefined;
}

/**
 * Normalizes any error into a typed, provider-neutral error without exposing internals
 */
export function normalizeAIError(error: any, provider: string = 'gemini'): NormalizedAIError {
  if (error && error.__normalizedAIError) {
    return error as NormalizedAIError;
  }

  const rawMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
  const sanitizedMsg = sanitizeErrorMessage(rawMsg);
  let status = error?.status || error?.statusCode || error?.response?.status;
  const errorName = error?.name || '';
  const isAborted = errorName === 'AbortError' || rawMsg.includes('timed out') || rawMsg.includes('TIMEOUT');

  // If raw message is JSON serialized error from SDK, extract status and code
  if (typeof rawMsg === 'string' && rawMsg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed?.error?.code && !status) {
        status = parsed.error.code;
      }
    } catch {}
  }

  const retryAfterSeconds = extractRetryDelay(error, rawMsg);

  let code: AIErrorCode = 'INTERNAL_ERROR';
  let retryable = false;
  let statusCode = 500;
  let reason: string | undefined = undefined;

  const is429OrQuota =
    status === 429 ||
    rawMsg.includes('429') ||
    rawMsg.includes('RESOURCE_EXHAUSTED') ||
    rawMsg.includes('Quota exceeded') ||
    rawMsg.includes('quota') ||
    rawMsg.includes('rate limit') ||
    rawMsg.includes('Rate limit') ||
    rawMsg.includes('Too Many Requests');

  const isExplicitPermanentQuota =
    rawMsg.includes('Quota exceeded for quota metric') ||
    rawMsg.includes('Free daily read units') ||
    rawMsg.includes('Free daily request units') ||
    rawMsg.includes('exceeded your current quota') ||
    rawMsg.includes('check your plan and billing details') ||
    rawMsg.includes('insufficient quota') ||
    rawMsg.includes('daily quota') ||
    rawMsg.includes('quota exhausted') ||
    rawMsg.includes('BILLING_DISABLED') ||
    (retryAfterSeconds !== undefined && retryAfterSeconds > 3600);

  // Rate Limiting vs Permanent Quota Exhaustion
  if (is429OrQuota) {
    if (isExplicitPermanentQuota) {
      code = 'QUOTA_EXHAUSTED';
      retryable = false;
      statusCode = 429;
      reason = 'daily_quota_exhausted';
    } else {
      code = 'RATE_LIMITED';
      retryable = true;
      statusCode = 429;
      reason = 'rate_limit_throttle';
    }
  }
  // Service Unavailable / Gateway Errors (503, 502, 504, UNAVAILABLE)
  else if (
    status === 503 ||
    status === 502 ||
    rawMsg.includes('503') ||
    rawMsg.includes('UNAVAILABLE') ||
    rawMsg.includes('overloaded') ||
    rawMsg.includes('high demand') ||
    rawMsg.includes('ECONNRESET') ||
    rawMsg.includes('ETIMEDOUT')
  ) {
    code = 'SERVICE_UNAVAILABLE';
    retryable = true;
    statusCode = 503;
    reason = 'overloaded';
  }
  // Timeout
  else if (isAborted || status === 504 || rawMsg.includes('504')) {
    code = 'TIMEOUT';
    retryable = true;
    statusCode = 504;
    reason = 'timeout';
  }
  // Unauthenticated / Missing or Invalid API key (401, 403, API_KEY_INVALID)
  else if (
    status === 401 ||
    status === 403 ||
    rawMsg.includes('API key') ||
    rawMsg.includes('UNAUTHENTICATED') ||
    rawMsg.includes('PERMISSION_DENIED') ||
    rawMsg.includes('not configured')
  ) {
    code = 'UNAUTHENTICATED';
    retryable = false;
    statusCode = 401;
    reason = 'auth_failure';
  }
  // Invalid model response or parsing failure
  else if (
    rawMsg.includes('JSON') ||
    rawMsg.includes('Empty response') ||
    rawMsg.includes('Unexpected token') ||
    rawMsg.includes('Invalid output structure')
  ) {
    code = 'INVALID_RESPONSE';
    retryable = false;
    statusCode = 502;
    reason = 'invalid_request';
  }
  // Bad request (400)
  else if (status === 400 || rawMsg.includes('400') || rawMsg.includes('INVALID_ARGUMENT')) {
    code = 'BAD_REQUEST';
    retryable = false;
    statusCode = 400;
    reason = 'invalid_request';
  }

  const normalized: NormalizedAIError = {
    message: sanitizedMsg,
    code,
    retryable,
    statusCode,
    provider,
    retryAfterSeconds,
    reason,
  };

  (normalized as any).__normalizedAIError = true;
  return normalized;
}

/**
 * Executes an async task with bounded exponential backoff, jitter, timeout, and optional deduplication
 */
export async function executeWithRetry<T>(
  taskFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 300,
    maxDelayMs = 3000,
    backoffFactor = 2,
    timeoutMs = 25000,
    deduplicationKey,
    providerName = 'gemini',
  } = options;

  // If a deduplicationKey is provided and an identical request is already running, wait for it
  if (deduplicationKey) {
    const existing = inFlightRequests.get(deduplicationKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const executePipeline = async (): Promise<T> => {
    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      attempt++;
      let timeoutTimer: NodeJS.Timeout | null = null;

      try {
        // Enforce strict request timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutTimer = setTimeout(() => {
            const err: any = new Error(`AI request timed out after ${timeoutMs}ms`);
            err.name = 'TimeoutError';
            reject(err);
          }, timeoutMs);
        });

        const result = await Promise.race([taskFn(), timeoutPromise]);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        return result;
      } catch (err: any) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        lastError = err;

        const normalized = normalizeAIError(err, providerName);

        // Immediate fail on non-retryable errors (quota exhaustion, invalid auth, bad request)
        if (!normalized.retryable || normalized.code === 'QUOTA_EXHAUSTED') {
          throw normalized;
        }

        // If provider explicitly requires a cooling period longer than server backoff window,
        // do not block the HTTP thread for tens of seconds; return immediately with retryAfterSeconds
        if (
          normalized.code === 'RATE_LIMITED' &&
          normalized.retryAfterSeconds &&
          normalized.retryAfterSeconds > Math.ceil(maxDelayMs / 1000)
        ) {
          throw normalized;
        }

        // Check if retryable and we haven't exhausted attempts
        if (normalized.retryable && attempt <= maxRetries) {
          let delayMs = Math.min(
            maxDelayMs,
            initialDelayMs * Math.pow(backoffFactor, attempt - 1)
          );
          if (normalized.retryAfterSeconds && normalized.retryAfterSeconds * 1000 <= maxDelayMs) {
            delayMs = normalized.retryAfterSeconds * 1000;
          }

          // Add 50%-100% full jitter
          const jitterMultiplier = 0.5 + Math.random() * 0.5;
          const delayWithJitter = Math.floor(delayMs * jitterMultiplier);

          await new Promise((res) => setTimeout(res, delayWithJitter));
          continue;
        }

        // Non-retryable error or retries exhausted
        throw normalized;
      }
    }

    // Retries exhausted
    throw normalizeAIError(lastError, providerName);
  };

  const promise = executePipeline();

  if (deduplicationKey) {
    inFlightRequests.set(deduplicationKey, promise);
    promise
      .catch(() => {})
      .finally(() => {
        inFlightRequests.delete(deduplicationKey);
      });
  }

  return promise;
}
