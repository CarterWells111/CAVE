import { describe, expect, it, vi } from "vitest";

import { createAuthRoutes } from "../src/routes/auth";
import { AuthServiceError } from "../src/auth/service";

const requestId = "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6";
const challengeId = "cb02004c-7b5b-4680-9b16-8a6a33511bc9";

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return createAuthRoutes({
    service: {
      requestEmailChallenge: vi.fn(async () => ({
        contractVersion: "1" as const,
        requestId,
        challengeId,
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      })),
      verifyEmailChallenge: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(async () => undefined),
      requestAccountDeletionChallenge: vi.fn(),
      verifyAccountDeletionChallenge: vi.fn(),
      deleteAccount: vi.fn(),
    },
  }).request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("authentication routes", () => {
  it("logs only allowlisted authentication metadata", async () => {
    const lines: string[] = [];
    const routes = createAuthRoutes({
      logger: (line) => lines.push(line),
      service: {
        requestEmailChallenge: vi.fn(async () => ({ contractVersion: "1" as const, requestId, challengeId, expiresInSeconds: 600, resendAfterSeconds: 60 })),
        verifyEmailChallenge: vi.fn(), refresh: vi.fn(), logout: vi.fn(),
        requestAccountDeletionChallenge: vi.fn(), verifyAccountDeletionChallenge: vi.fn(), deleteAccount: vi.fn(),
      },
    });
    await routes.request("/v1/auth/email/challenges", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        contractVersion: "1", requestId, email: "private@example.com", installationToken: "private-installation-token",
      }),
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("private@example.com");
    expect(lines[0]).not.toContain("private-installation-token");
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ route: "email_challenge", status: 202, requestId });
  });

  it("accepts a strict email challenge request with no-store caching", async () => {
    const response = await request("/v1/auth/email/challenges", {
      contractVersion: "1",
      requestId,
      email: "person@example.com",
      installationToken: "installation-token-at-least-sixteen",
    });
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ challengeId });
  });

  it("rejects non-json and oversized bodies before service invocation", async () => {
    const routes = createAuthRoutes({
      service: {
        requestEmailChallenge: vi.fn(), verifyEmailChallenge: vi.fn(), refresh: vi.fn(), logout: vi.fn(),
        requestAccountDeletionChallenge: vi.fn(), verifyAccountDeletionChallenge: vi.fn(), deleteAccount: vi.fn(),
      },
    });
    const nonJson = await routes.request("/v1/auth/email/challenges", {
      method: "POST", headers: { "content-type": "text/plain" }, body: "no",
    });
    const oversized = await routes.request("/v1/auth/email/challenges", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(17 * 1024) },
      body: "{}",
    });
    expect(nonJson.status).toBe(400);
    expect(oversized.status).toBe(413);
  });

  it("maps invalid input and typed service errors without reflecting secrets", async () => {
    const invalid = await request("/v1/auth/email/challenges", {
      contractVersion: "1", requestId: "private@example.com", email: "not-email", installationToken: "short",
      refreshToken: "cave_rt_secret-canary",
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).not.toContain("secret-canary");
    expect(await request("/v1/auth/email/challenges", {
      contractVersion: "1", requestId: "private@example.com", email: "not-email", installationToken: "short",
    }).then((response) => response.text())).not.toContain("private@example.com");
  });

  it("returns Retry-After for typed authentication rate limits", async () => {
    const service = {
      requestEmailChallenge: vi.fn(async () => { throw new AuthServiceError("RATE_LIMITED", 429, 42); }),
      verifyEmailChallenge: vi.fn(), refresh: vi.fn(), logout: vi.fn(),
      requestAccountDeletionChallenge: vi.fn(), verifyAccountDeletionChallenge: vi.fn(), deleteAccount: vi.fn(),
    };
    const response = await createAuthRoutes({ service }).request("/v1/auth/email/challenges", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        contractVersion: "1", requestId, email: "person@example.com", installationToken: "installation-token-at-least-sixteen",
      }),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    await expect(response.json()).resolves.toMatchObject({
      messageKey: "gateway.rate_limited",
      retryAfterSeconds: 42,
    });
  });

  it("routes logout idempotently", async () => {
    const response = await request("/v1/auth/sessions/logout", {
      contractVersion: "1",
      requestId,
      refreshToken: `cave_rt_${"b".repeat(43)}`,
    });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("requires a bearer access token before starting account deletion", async () => {
    const response = await request("/v1/auth/account/deletion/challenges", {
      contractVersion: "1", requestId, email: "person@example.com", installationToken: "installation-token-at-least-sixteen",
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_UNAUTHORIZED" });
  });

  it("accepts an idempotent account deletion request", async () => {
    const response = await request("/v1/auth/account", {
      contractVersion: "1",
      requestId,
      deletionGrant: `cave_dg_${"d".repeat(43)}`,
      idempotencyKey: "delete-on-device-1",
    });
    expect(response.status).toBe(204);
  });
});
