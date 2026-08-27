import type { ApiErrorResponse } from "@cave/contracts";

import type { PracticeRoute } from "./request-guard";

const LIMITS = {
  turn: 10,
  debrief: 5
} as const;
const WINDOW_MS = 60_000;

type StoreResult = { allowed: boolean; retryAfterSeconds?: number };

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number, nowMs: number): Promise<StoreResult>;
}

type Bucket = { count: number; resetsAt: number };

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  async consume(key: string, limit: number, windowMs: number, nowMs: number): Promise<StoreResult> {
    const existing = this.buckets.get(key);
    const bucket = existing === undefined || existing.resetsAt <= nowMs
      ? { count: 0, resetsAt: nowMs + windowMs }
      : existing;
    if (bucket.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetsAt - nowMs) / 1000))
      };
    }
    bucket.count += 1;
    this.buckets.set(key, bucket);
    return { allowed: true };
  }
}

export type RateLimitAllowed = { allowed: true };
export type RateLimitBlocked = {
  allowed: false;
  status: 429;
  error: ApiErrorResponse & { retryAfterSeconds: number };
};
export type RateLimitResult = RateLimitAllowed | RateLimitBlocked;

type Dependencies = {
  store: RateLimitStore;
  hash?(token: string): Promise<string>;
  now?(): number;
};

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createRateLimiter({
  store,
  hash = sha256,
  now = Date.now
}: Dependencies) {
  return {
    async check(
      route: PracticeRoute,
      installationToken: string,
      requestId = "rate-limit"
    ): Promise<RateLimitResult> {
      const digest = await hash(installationToken);
      const result = await store.consume(
        `${route}:${digest}`,
        LIMITS[route],
        WINDOW_MS,
        now()
      );
      if (result.allowed) return { allowed: true };
      const suppliedRetry = result.retryAfterSeconds;
      const retryAfterSeconds = typeof suppliedRetry === "number" && Number.isFinite(suppliedRetry)
        ? Math.max(1, Math.ceil(suppliedRetry))
        : 1;
      return {
        allowed: false,
        status: 429,
        error: {
          contractVersion: "1",
          requestId,
          code: "RATE_LIMITED",
          messageKey: "errors.rateLimited",
          retryAfterSeconds
        }
      };
    }
  };
}
