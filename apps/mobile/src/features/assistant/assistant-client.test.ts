import { createAssistantClient, previewAssistant, fetchAssistantUsage } from "./assistant-client";

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
