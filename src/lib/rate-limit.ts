// src/lib/rate-limit.ts
// Lightweight fixed-window rate limiter kept in process memory.
// Good enough for a single-instance deployment; swap for a shared store
// (e.g. Redis / Upstash) when running multiple server instances.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSec: number };

/** Read-only check: does NOT consume a slot. */
export function peekRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
  const remaining = Math.max(0, limit - bucket.count);
  return {
    allowed: bucket.count < limit,
    remaining,
    retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/** Consumes one slot and reports whether the caller is still within the limit. */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

export function tooManyRequestsBody(retryAfterSec: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return {
    error: `Demasiados intentos. Por seguridad, espera ${minutes} minuto(s) antes de volver a intentarlo.`,
    retryAfterSec,
  };
}
