import { describe, expect, it } from "vitest";

import {
  createNumericCode,
  createOpaqueToken,
  digestLowEntropySecret,
  digestOpaqueToken,
  normalizeEmail,
  secureEqual,
} from "../src/auth/crypto";

describe("authentication cryptography", () => {
  it("normalizes without provider-specific dot or plus rewriting", () => {
    expect(normalizeEmail("  Té.St+tag@EXAMPLE.COM  ")).toBe("té.st+tag@example.com");
  });

  it("rejects control characters and overlong addresses", () => {
    expect(() => normalizeEmail("a\nb@example.com")).toThrow("invalid-email");
    expect(() => normalizeEmail(`${"a".repeat(250)}@example.com`)).toThrow("invalid-email");
  });

  it("creates a fixed-width six-digit code from secure random bytes", () => {
    expect(createNumericCode(() => new Uint32Array([42]))).toBe("000042");
    expect(createNumericCode(() => new Uint32Array([1_234_567]))).toBe("234567");
  });

  it("creates type-prefixed 256-bit opaque tokens", () => {
    const token = createOpaqueToken("access", () => new Uint8Array(32).fill(7));
    expect(token).toMatch(/^cave_at_[A-Za-z0-9_-]{43}$/u);
    expect(token).not.toContain("=");
  });

  it("uses a keyed digest for low-entropy codes and a plain digest for random tokens", async () => {
    const first = await digestLowEntropySecret("otp-key", "challenge:123456");
    const second = await digestLowEntropySecret("different-key", "challenge:123456");
    expect(first).not.toBe(second);
    expect(await digestOpaqueToken("cave_rt_secret")).toMatch(/^[0-9a-f]{64}$/u);
    expect(secureEqual(first, first)).toBe(true);
    expect(secureEqual(first, second)).toBe(false);
    expect(secureEqual(first, "short")).toBe(false);
  });
});
