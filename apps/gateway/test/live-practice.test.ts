import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { digestOpaqueToken } from "../src/auth/crypto";
import { InMemoryAuthRepository } from "../src/auth/in-memory-auth-repository";
import { createAuthService } from "../src/auth/service";
import type { RoomService } from "../src/rooms/service";
import { MockProvider } from "../src/providers/mock";
import { InMemoryRateLimitStore } from "../src/security/rate-limit";
import { VALID_DEBRIEF_REQUEST, VALID_TURN_REQUEST } from "./helpers";

const liveEnv = {
  MODEL_MODE: "live" as const,
  MODEL_BASE_URL: "https://synthetic-model.invalid",
  MODEL_API_KEY: "synthetic-test-key",
  MODEL_NAME: "synthetic-model",
  PROMPT_VERSION: "prompt-v1",
  POLICY_VERSION: "policy-v1",
  ASSISTANT_HOURLY_LIMIT: "5",
  ASSISTANT_DAILY_LIMIT: "25",
};

const routes = [
  { route: "turn", body: VALID_TURN_REQUEST, reply: {
    requestId: VALID_TURN_REQUEST.requestId,
    roleMessage: "我们可以慢慢讨论，你希望怎样安排下一步？",
    candidateStage: "opening",
  } },
  { route: "debrief", body: VALID_DEBRIEF_REQUEST, reply: {
    requestId: VALID_DEBRIEF_REQUEST.requestId,
    dimensions: ["feeling", "willingness", "boundary", "next_step"].map(key => ({
      key, status: "not_observed", explanation: "这次练习中没有可引用的表达。",
    })),
    expressionCard: {},
  } },
];

function completion(reply: unknown) {
  return vi.fn(async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(reply) } }],
  }), { headers: { "content-type": "application/json" } }));
}

describe("live practice routes through createApp", () => {
  it.each(routes)("closes $route before model calls or quota use for repeated, rotated and authorized requests", async ({ route, body, reply }) => {
    const fetch = completion(reply);
    const store = new InMemoryRateLimitStore();
    const consume = vi.spyOn(store, "consume");
    const gateway = createApp(liveEnv, { fetch, rateLimitStore: store });
    const responses: Response[] = [];
    for (const authorization of [undefined, `Bearer cave_at_${"a".repeat(43)}`]) {
      for (let index = 0; index < 12; index += 1) {
        for (const installationToken of ["same-synthetic-installation-token", `rotated-synthetic-installation-token-${index}`]) {
          responses.push(await gateway.request(`/v1/practice/${route}`, {
            method: "POST",
            headers: { "content-type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
            body: JSON.stringify({ ...body, installationToken }),
          }));
        }
      }
    }
    expect(fetch.mock.calls.length).toBe(0);
    expect(consume.mock.calls.length).toBe(0);
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ code: "PRACTICE_DISABLED" });
    }
  });

  it("does not reopen live practice when a local mock provider is injected", async () => {
    const provider = new MockProvider();
    const turn = vi.spyOn(provider, "generateTurn");
    const debrief = vi.spyOn(provider, "generateDebrief");
    const gateway = createApp(liveEnv, { provider, rateLimitStore: new InMemoryRateLimitStore() });
    for (const { route, body } of routes) {
      const response = await gateway.request(`/v1/practice/${route}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      expect(response.status).toBe(404);
    }
    expect(turn.mock.calls.length).toBe(0);
    expect(debrief.mock.calls.length).toBe(0);
  });

  it.each(routes)("rejects $route without cloning or reading even an invalid request body", async ({ route }) => {
    const fetch = completion({});
    const consume = vi.fn(async () => ({ allowed: true }));
    const gateway = createApp(liveEnv, { fetch, rateLimitStore: { consume } });
    for (const input of [
      { body: "{", headers: { "content-type": "application/json" } },
      { body: "", headers: { "content-type": "application/json" } },
      { body: "synthetic-invalid-body", headers: { "content-type": "text/plain" } },
      { body: "synthetic-oversized-body", headers: { "content-type": "application/json", "content-length": String(17 * 1024) } },
    ]) {
      const request = new Request(`https://gateway.test/v1/practice/${route}`, { method: "POST", ...input });
      const clone = vi.spyOn(request, "clone");
      const response = await gateway.fetch(request);
      expect(response.status).toBe(404);
      expect(request.bodyUsed).toBe(false);
      expect(clone).not.toHaveBeenCalled();
    }
    expect(fetch.mock.calls.length).toBe(0);
    expect(consume.mock.calls.length).toBe(0);
  });

  it("keeps live authentication and explicitly enabled rooms mounted", async () => {
    const authService = createAuthService({
      repository: new InMemoryAuthRepository(),
      emailSender: { async sendCode() {} },
      emailLookupKeys: [{ version: 1, value: "email-lookup-key-with-32-bytes-minimum" }],
      otpKeys: [{ version: 1, value: "otp-digest-key-with-32-bytes-minimum" }],
      createCode: () => "123456",
    });
    const gateway = createApp({ ...liveEnv, ROOMS_ENABLED: "true" }, {
      rateLimitStore: new InMemoryRateLimitStore(), authService,
      roomService: { list: async (_token: string, requestId: string) => ({ contractVersion: "1" as const, requestId, rooms: [] }) } as RoomService,
    });
    const requestId = "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6";
    const challenge = await gateway.request("/v1/auth/email/challenges", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contractVersion: "1", requestId, email: "person@example.com", installationToken: "synthetic-installation-token" }),
    });
    expect(challenge.status).toBe(202);
    const rooms = await gateway.request("/v1/rooms?requestId=" + requestId, {
      headers: { Authorization: "Bearer cave_at_" + "a".repeat(43) },
    });
    expect(rooms.status).toBe(200);
    await expect(rooms.json()).resolves.toEqual({ contractVersion: "1", requestId, rooms: [] });
  });

  it("keeps authenticated live assistant generation and account usage available", async () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(readFileSync(new URL("../migrations/0001_auth.sql", import.meta.url), "utf8"));
      db.exec(readFileSync(new URL("../migrations/0003_assistant_usage.sql", import.meta.url), "utf8"));
      const token = `cave_at_${"a".repeat(43)}`;
      db.prepare("INSERT INTO auth_accounts VALUES (?, ?, 1, ?)").run("synthetic-account", "synthetic-lookup", "2026-10-07");
      db.prepare(`INSERT INTO auth_sessions (id, account_id, access_digest, access_expires_at, refresh_digest, refresh_expires_at, created_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run("synthetic-session", "synthetic-account", await digestOpaqueToken(token),
        "2099-01-01T00:00:00.000Z", "synthetic-refresh", "2099-01-01T00:00:00.000Z", "2026-10-07", "2026-10-07");
      const binding = { prepare(sql: string) { return { bind(...params: SQLInputValue[]) { return {
        first: async () => db.prepare(sql).get(...params) ?? null,
        run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...params).changes) } }),
      }; } }; } } as unknown as D1Database;
      const fetch = completion({ status: "ok", message: "你记录了一次散步。", summary: "和朋友散步", observations: [] });
      const store = new InMemoryRateLimitStore();
      const consume = vi.spyOn(store, "consume");
      const gateway = createApp({ ...liveEnv, AUTH_DB: binding }, { fetch, rateLimitStore: store });
      // A valid access token must not reopen the retired practice endpoints or charge account usage.
      for (const { route, body } of routes) {
        expect((await gateway.request(`/v1/practice/${route}`, {
          method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
        })).status).toBe(404);
      }
      expect(fetch.mock.calls.length).toBe(0);
      expect(consume.mock.calls.length).toBe(0);
      expect(db.prepare("SELECT count(*) AS n FROM assistant_usage").get()?.n).toBe(0);
      const response = await gateway.request("/v1/assistant", {
        method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: "summarize", consent: true, records: [{ id: "synthetic-record", text: "今天和朋友散步" }] }),
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ status: "ok", providerMode: "live", summary: "和朋友散步" });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(consume).toHaveBeenCalledTimes(1);
      expect(consume.mock.calls[0]?.[0]).toMatch(/^assistant:/u);
      expect(db.prepare("SELECT hour_used, day_used FROM assistant_usage").get()).toMatchObject({ hour_used: 1, day_used: 1 });
    } finally { db.close(); }
  });
});