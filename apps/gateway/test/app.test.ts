import { ApiErrorResponseSchema } from "@cave/contracts";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { InMemoryAuthRepository } from "../src/auth/in-memory-auth-repository";
import { createAuthService } from "../src/auth/service";
import type { ModelProvider } from "../src/providers/types";
import { InMemoryRateLimitStore } from "../src/security/rate-limit";
import { VALID_DEBRIEF_REQUEST, VALID_TURN_REQUEST } from "./helpers";

const mockEnv = {
  MODEL_MODE: "mock" as const,
  PROMPT_VERSION: "prompt-v1",
  POLICY_VERSION: "policy-v1"
};

function app(options: Parameters<typeof createApp>[1] = {}) {
  return createApp(mockEnv, {
    rateLimitStore: new InMemoryRateLimitStore(),
    ...options
  });
}

describe("composed gateway app", () => {
  it("mounts the versioned authentication contract in the production composition", async () => {
    const authService = createAuthService({
      repository: new InMemoryAuthRepository(),
      emailSender: { async sendCode() {} },
      emailLookupKeys: [{ version: 1, value: "email-lookup-key-with-32-bytes-minimum" }],
      otpKeys: [{ version: 1, value: "otp-digest-key-with-32-bytes-minimum" }],
      createCode: () => "123456",
    });
    const response = await app({ authService }).request("/v1/auth/email/challenges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractVersion: "1",
        requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
        email: "person@example.com",
        installationToken: "installation-token-at-least-sixteen",
      }),
    });
    expect(response.status).toBe(202);
  });

  it("fails closed when authentication bindings are not configured", async () => {
    const response = await app().request("/v1/auth/email/challenges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractVersion: "1",
        requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
        email: "person@example.com",
        installationToken: "installation-token-at-least-sixteen",
      }),
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_DELIVERY_UNAVAILABLE" });
  });

  it("serves health, metadata, turn, and debrief through the production composition", async () => {
    const gateway = app();
    const health = await gateway.request("/health");
    const meta = await gateway.request("/v1/meta");
    const turn = await gateway.request("/v1/practice/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_TURN_REQUEST)
    });
    const debrief = await gateway.request("/v1/practice/debrief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_DEBRIEF_REQUEST)
    });

    expect(health.status).toBe(200);
    expect(meta.status).toBe(200);
    expect(turn.status).toBe(200);
    expect(debrief.status).toBe(200);
  });

  it("applies request validation before invoking a provider", async () => {
    const provider: ModelProvider = {
      generateTurn: vi.fn(),
      generateDebrief: vi.fn()
    };
    const response = await app({ provider }).request("/v1/practice/turn", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(VALID_TURN_REQUEST)
    });

    expect(response.status).toBe(400);
    expect(ApiErrorResponseSchema.safeParse(await response.json()).success).toBe(true);
    expect(provider.generateTurn).not.toHaveBeenCalled();
  });

  it("rate limits with a hashed installation token before provider invocation", async () => {
    const provider: ModelProvider = {
      generateTurn: vi.fn(),
      generateDebrief: vi.fn()
    };
    const response = await createApp(mockEnv, {
      provider,
      rateLimitStore: {
        async consume(key) {
          expect(key).not.toContain(VALID_TURN_REQUEST.installationToken);
          return { allowed: false, retryAfterSeconds: 60 };
        }
      }
    }).request("/v1/practice/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_TURN_REQUEST)
    });

    expect(response.status).toBe(429);
    expect(provider.generateTurn).not.toHaveBeenCalled();
  });

  it("binds the output guard to the actual versioned system prompt", async () => {
    const provider: ModelProvider = {
      async generateTurn(input) {
        return {
          requestId: input.requestId,
          roleMessage: input.systemPrompt.split("\n")[0],
          candidateStage: "opening"
        };
      },
      async generateDebrief() {
        throw new Error("not used");
      }
    };
    const response = await app({ provider }).request("/v1/practice/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_TURN_REQUEST)
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: "UNSAFE_CONTEXT" });
  });

  it("logs only the allowlisted metadata record", async () => {
    const lines: string[] = [];
    await app({ logger: (line) => lines.push(line) }).request("/v1/practice/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...VALID_TURN_REQUEST,
        requestId: "c8c34dd2-5ae2-4f26-bf31-f0750bed8806"
      })
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(VALID_TURN_REQUEST.installationToken);
    expect(lines[0]).not.toContain(VALID_TURN_REQUEST.userMessage);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      requestId: "c8c34dd2-5ae2-4f26-bf31-f0750bed8806",
      route: "turn",
      providerMode: "mock"
    });
  });

  it("does not let an observability sink change the request outcome", async () => {
    const response = await app({
      logger() {
        throw new Error("log transport unavailable");
      }
    }).request("/v1/practice/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_TURN_REQUEST)
    });

    expect(response.status).toBe(200);
  });
});
