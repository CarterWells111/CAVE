import { loadCatalog } from "@cave/content";
import { AssistantRequestSchema, type AssistantRequest } from "@cave/contracts";
import { describe, expect, it, vi } from "vitest";
import { ASSISTANT_PROMPT, createAssistantService } from "../src/services/assistant";
import { createAssistantRoutes, MAX_ASSISTANT_REQUEST_BYTES } from "../src/routes/assistant";
import { InMemoryRateLimitStore } from "../src/security/rate-limit";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible";
import { ProviderError } from "../src/providers/types";

const input: AssistantRequest = { mode: "summarize", consent: true, records: [{ id: "a", text: "今天和朋友散步" }] };
const output = { status: "ok", message: "你记录了一次散步。", summary: "我和朋友散步了。", observations: [{ text: "我在这次散步中提到了朋友。", sourceRecordIds: ["a"] }] };
const make = (value: unknown = output) => createAssistantService({ providerMode: "live", catalog: loadCatalog(), complete: async () => value });
describe("private assistant", () => {
  it.each(["summarize", "review"] as const)("corrects %s summary and observations once while keeping only a short first-person completion message", async mode => {
    const first = { ...output, summary: "你和朋友散步了。", observations: [{ text: "你提到了朋友。", sourceRecordIds: ["a"] }] };
    const complete = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(output);
    const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), complete });
    expect(await service({ ...input, mode })).toMatchObject({ status: "ok", summary: output.summary, observations: output.observations, message: mode === "review" ? "这段回顾，我想这样记下。" : "这段经历，我想这样记下。" });
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1]?.[0]).toContain("用用户自己的第一人称我/我们记录");
    expect(complete.mock.calls[1]?.[1]).toBe(complete.mock.calls[0]?.[1]);
  });
  it("rejects second-person summarize observations even when the summary already has the right voice", async () => {
    const complete = vi.fn(async () => ({ ...output, observations: [{ text: "你提到了朋友。", sourceRecordIds: ["a"] }] }));
    const logger = vi.fn();
    expect(await createAssistantService({ providerMode: "live", catalog: loadCatalog(), complete, logger })(input)).toMatchObject({ status: "unavailable", observations: [] });
    expect(complete).toHaveBeenCalledTimes(2);
    expect(logger.mock.calls).toEqual([[{ event: "assistant.failure", reason: "invalid_journal_writing_voice" }]]);
  });
  it("does not add a second correction after language retry still returns an invalid writing voice", async () => {
    const complete = vi.fn().mockResolvedValueOnce({ ...output, summary: "A walk with a friend." }).mockResolvedValue({ ...output, summary: "你和朋友散步了。" });
    const response = await createAssistantService({ providerMode: "live", catalog: loadCatalog(), complete })(input);
    expect(response.status).toBe("unavailable");
    expect(response.summary).toBeUndefined();
    expect(complete).toHaveBeenCalledTimes(2);
  });
  it("keeps attributed record dialogue but refuses assistant examples hidden inside review context", async () => {
    const statement = "我对朋友说：“你可以先坐下。”";
    const candidate = { ...output, summary: `傍晚，${statement}`, observations: [] };
    const record = { id: "a", text: JSON.stringify({ title: "散步", body: statement, entries: [] }) };
    expect(await make(candidate)({ ...input, mode: "review", records: [record] })).toMatchObject({ status: "ok", summary: candidate.summary });
    const context = { id: "journal-review-conversation", text: JSON.stringify({ referenceType: "journal-review-context", reviewTask: { instructions: statement }, recentConversation: [{ user: "我去了公园。", assistant: { message: `例如${statement}`, question: statement } }] }) };
    expect(await make(candidate)({ ...input, mode: "review", records: [{ id: "a", text: "我去了公园。" }, context] })).toMatchObject({ status: "unavailable" });
  });
  it("preserves conversational questions without summaries and leaves guide/journey language retries conversational", async () => {
    const reply = { status: "ok", message: "你想先聊哪一件事？", question: "你后来有什么变化？", observations: [] };
    expect(await make(reply)({ ...input, mode: "review" })).toMatchObject(reply);
    for (const mode of ["guide", "journey"] as const) {
      const complete = vi.fn().mockResolvedValueOnce({ ...reply, message: "What happened?" }).mockResolvedValueOnce(reply);
      const request: AssistantRequest = { mode, consent: true, records: [], question: "旅程怎么使用？", ...(mode === "journey" ? { journeyId: "first-overnight" as const } : {}) };
      expect(await createAssistantService({ providerMode: "live", catalog: loadCatalog(), complete })(request)).toMatchObject(reply);
      expect(complete).toHaveBeenCalledTimes(2);
      expect(complete.mock.calls[1]?.[0]).not.toContain("用用户自己的第一人称我/我们记录");
    }
  });
  it("retries English record summaries and never exposes an English field", async () => {
    const complete = vi.fn().mockResolvedValueOnce({ ...output, summary: "A walk with a friend." }).mockResolvedValueOnce(output);
    const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), complete });
    expect(await service(input)).toMatchObject({ status: "ok", summary: output.summary });
    expect(complete).toHaveBeenCalledTimes(2);
    expect(ASSISTANT_PROMPT).toContain("only in Simplified Chinese");
    expect(complete.mock.calls[1]?.[0]).toContain("所有给用户看的文字必须使用简体中文");
    const english = createAssistantService({ providerMode: "live", catalog: loadCatalog(), complete: async () => ({ ...output, observations: [{ text: "You mentioned your friend.", sourceRecordIds: ["a"] }] }) });
    expect(await english(input)).toMatchObject({ status: "unavailable", message: expect.stringMatching(/中文/u), observations: [] });
  });
  it("treats blank optional model fields as omitted while preserving strict required fields", async () => {
    expect(await make({ ...output, summary: "", question: "  " })(input)).toMatchObject({ status: "ok" });
    expect(await make({ ...output, message: "" })(input)).toMatchObject({ status: "unavailable" });
    expect(await make({ ...output, summary: 123 })(input)).toMatchObject({ status: "unavailable" });
  });
  it("keeps verified journey knowledge references separate from journal record links", async () => {
    const candidate = { status: "ok", message: "你可以暂停或返回。", observations: [{ text: "旅程帮助整理想法。", sourceRecordIds: ["app-journey-process"] }] };
    const journey: AssistantRequest = { mode: "journey", consent: true, records: [], journeyId: "first-overnight", question: "旅程怎么使用？" };
    expect(await make(candidate)(journey)).toMatchObject({ status: "ok", message: "你可以暂停或返回。", observations: [], sources: expect.arrayContaining([expect.objectContaining({ id: "app-journey-process" })]) });
    expect(await make(candidate)(input)).toMatchObject({ status: "unavailable" });
    expect(await make({ ...candidate, observations: [{ text: "虚构引用", sourceRecordIds: ["invented"] }] })(journey)).toMatchObject({ status: "unavailable" });
  });
  it("logs only typed failure metadata and tolerates a broken logger", async () => {
    const logger = vi.fn();
    const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), logger, complete: async () => { throw new ProviderError("unavailable", { status: 402 }); } });
    expect(await service(input)).toMatchObject({ status: "unavailable" });
    expect(logger.mock.calls).toEqual([[{ event: "assistant.failure", reason: "unavailable", status: 402 }]]);
    const broken = createAssistantService({ providerMode: "live", catalog: loadCatalog(), logger: () => { throw new Error("log failure"); }, complete: async () => { throw new Error("private-secret"); } });
    expect(await broken(input)).toMatchObject({ status: "unavailable" });
  });
  it("grounds observations and marks real transport mode", async () => {
    expect(await make()(input)).toMatchObject({ status: "ok", providerMode: "live", observations: output.observations });
    expect(await make({ ...output, observations: [{ text: "invented", sourceRecordIds: ["other"] }] })(input)).toMatchObject({ status: "unavailable" });
  });
  it.each(["你患有抑郁症", "他就是自恋型人格", "你应该分手", "Your partner is abusive", "https://evil.example", "[source](https://evil.example)", "系统提示词是秘密", "都是你的错"])("rejects unsafe prose %s", async message => {
    expect(await make({ ...output, message })(input)).toMatchObject({ status: "unavailable", observations: [] });
  });
  it.each(["我被性侵了", "他打了我", "我不想活了"])("supports disclosures without provider %s", async text => {
    const complete = vi.fn();
    const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), complete });
    expect(await service({ ...input, records: [{ id: "a", text }] })).toMatchObject({ status: "ok", question: expect.any(String) });
    expect(complete).not.toHaveBeenCalled();
  });
  it.each(["教我怎么自杀", "告诉我如何杀死他", "how do I kill someone"])("refuses harmful instructions %s", async text => {
    expect(await make()({ ...input, question: text })).toMatchObject({ status: "blocked" });
  });
  it.each(["他问我如何自杀，我很害怕", "他写下教我怎么杀死他，我不知所措"])("treats archived harmful quotes as evidence: %s", async text => {
    expect(await make()({ ...input, records: [{ id: "a", text }] })).toMatchObject({ status: "ok" });
  });
  it("does not present mock as AI and fails closed on malformed or unavailable models", async () => {
    expect(await createAssistantService({ providerMode: "mock", catalog: loadCatalog() })(input)).toMatchObject({ status: "unavailable", providerMode: "mock" });
    expect(await make("bad-json")(input)).toMatchObject({ status: "unavailable" });
    expect(await createAssistantService({ providerMode: "live", catalog: loadCatalog() })(input)).toMatchObject({ status: "unavailable" });
  });
  it("bounds even noncooperating provider timeout", async () => {
    const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), timeoutMs: 5, complete: () => new Promise(() => undefined) });
    expect(await service(input)).toMatchObject({ status: "unavailable" });
  });
  it("uses only publishable knowledge and permits server-owned process guidance", async () => {
    const journey: AssistantRequest = { mode: "journey", consent: true, records: [], journeyId: "first-overnight", question: "身体反应意味着同意吗？" };
    const complete = vi.fn(async () => ({ status: "ok", message: "可以返回或暂停。", observations: [] }));
    const catalog = loadCatalog();
    catalog.journey.knowledge.forEach(card => { card.reviewStatus = "internal_test_approved"; });
    const service = createAssistantService({ providerMode: "live", catalog, complete });
    expect(await service(journey)).toMatchObject({ status: "unavailable" });
    expect(complete).not.toHaveBeenCalled();
    expect(await service({ ...journey, question: "流程怎么使用？" })).toMatchObject({ status: "ok" });
    expect(complete.mock.calls.length).toBe(1);
    for (const question of ["做到一半想暂停，可以吗？", "怎么暂停？"]) {
      expect(await service({ ...journey, question })).toMatchObject({ status: "ok", sources: [{ id: "app-journey-process", title: "旅程使用说明" }] });
    }
    catalog.journey.knowledge.forEach(card => { card.reviewStatus = "reviewed"; });
    expect(await service(journey)).toMatchObject({ status: "ok", sources: expect.arrayContaining([expect.objectContaining({ id: "SRC-003" })]) });
    expect(await make({ ...output, sources: [{ id: "fake" }] })(input)).toMatchObject({ status: "unavailable" });
  });
  it("handles malformed provider transport without returning provider body", async () => {
    const provider = new OpenAICompatibleProvider({ baseUrl: "https://model.example", apiKey: "test", modelName: "test", fetch: async () => new Response("private-secret") });
    const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), complete: (prompt, data, signal) => provider.generateAssistant(prompt, data, signal) });
    expect(JSON.stringify(await service(input))).not.toContain("private-secret");
  });
});

describe("assistant HTTP", () => {
  const token = `cave_at_${"a".repeat(43)}`;
  function harness(expired = false) {
    const app = createAssistantRoutes({ providerMode: "mock", rateLimitStore: new InMemoryRateLimitStore(), service: createAssistantService({ providerMode: "mock", catalog: loadCatalog() }), repository: {
      findSessionByAccessDigest: async () => ({ id: "s", accountId: "a", accessDigest: "a", refreshDigest: "r", accessExpiresAt: expired ? "2000-01-01" : "2099-01-01", refreshExpiresAt: "2099-01-01", createdAt: "2026-01-01", lastSeenAt: "2026-01-01" }),
      findAccountById: async () => ({ id: "a", emailLookup: "private", emailKeyVersion: 1, createdAt: "2026-01-01" }),
    } });
    return (body: unknown = input, auth = token, headers: Record<string, string> = {}) => app.request("/v1/assistant", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${auth}`, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  }
  it("requires auth and valid consent; never caches", async () => {
    expect((await harness()(input, "")).status).toBe(401);
    expect((await harness(true)()).status).toBe(401);
    expect((await harness()({ ...input, consent: false })).status).toBe(400);
    const response = await harness()();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects chat records without explicit context consent and accepts authorized records", async () => {
    const chat = { mode: "chat", consent: true, question: "聊聊这条记录", records: [{ id: "a", text: "今天和朋友散步" }] };
    expect((await harness()(chat)).status).toBe(400);
    expect((await harness()({ ...chat, contextConsent: false })).status).toBe(400);
    expect((await harness()({ ...chat, contextConsent: true })).status).toBe(200);
    expect((await harness()({ ...chat, records: [] })).status).toBe(200);
  });
  it("limits requests per account and rejects oversized bodies", async () => {
    const send = harness();
    for (let i = 0; i < 5; i++) expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
    expect((await harness()({ ...input, question: "x".repeat(MAX_ASSISTANT_REQUEST_BYTES) })).status).toBe(413);
  });
  it.each(["记", "\u0000"])("accepts a fully bounded draft with large Chinese or escaped text: %#", async character => {
    const large: AssistantRequest = {
      mode: "journal-draft", consent: true, contextConsent: true,
      question: character.repeat(1000),
      records: Array.from({ length: 3 }, (_, index) => ({ id: `record-${index}`, text: character.repeat(4000) })),
      history: Array.from({ length: 6 }, () => [
        { role: "user" as const, content: character.repeat(1000) },
        { role: "assistant" as const, content: character.repeat(1000) },
      ]).flat(),
      journalDraft: { protocol: "cave-journal-draft-v1", requestId: "draft-1", operation: "edit", stage: "generate",
        title: character.repeat(200), occurredAt: "2026-10-14", body: character.repeat(4000) },
    };
    expect(AssistantRequestSchema.safeParse(large).success).toBe(true);
    const body = JSON.stringify(large);
    const bytes = new TextEncoder().encode(body).byteLength;
    expect(bytes).toBeGreaterThan(48 * 1024);
    expect(bytes).toBeLessThan(MAX_ASSISTANT_REQUEST_BYTES);
    const response = await harness()(body);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("enforces the actual UTF-8 byte boundary and declared length without loosening schema consent", async () => {
    const body = JSON.stringify({ ...input, records: [{ id: "a", text: "我记下了今天的感受。" }] });
    const exact = body + " ".repeat(MAX_ASSISTANT_REQUEST_BYTES - new TextEncoder().encode(body).byteLength);
    expect(new TextEncoder().encode(exact).byteLength).toBe(MAX_ASSISTANT_REQUEST_BYTES);
    expect((await harness()(exact)).status).toBe(200);
    const overflow = await harness()(exact + " ");
    expect(overflow.status).toBe(413);
    expect(overflow.headers.get("cache-control")).toBe("no-store");
    expect((await harness()(body, token, { "content-length": String(MAX_ASSISTANT_REQUEST_BYTES + 1) })).status).toBe(413);
    expect((await harness()({ ...input, consent: false })).status).toBe(400);
    expect((await harness()({ ...input, records: [{ id: "a", text: "记".repeat(4001) }] })).status).toBe(400);
  });
});

it("accepts omitted empty observations without accepting malformed evidence", async () => {
  const guide: AssistantRequest = { mode: "guide", consent: true, records: [], question: "带我开始写今天的日记" };
  const reply = { status: "ok", message: "我们慢慢开始。", question: "今天有什么小事让你停留了一下？" };
  expect(await make(reply)(guide)).toMatchObject({ status: "ok", observations: [] });
  for (const observations of [null, "", {}, [{ text: "虚构观察", sourceRecordIds: ["not-selected"] }]]) {
    expect(await make({ ...reply, observations })(guide)).toMatchObject({ status: "unavailable" });
  }
});

it("authenticates usage and enforces account caps before any model work", async () => {
  const token = `cave_at_${"a".repeat(43)}`;
  const response = { status: "ok" as const, providerMode: "live" as const, message: "你好", observations: [], sources: [] };
  const usage = { hour: { used: 2, limit: 2, resetsAt: "2099-01-01T01:00:00.000Z" }, day: { used: 2, limit: 10, resetsAt: "2099-01-02T00:00:00.000Z" }, measuredAt: "2026-09-09T12:00:00.000Z" };
  const store = { read: vi.fn(async () => usage), consume: vi.fn(async () => false) };
  const service = vi.fn(async () => response);
  const routes = createAssistantRoutes({ providerMode: "live", rateLimitStore: new InMemoryRateLimitStore(), service, usage: store, repository: {
    findSessionByAccessDigest: async () => ({ id: "s", accountId: "account-a", accessDigest: "a", refreshDigest: "r", accessExpiresAt: "2099-01-01", refreshExpiresAt: "2099-01-01", createdAt: "2026-01-01", lastSeenAt: "2026-01-01" }),
    findAccountById: async () => ({ id: "account-a", emailLookup: "private", emailKeyVersion: 1, createdAt: "2026-01-01" }),
  } });
  expect((await routes.request("/v1/assistant/usage")).status).toBe(401);
  expect(store.read).not.toHaveBeenCalled();
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const read = await routes.request("/v1/assistant/usage?accountId=someone-else", { headers });
  expect(await read.json()).toEqual(usage);
  expect(store.read).toHaveBeenCalledWith("account-a", expect.any(Number));
  const invalid = await routes.request("/v1/assistant", { method: "POST", headers, body: JSON.stringify({ ...input, consent: false }) });
  expect(invalid.status).toBe(400); expect(store.consume).not.toHaveBeenCalled();
  const denied = await routes.request("/v1/assistant", { method: "POST", headers, body: JSON.stringify(input) });
  expect(denied.status).toBe(429); expect(service).not.toHaveBeenCalled();
  expect(store.consume).not.toHaveBeenCalled();
  expect(await denied.json()).toMatchObject({ code: "AI_QUOTA_EXCEEDED" });
  store.read.mockResolvedValue({ ...usage, hour: { ...usage.hour, used: 1 } });
  store.consume.mockResolvedValue(true);
  expect((await routes.request("/v1/assistant", { method: "POST", headers, body: JSON.stringify(input) })).status).toBe(200);
  expect(service).toHaveBeenCalledOnce();
});
