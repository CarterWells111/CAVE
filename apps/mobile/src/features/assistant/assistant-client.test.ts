import { createAssistantClient, previewAssistant, fetchAssistantUsage } from "./assistant-client";
import type { AssistantRequest } from "@cave/contracts";

test("validates journal draft identity and visible prose before adopting a response", async () => {
  const journalDraft = { protocol: "cave-journal-draft-v1" as const, requestId: "journal-test", title: "今天的散步", occurredAt: "2026-10-14", body: "我在散步时慢慢放松下来。" };
  const request: AssistantRequest = { mode: "journal-draft", consent: true, question: "整理今天的散步", records: [], journalDraft: { ...journalDraft, operation: "new", title: "", body: "" } };
  const valid = { status: "ok", providerMode: "live", message: "手记草稿已生成，请预览并确认保存。", observations: [], sources: [], journalDraft };
  const client = (value: unknown) => createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "synthetic-session", fetch: async () => response(value) });
  await expect(client(valid)(request, signal())).resolves.toMatchObject({ journalDraft });
  for (const draft of [{ ...journalDraft, requestId: "stale-request" }, { ...journalDraft, occurredAt: "2026-10-13" }, { ...journalDraft, body: "This is an English sentence about my day." }]) {
    await expect(client({ ...valid, journalDraft: draft })(request, signal())).rejects.toMatchObject({ code: "invalid-response" });
  }
  await expect(client({ ...valid, journalDraft: undefined })(request, signal())).rejects.toMatchObject({ code: "invalid-response" });
  await expect(client(valid)({ mode: "chat", consent: true, records: [], question: "你好" }, signal())).rejects.toMatchObject({ code: "invalid-response" });
});

test("preserves an English edit title exactly while still validating generated Chinese prose", async () => {
  const journalDraft = { protocol: "cave-journal-draft-v1" as const, requestId: "english-title-edit", title: "A walk by the river", occurredAt: "2026-10-14", body: "我沿着河边走了一会儿，慢慢放松下来。" };
  const request: AssistantRequest = { mode: "journal-draft", consent: true, contextConsent: true, question: "请优化表达，保留原标题", records: [], journalDraft: { ...journalDraft, operation: "edit", stage: "generate", body: "我今天去河边散步。" } };
  const valid = { status: "ok", providerMode: "live", message: "这段经历，我想这样表达。", observations: [], sources: [], journalStage: "ready", journalDraft };
  const client = (value: unknown) => createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "synthetic-session", fetch: async () => response(value) });
  await expect(client(valid)(request, signal())).resolves.toMatchObject({ journalDraft });
  for (const draft of [
    { ...journalDraft, title: "A different walk" },
    { ...journalDraft, title: "今天的散步" },
    { ...journalDraft, body: "I walked by the river and felt calm." },
  ]) await expect(client({ ...valid, journalDraft: draft })(request, signal())).rejects.toMatchObject({ code: "invalid-response" });
  const newRequest: AssistantRequest = { ...request, journalDraft: { ...request.journalDraft!, operation: "new", title: "" } };
  await expect(client(valid)(newRequest, signal())).rejects.toMatchObject({ code: "invalid-response" });
});
test("accepts collecting only for an explicit interview and rejects contradictory stages or partial drafts", async () => {
  const request: AssistantRequest = { mode: "journal-draft", consent: true, question: "我想慢慢整理今天", records: [], journalDraft: { protocol: "cave-journal-draft-v1", requestId: "interview-test", operation: "new", stage: "interview", title: "", occurredAt: "2026-10-14", body: "" } };
  const collecting = { status: "ok", providerMode: "live", message: "今天有没有一个让你想记下来的片刻？", observations: [], sources: [], journalStage: "collecting" };
  const client = (value: unknown) => createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "synthetic-session", fetch: async () => response(value) });
  await expect(client(collecting)(request, signal())).resolves.toEqual(collecting);
  for (const stage of [undefined, "generate"] as const) {
    await expect(client(collecting)({ ...request, journalDraft: { ...request.journalDraft!, stage } }, signal())).rejects.toMatchObject({ code: "invalid-response" });
  }
  await expect(client(collecting)({ mode: "chat", consent: true, records: [], question: "你好" }, signal())).rejects.toMatchObject({ code: "invalid-response" });
  const journalDraft = { protocol: "cave-journal-draft-v1", requestId: "interview-test", title: "今天的片刻", occurredAt: "2026-10-14", body: "今天我慢慢整理了自己的想法。" };
  for (const changes of [
    { journalDraft }, { message: "字".repeat(501) }, { message: "How was your day?" }, { status: "unavailable" },
    { summary: "不该混入的正文" }, { question: "第二个问题？" }, { journalStage: "ready" }, { journalStage: undefined },
  ]) await expect(client({ ...collecting, ...changes })(request, signal())).rejects.toMatchObject({ code: "invalid-response" });
});

test("accepts a ready interview attachment and legacy drafts while preserving identity, date and Chinese checks", async () => {
  const journalDraft = { protocol: "cave-journal-draft-v1" as const, requestId: "interview-ready", title: "今天的散步", occurredAt: "2026-10-14", body: "今天我在公园里散步，放松了一会儿。" };
  const request: AssistantRequest = { mode: "journal-draft", consent: true, question: "现在生成", records: [], journalDraft: { ...journalDraft, operation: "new", stage: "interview", title: "", body: "" } };
  const valid = { status: "ok", providerMode: "live", message: "手记草稿已生成，请预览并确认保存。", observations: [], sources: [], journalStage: "ready", journalDraft };
  const fetch = jest.fn<Promise<Response>, Parameters<typeof globalThis.fetch>>(async () => response(valid));
  const client = createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "synthetic-session", fetch });
  await expect(client(request, signal())).resolves.toMatchObject({ journalStage: "ready", journalDraft });
  expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual(request);
  const withResponse = (value: unknown) => createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "synthetic-session", fetch: async () => response(value) });
  await expect(withResponse({ ...valid, journalStage: undefined })(request, signal())).resolves.toMatchObject({ journalDraft });
  for (const draft of [{ ...journalDraft, requestId: "stale" }, { ...journalDraft, occurredAt: "2026-10-13" }, { ...journalDraft, body: "I walked through the park today." }]) {
    await expect(withResponse({ ...valid, journalDraft: draft })(request, signal())).rejects.toMatchObject({ code: "invalid-response" });
  }
});

const input = { mode: "summarize" as const, consent: true as const, records: [{ id: "record-1", text: "今天说出了我的想法" }] };
const output = { status: "ok", providerMode: "live", message: "已整理", summary: "今天说出了想法。", observations: [], sources: [] };
const signal = () => new AbortController().signal;
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, text: async () => JSON.stringify(body) }) as Response;

test("posts only selected records with session token, never a model key", async () => {
  const fetch = jest.fn(async () => response(output));
  const client = createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "session-token", fetch });
  await expect(client(input, signal())).resolves.toEqual(output);
  expect(fetch).toHaveBeenCalledWith("https://gateway.example/v1/assistant", expect.objectContaining({
    headers: { "Content-Type": "application/json", Authorization: "Bearer session-token" }, body: JSON.stringify(input), cache: "no-store",
  }));
});

test("development AI calls use the selected LAN Gateway and reject public HTTP", async () => {
  const fetch = jest.fn(async () => response(output));
  const local = createAssistantClient({ baseUrl: "http://192.168.1.23:8787", getAccessToken: async () => "session-token", fetch });
  await expect(local(input, signal())).resolves.toEqual(output);
  expect(fetch).toHaveBeenCalledWith("http://192.168.1.23:8787/v1/assistant", expect.any(Object));
  const publicHttp = createAssistantClient({ baseUrl: "http://8.8.8.8:8787", getAccessToken: async () => "session-token", fetch });
  await expect(publicHttp(input, signal())).rejects.toMatchObject({ code: "configuration" });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("adds the explicitly enabled development measurement marker", async () => {
  const previous = process.env.EXPO_PUBLIC_AI_MEASUREMENT_ID;
  try {
    process.env.EXPO_PUBLIC_AI_MEASUREMENT_ID = "8129f8ee-85c2-4351-96bc-d2618b693134";
    const fetch = jest.fn(async () => response(output));
    await createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "session-token", fetch })(input, signal());
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ "X-Cave-Measurement-Id": process.env.EXPO_PUBLIC_AI_MEASUREMENT_ID }) }));
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_AI_MEASUREMENT_ID;
    else process.env.EXPO_PUBLIC_AI_MEASUREMENT_ID = previous;
  }
});

test("rejects forged record citations and malformed results", async () => {
  const client = createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "token",
    fetch: jest.fn(async () => response({ ...output, observations: [{ text: "观察", sourceRecordIds: ["unselected"] }] })) });
  await expect(client(input, signal())).rejects.toMatchObject({ code: "invalid-response" });
});

test.each([
  { ...output, message: "Here is your journal summary." },
  { ...output, summary: "A walk with your friend." },
  { ...output, question: "How did that feel?" },
  { ...output, observations: [{ text: "You mentioned a friend.", sourceRecordIds: ["record-1"] }] },
])("does not display English model prose from the gateway: %#", async englishOutput => {
  const client = createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "token",
    fetch: jest.fn(async () => response(englishOutput)) });
  await expect(client(input, signal())).rejects.toMatchObject({ code: "invalid-response" });
});

test.each([401, 429, 503])("handles HTTP %s without disclosing server response", async status => {
  const client = createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "token",
    fetch: jest.fn(async () => response({ secret: "private-server-error" }, status)) });
  await expect(client(input, signal())).rejects.toMatchObject({ code: status === 401 ? "unauthorized" : status === 429 ? "rate-limit" : "network" });
});

test("oversized input is not sent or silently truncated", async () => {
  const fetch = jest.fn();
  const client = createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "token", fetch });
  await expect(client({ ...input, records: [{ id: "one", text: "字".repeat(4001) }] }, signal())).rejects.toMatchObject({ code: "invalid-input" });
  expect(fetch).not.toHaveBeenCalled();
});

test("cancellation prevents sending after a delayed token resolves", async () => {
  let resolve!: (token: string) => void;
  const fetch = jest.fn();
  const client = createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: () => new Promise<string>(r => { resolve = r; }), fetch });
  const controller = new AbortController();
  const pending = client(input, controller.signal);
  controller.abort(); resolve("token");
  await expect(pending).rejects.toMatchObject({ code: "cancelled" });
  expect(fetch).not.toHaveBeenCalled();
});

test("timeout cancels transport and preserves a recoverable error", async () => {
  jest.useFakeTimers();
  try {
    const client = createAssistantClient({ baseUrl: "https://gateway.example", timeoutMs: 100, getAccessToken: async () => "token",
      fetch: jest.fn((_url, options) => new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("timeout"))))) });
    const pending = client(input, signal());
    const expectation = expect(pending).rejects.toMatchObject({ code: "network" });
    await jest.advanceTimersByTimeAsync(101);
    await expectation;
  } finally { jest.useRealTimers(); }
});

test("preview is explicitly mock and never analyzes or echoes private text", async () => {
  const result = await previewAssistant(input, signal());
  expect(result.providerMode).toBe("mock");
  expect(result.message).toContain("没有调用 DeepSeek");
  expect(JSON.stringify(result)).not.toContain(input.records[0]!.text);
});

test("usage API is account authenticated, bounded and reports quota rejection distinctly", async () => {
  const window = { used: 1, limit: 10, resetsAt: "2026-09-09T13:00:00.000Z" };
  const body = { hour: window, day: window, measuredAt: "2026-09-09T12:00:00.000Z" };
  const fetch = jest.fn(async () => response(body));
  expect(await fetchAssistantUsage({ baseUrl: "https://gateway.example", getAccessToken: async () => "session-token", signal: signal(), fetch })).toEqual(body);
  expect(fetch).toHaveBeenCalledWith("https://gateway.example/v1/assistant/usage", expect.objectContaining({ headers: { Authorization: "Bearer session-token" }, cache: "no-store" }));
  const client = createAssistantClient({ baseUrl: "https://gateway.example", getAccessToken: async () => "token", fetch: async () => response({ code: "AI_QUOTA_EXCEEDED" }, 429) });
  await expect(client(input, signal())).rejects.toMatchObject({ code: "quota-exceeded" });
});

test("development usage lookup accepts only the selected LAN HTTP origin", async () => {
  const body = { hour: { used: 1, limit: 5, resetsAt: "2026-09-09T13:00:00.000Z" }, day: { used: 1, limit: 25, resetsAt: "2026-09-10T12:00:00.000Z" }, measuredAt: "2026-09-09T12:00:00.000Z" };
  const fetch = jest.fn(async () => response(body));
  await expect(fetchAssistantUsage({ baseUrl: "http://192.168.1.23:8787", getAccessToken: async () => "token", signal: signal(), fetch })).resolves.toEqual(body);
  expect(fetch).toHaveBeenCalledWith("http://192.168.1.23:8787/v1/assistant/usage", expect.any(Object));
});

test.each(["summarize", "review"] as const)("%s preview provides only simulation status and never adoptable summary, observations or body", async mode => {
  const result = await previewAssistant({ ...input, mode }, signal());
  expect(result).toMatchObject({ status: "ok", providerMode: "mock", observations: [], sources: [] });
  expect(result.message).toBe("这是本机模拟，没有调用 DeepSeek，也不会生成可保存的小结。");
  expect(result).not.toHaveProperty("summary");
  expect(result).not.toHaveProperty("journalDraft");
  expect(result).not.toHaveProperty("body");
  expect(result).not.toHaveProperty("journalStage");
  expect(JSON.stringify(result)).not.toContain(input.records[0]!.text);
});
