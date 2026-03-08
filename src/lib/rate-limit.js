/**
 * In-memory IP rate limiter.
 *
 * Suitable for single-process (Node.js / Next.js dev & single-instance VPS).
 * For multi-instance or serverless deployments replace the store with Redis
 * (e.g. @upstash/ratelimit).
 */

const WINDOW_MS    = 15 * 60 * 1000; // 15-minute sliding window
const MAX_ATTEMPTS = 5;               // max allowed per window

/** @type {Map<string, {count: number, resetAt: number}>} */
const store = new Map();

/** Remove expired entries to prevent unbounded memory growth. */
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

/**
 * Extract the real client IP from common proxy headers.
 * @param {import('next/server').NextRequest} request
 * @returns {string}
 */
function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  );
}

/**
 * Check whether the caller is within rate-limit quota.
 *
 * @param {import('next/server').NextRequest} request
 * @param {string|null} [keyOverride]  Override the default IP-based key (e.g. username-scoped).
 * @returns {{ allowed: boolean, remaining?: number, retryAfterSec?: number }}
 */
export function checkRateLimit(request, keyOverride = null) {
  cleanup();

  const key = keyOverride ?? getClientIp(request);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  entry.count += 1;

  if (entry.count > MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count };
}

/**
 * Reset the counter for a key (call after successful login to clear penalty).
 * @param {string} key
 */
export function resetLimit(key) {
  store.delete(key);
}
