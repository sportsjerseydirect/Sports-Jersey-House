/**
 * Best-effort sliding-window rate limiter for serverless.
 * Limits are per-instance; still stops casual abuse on cart/login APIs.
 */

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number; now?: number } = { limit: 30, windowMs: 60_000 }
): RateLimitResult {
  const now = options.now ?? Date.now();
  const windowStart = now - options.windowMs;
  const existing = buckets.get(key) ?? { timestamps: [] };
  const timestamps = existing.timestamps.filter((ts) => ts > windowStart);

  if (timestamps.length >= options.limit) {
    buckets.set(key, { timestamps });
    const oldest = timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));

    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  timestamps.push(now);
  buckets.set(key, { timestamps });

  return {
    allowed: true,
    remaining: Math.max(0, options.limit - timestamps.length),
    retryAfterSeconds: 0
  };
}

/** Test helper — clears in-memory buckets between cases. */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds)
      }
    }
  );
}
