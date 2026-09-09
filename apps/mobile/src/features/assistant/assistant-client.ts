import { AssistantRequestSchema, AssistantResponseSchema, AssistantUsageSchema, type AssistantUsage, type AssistantRequest, type AssistantResponse } from "@cave/contracts";

export type AssistantRequester = (input: AssistantRequest, signal: AbortSignal) => Promise<AssistantResponse>;

export class AssistantClientError extends Error {
  constructor(readonly code: "quota-exceeded" | "configuration" | "invalid-input" | "network" | "unauthorized" | "rate-limit" | "invalid-response" | "cancelled") {
    super(code);
    this.name = "AssistantClientError";
  }
}

export function createAssistantClient(options: {
  baseUrl: string; getAccessToken(): Promise<string>; fetch?: typeof globalThis.fetch; timeoutMs?: number;
}): AssistantRequester {
  return async (input, signal) => {
    const parsed = AssistantRequestSchema.safeParse(input);
    if (!parsed.success) throw new AssistantClientError("invalid-input");
    const url = new URL(options.baseUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new AssistantClientError("configuration");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, options.timeoutMs ?? 35_000);
    try {
      if (signal.aborted) throw new AssistantClientError("cancelled");
      const token = await options.getAccessToken();
      if (signal.aborted || controller.signal.aborted) throw new AssistantClientError("cancelled");
      const response = await (options.fetch ?? globalThis.fetch)(`${options.baseUrl.replace(/\/+$/u, "")}/v1/assistant`, {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`,
          ...(__DEV__ && /^[a-f0-9-]{36}$/u.test(process.env.EXPO_PUBLIC_AI_MEASUREMENT_ID ?? "")
            ? { "X-Cave-Measurement-Id": process.env.EXPO_PUBLIC_AI_MEASUREMENT_ID! } : {}) },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 429) {
        const failure = await response.text();
        if (failure.length < 4000 && /"code"\s*:\s*"AI_QUOTA_EXCEEDED"/.test(failure)) throw new AssistantClientError("quota-exceeded");
      }
      if (!response.ok) throw new AssistantClientError(response.status === 401 ? "unauthorized" : response.status === 429 ? "rate-limit" : "network");
      const body = await response.text();
      if (body.length > 24_000) throw new AssistantClientError("invalid-response");
      const result = AssistantResponseSchema.safeParse(JSON.parse(body));
      if (!result.success) throw new AssistantClientError("invalid-response");
      const ids = new Set(input.records.map(record => record.id));
      if (result.data.observations.some(observation => observation.sourceRecordIds.some(id => !ids.has(id)))) throw new AssistantClientError("invalid-response");
      if (signal.aborted) throw new AssistantClientError("cancelled");
      return result.data;
    } catch (error) {
      if (signal.aborted) throw new AssistantClientError("cancelled");
      if (error instanceof AssistantClientError) throw error;
      throw new AssistantClientError("network");
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
  };
}

// Explicit local development preview: no fetch, no key, no cloud processing.
// Gateway safety and provider behavior are tested independently with synthetic fixtures.
export const previewAssistant: AssistantRequester = async (input, signal) => {
  AssistantRequestSchema.parse(input);
  if (signal.aborted) throw new AssistantClientError("cancelled");
  const result: AssistantResponse = {
    status: "ok", providerMode: "mock", message: "这是本机模拟预览，用于检查操作流程；没有调用 DeepSeek。", observations: [], sources: [],
  };
  if (input.mode === "chat") result.message = "这是本机模拟，没有调用真实 AI。今天想聊点什么？我在这里听你说。";
  if (input.mode === "guide") result.question = "当时有没有一个让你舒服或不舒服的细节，想再记一点？也可以暂时说不清。";
  if (input.mode === "summarize" || input.mode === "review") {
    result.summary = "模拟小结：请用自己的话保留这次最想记住的部分。这里不会推断你的经历或关系。";
    result.observations = input.records.map(record => ({ text: "这条记录可以作为回顾的起点；模拟模式不分析内容。", sourceRecordIds: [record.id] })).slice(0, 6);
  }
  if (input.mode === "journey") result.message += " 旅程支持暂停、返回修改和改变主意，沟通练习使用预设分支。真实问答需要接通服务端。";
  return AssistantResponseSchema.parse(result);
};

export async function fetchAssistantUsage(options: { baseUrl: string; getAccessToken(): Promise<string>; signal: AbortSignal; fetch?: typeof globalThis.fetch }): Promise<AssistantUsage> {
  const url = new URL(options.baseUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new AssistantClientError("configuration");
  const token = await options.getAccessToken();
  if (options.signal.aborted) throw new AssistantClientError("cancelled");
  const response = await (options.fetch ?? globalThis.fetch)(`${options.baseUrl.replace(/\/+$/u, "")}/v1/assistant/usage`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: options.signal,
  });
  if (!response.ok) throw new AssistantClientError(response.status === 401 ? "unauthorized" : "network");
  const text = await response.text();
  if (text.length > 4000) throw new AssistantClientError("invalid-response");
  const parsed = AssistantUsageSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new AssistantClientError("invalid-response");
  return parsed.data;
}
