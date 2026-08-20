import { describe, expect, it, beforeEach } from "vitest";
import { getClientIp, rateLimit, resetRateLimitBuckets } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("allows requests under the limit", () => {
    const first = rateLimit("ip:a", { limit: 2, windowMs: 60_000, now: 1_000 });
    const second = rateLimit("ip:a", { limit: 2, windowMs: 60_000, now: 1_100 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it("blocks when the sliding window is exceeded", () => {
    rateLimit("ip:b", { limit: 1, windowMs: 60_000, now: 1_000 });
    const blocked = rateLimit("ip:b", { limit: 1, windowMs: 60_000, now: 1_500 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reads the first x-forwarded-for hop", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" }
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });
});
