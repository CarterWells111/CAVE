import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { loadCatalog } from "@cave/content";
import type { AssistantRequest, AssistantResponse } from "@cave/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { digestOpaqueToken } from "../src/auth/crypto";
import { createAssistantRoutes } from "../src/routes/assistant";
import { InMemoryRateLimitStore } from "../src/security/rate-limit";
import { createAssistantService } from "../src/services/assistant";
import { D1AssistantUsageStore } from "../src/services/assistant-usage";

const databases: DatabaseSync[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) db.close(); });
const request: AssistantRequest = { mode: "chat", consent: true, records: [], question: "今天想整理一下自己的感受。" };
const answer: AssistantResponse = { status: "ok", providerMode: "live", message: "可以从今天印象深的一件小事开始。", observations: [], sources: [] };

async function harness(service: (input: AssistantRequest) => Promise<AssistantResponse>, hour = 2, day = 3) {
  const db = new DatabaseSync(":memory:"); databases.push(db);
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of ["0001_auth.sql", "0003_assistant_usage.sql"]) db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  const tokens = { a: `cave_at_${"a".repeat(43)}`, b: `cave_at_${"b".repeat(43)}` };
  const digests = new Map(await Promise.all(Object.entries(tokens).map(async ([id, token]) => [await digestOpaqueToken(token), id] as const)));
  for (const id of Object.keys(tokens)) db.prepare("INSERT INTO auth_accounts VALUES (?, ?, 1, ?)").run(id, `synthetic-${id}`, "2026-10-14");
  const binding = { prepare(sql: string) { return { bind(...values: SQLInputValue[]) { return {
    first: async () => db.prepare(sql).get(...values) ?? null,
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...values).changes) } }),
  }; } }; } } as unknown as D1Database;
  const usage = new D1AssistantUsageStore(binding, { hour, day });
  const clock = { now: Date.parse("2026-10-14T10:30:00Z") };
  vi.spyOn(Date, "now").mockImplementation(() => clock.now);
  const consume = vi.spyOn(usage, "consume");
  const app = createAssistantRoutes({ providerMode: "live", usage, service, rateLimitStore: new InMemoryRateLimitStore(), repository: {
    findSessionByAccessDigest: async digest => {
      const id = digests.get(digest);
      return id ? { id: `session-${id}`, accountId: id, accessDigest: digest, refreshDigest: "synthetic-refresh", accessExpiresAt: "2099-01-01", refreshExpiresAt: "2099-01-01", createdAt: "2026-10-14", lastSeenAt: "2026-10-14" } : null;
    },
    findAccountById: async id => Object.hasOwn(tokens, id) ? { id, emailLookup: `synthetic-${id}`, emailKeyVersion: 1, createdAt: "2026-10-14" } : null,
  } });
  const send = (input: AssistantRequest = request, owner: keyof typeof tokens = "a", signal?: AbortSignal) => app.request("/v1/assistant", {
    method: "POST", headers: { authorization: `Bearer ${tokens[owner]}`, "content-type": "application/json" }, body: JSON.stringify(input),
    ...(signal ? { signal } : {}),
  });
  const read = async (owner: keyof typeof tokens = "a") => {
    const response = await app.request("/v1/assistant/usage", { headers: { authorization: `Bearer ${tokens[owner]}` } });
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    return response.json();
  };
  return { db, clock, usage, consume, send, read };
}

describe("charge only delivered, valid assistant replies", () => {
  it("does not charge a late successful reply after observable request cancellation; a retry counts once", async () => {
    let resolve!: (value: AssistantResponse) => void;
    const service = vi.fn().mockImplementationOnce(() => new Promise<AssistantResponse>(value => { resolve = value; })).mockResolvedValue(answer);
    const h = await harness(service, 1, 1);
    const controller = new AbortController();
    const pending = h.send(request, "a", controller.signal);
    await vi.waitFor(() => expect(service).toHaveBeenCalledOnce());
    controller.abort();
    resolve(answer);
    const cancelled = await pending;
    expect(cancelled.status).toBe(503);
    expect((await cancelled.json()).status).toBe("unavailable");
    expect(cancelled.headers.get("cache-control")).toBe("no-store");
    expect(h.consume).not.toHaveBeenCalled();
    expect(await h.read()).toMatchObject({ hour: { used: 0 }, day: { used: 0 } });
    expect((await h.send()).status).toBe(200);
    expect(h.consume).toHaveBeenCalledTimes(1);
    expect(await h.read()).toMatchObject({ hour: { used: 1 }, day: { used: 1 } });
  });

  it("does no model work or quota write for an already cancelled request", async () => {
    const service = vi.fn(async () => answer);
    const h = await harness(service);
    const controller = new AbortController(); controller.abort();
    expect((await h.send(request, "a", controller.signal)).status).toBe(503);
    expect(service).not.toHaveBeenCalled();
    expect(h.consume).not.toHaveBeenCalled();
    expect(await h.read()).toMatchObject({ hour: { used: 0 }, day: { used: 0 } });
  });

  it.each(["unavailable", "blocked"] as const)("does not charge %s replies and counts the successful retry once", async status => {
    const service = vi.fn().mockResolvedValueOnce({ ...answer, status }).mockResolvedValueOnce(answer);
    const h = await harness(service, 1, 1);
    const failed = await h.send();
    expect(failed.status).toBe(200); expect((await failed.json()).status).toBe(status);
    expect(failed.headers.get("cache-control")).toBe("no-store");
    expect(h.consume).not.toHaveBeenCalled();
    expect(await h.read()).toMatchObject({ hour: { used: 0 }, day: { used: 0 } });
    expect((await h.send()).status).toBe(200);
    expect(h.consume).toHaveBeenCalledTimes(1);
    expect(await h.read()).toMatchObject({ hour: { used: 1 }, day: { used: 1 } });
    expect((await h.send()).status).toBe(429);
    expect(service).toHaveBeenCalledTimes(2);
    expect(await h.read("b")).toMatchObject({ hour: { used: 0 }, day: { used: 0 } });
  });

  it("does not charge thrown provider errors, timeout fallbacks or malformed successful results", async () => {
    const service = vi.fn().mockRejectedValueOnce(new Error("synthetic-provider-error"))
      .mockResolvedValueOnce({ ...answer, observations: [{ text: "未知引用", sourceRecordIds: ["unknown"] }] });
    const h = await harness(service);
    expect((await h.send()).status).toBe(503);
    expect((await h.send()).status).toBe(503);
    expect(h.consume).not.toHaveBeenCalled();
    expect(await h.read()).toMatchObject({ hour: { used: 0 }, day: { used: 0 } });
    const timed = createAssistantService({ providerMode: "live", catalog: loadCatalog(), timeoutMs: 5, chat: () => new Promise(() => undefined) });
    service.mockImplementation(timed);
    const timeout = await h.send();
    expect((await timeout.json()).status).toBe("unavailable");
    expect(h.consume).not.toHaveBeenCalled();
  });

  it("reserves no allowance while working and atomically limits concurrent successful completions", async () => {
    const resolves: ((value: AssistantResponse) => void)[] = [];
    const service = vi.fn(() => new Promise<AssistantResponse>(resolve => resolves.push(resolve)));
    const h = await harness(service, 1, 1);
    const pending = [h.send(), h.send(), h.send()];
    await vi.waitFor(() => expect(service).toHaveBeenCalledTimes(3));
    expect(h.consume).not.toHaveBeenCalled();
    expect(await h.read()).toMatchObject({ hour: { used: 0 }, day: { used: 0 } });
    resolves[1]!(answer);
    expect((await pending[1]!).status).toBe(200);
    resolves[0]!(answer);
    const lostSlot = await pending[0]!;
    expect(lostSlot.status).toBe(429);
    expect((await lostSlot.json()).code).toBe("AI_QUOTA_EXCEEDED");
    resolves[2]!({ ...answer, status: "unavailable" });
    expect((await pending[2]!).status).toBe(200);
    expect(await h.read()).toMatchObject({ hour: { used: 1 }, day: { used: 1 } });
    expect(h.consume).toHaveBeenCalledTimes(2);
  });

  it("counts a successful Chinese/voice correction as one answer, not two model calls", async () => {
    const chat = vi.fn().mockResolvedValueOnce("This is an English reply.").mockResolvedValueOnce("我愿意听这段经历，可以从一个小细节开始。");
    const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), chat });
    const h = await harness(service);
    const result = await h.send();
    expect((await result.json()).status).toBe("ok");
    expect(chat).toHaveBeenCalledTimes(2);
    expect(h.consume).toHaveBeenCalledTimes(1);
    expect(await h.read()).toMatchObject({ hour: { used: 1 }, day: { used: 1 } });
  });

  it.each([
    ["2026-10-14T10:59:59Z", "2026-10-14T11:00:00Z"],
    ["2026-10-14T23:59:59Z", "2026-10-15T00:00:00Z"],
  ])("charges the successful response's current window across %s → %s", async (start, finish) => {
    let resolve!: (value: AssistantResponse) => void;
    const service = vi.fn(() => new Promise<AssistantResponse>(value => { resolve = value; }));
    const h = await harness(service);
    h.clock.now = Date.parse(start);
    const pending = h.send();
    await vi.waitFor(() => expect(service).toHaveBeenCalledOnce());
    h.clock.now = Date.parse(finish);
    resolve(answer);
    expect((await pending).status).toBe(200);
    expect(h.consume).toHaveBeenCalledWith("a", Date.parse(finish));
    expect(await h.read()).toMatchObject({ hour: { used: 1 }, day: { used: 1 } });
  });

  it("does not charge a result rejected by journal-follow-up preview constraints", async () => {
    const service = vi.fn(async () => ({ ...answer, summary: `我${"回".repeat(1200)}` }));
    const h = await harness(service);
    const review: AssistantRequest = { mode: "review", consent: true, contextConsent: true, question: "回顾后来的变化", records: [
      { id: "record-a", text: JSON.stringify({ title: "合成手记", body: "我去散步了。" }) },
      { id: "journal-review-conversation", text: JSON.stringify({ referenceType: "journal-review-context", reviewTask: { selectedRecordId: "record-a", requestId: "review-1", periodEnd: "2026-10-14" }, recentConversation: [] }) },
    ] };
    expect((await h.send(review)).status).toBe(503);
    expect(h.consume).not.toHaveBeenCalled();
    expect(await h.read()).toMatchObject({ hour: { used: 0 }, day: { used: 0 } });
  });

  it("keeps both counters unchanged if the final atomic usage write fails", async () => {
    const h = await harness(vi.fn(async () => answer));
    h.db.exec("CREATE TRIGGER fail_usage BEFORE INSERT ON assistant_usage BEGIN SELECT RAISE(ABORT, 'synthetic-write-failure'); END;");
    expect((await h.send()).status).toBe(503);
    expect(await h.read()).toMatchObject({ hour: { used: 0 }, day: { used: 0 } });
    h.db.exec("DROP TRIGGER fail_usage");
    expect((await h.send()).status).toBe(200);
    expect(await h.read()).toMatchObject({ hour: { used: 1 }, day: { used: 1 } });
  });
});
