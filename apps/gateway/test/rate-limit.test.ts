import { describe, expect, it, vi } from "vitest";

import { InMemoryRateLimitStore, createRateLimiter } from "../src/security/rate-limit";

describe("installation-token rate limit", () => {
  it("limits turn to 10 per 60 seconds and returns integer retry seconds", async () => {
    const hash = vi.fn(async (token: string) => `hash:${token}`);
    const limiter = createRateLimiter({ store: new InMemoryRateLimitStore(), hash, now: () => 1_000 });
    for (let index = 0; index < 10; index += 1) {
      await expect(limiter.check("turn", "raw-secret-token")).resolves.toEqual({ allowed: true });
    }
    const blocked = await limiter.check("turn", "raw-secret-token");
    expect(blocked).toEqual({
      allowed: false,
      status: 429,
      error: {
        contractVersion: "1",
        requestId: "rate-limit",
        code: "RATE_LIMITED",
        messageKey: "errors.rateLimited",
        retryAfterSeconds: 60
      }
    });
    expect(Number.isInteger(blocked.allowed ? 0 : blocked.error.retryAfterSeconds)).toBe(true);
    expect(hash).toHaveBeenCalledWith("raw-secret-token");
  });

  it("uses an independent debrief bucket limited to five", async () => {
    const limiter = createRateLimiter({
      store: new InMemoryRateLimitStore(),
      hash: async (token) => `digest:${token}`,
      now: () => 10_000
    });
    for (let index = 0; index < 5; index += 1) await limiter.check("debrief", "token-a");
    await expect(limiter.check("debrief", "token-a")).resolves.toMatchObject({ allowed: false, status: 429 });
    await expect(limiter.check("turn", "token-a")).resolves.toEqual({ allowed: true });
  });

  it("does not couple installations that share an IP", async () => {
    const limiter = createRateLimiter({
      store: new InMemoryRateLimitStore(),
      hash: async (token) => `digest:${token}`,
      now: () => 20_000
    });
    for (let index = 0; index < 10; index += 1) await limiter.check("turn", "token-a");
    await expect(limiter.check("turn", "token-a")).resolves.toMatchObject({ allowed: false });
    await expect(limiter.check("turn", "token-b")).resolves.toEqual({ allowed: true });
  });

  it.each([
    [1.2, 2],
    [0, 1],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1]
  ])("normalizes injected retry seconds %s to integer %s", async (value, expected) => {
    const limiter = createRateLimiter({
      store: { async consume() { return { allowed: false, retryAfterSeconds: value }; } },
      hash: async () => "digest",
      now: () => 1
    });
    await expect(limiter.check("turn", "token")).resolves.toMatchObject({
      allowed: false,
      error: { retryAfterSeconds: expected }
    });
  });
});
