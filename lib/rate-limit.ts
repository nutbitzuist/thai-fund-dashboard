// ─────────────────────────────────────────────
// lib/rate-limit.ts
// Simple in-memory rate limiter for public API routes
// Uses sliding window per IP (or global fallback)
// Note: In-memory only — resets on cold starts, fine for free tier
// ─────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

const DEFAULTS: RateLimitOptions = {
  maxRequests: 60,
  windowMs: 60_000, // 1 minute
};

/**
 * Check if a key (IP or route) is within rate limit.
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  options: Partial<RateLimitOptions> = {}
): { allowed: boolean; remaining: number; resetAt: number } {
  const { maxRequests, windowMs } = { ...DEFAULTS, ...options };
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1, resetAt: entry.resetAt };
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// Cleanup old entries periodically (runs on module load, non-blocking)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 5 * 60 * 1000); // every 5 minutes
}
