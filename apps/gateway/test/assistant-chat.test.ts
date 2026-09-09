import { expect, it, vi } from "vitest";
import { loadCatalog } from "@cave/content";
import { createAssistantService } from "../src/services/assistant";
import { CHAT_PROMPT } from "../src/services/assistant-chat";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible";
it.each(["今天想聊聊电影", "我感觉很羞耻", "如何帮助有自杀念头的朋友？", "避孕有哪些常见方式？"])("allows contextual conversation without broad keyword rejection: %s", async question => {
  const chat = vi.fn(async () => "可以，我们慢慢聊。");
  const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), chat });
  expect(await service({ mode: "chat", consent: true, records: [], question })).toMatchObject({ status: "ok", message: "可以，我们慢慢聊。" });
  expect(chat).toHaveBeenCalledOnce();
});
it("sends recent turns as user/assistant roles while keeping safety in system instructions", async () => {
  let body: Record<string, unknown> = {};
  const provider = new OpenAICompatibleProvider({ baseUrl: "https://model.example", apiKey: "test", modelName: "test", fetch: async (_url, options) => {
    body = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: "刚才你提到散步，后来感觉怎么样？" } }] }));
  } });
  const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), chat: (prompt, messages, signal) => provider.generateChat(prompt, messages, signal) });
  const result = await service({ mode: "chat", consent: true, records: [], question: "接着聊", history: [{ role: "user", content: "我去散步了" }, { role: "assistant", content: "那时有什么感受？" }] });
  expect(result.status).toBe("ok");
  expect(body.messages).toEqual([{ role: "system", content: CHAT_PROMPT }, { role: "user", content: "我去散步了" }, { role: "assistant", content: "那时有什么感受？" }, { role: "user", content: "接着聊" }]);
  expect(CHAT_PROMPT).toContain("Refuse only the part");
  expect(CHAT_PROMPT).toContain("Never encourage suicide");
});
it("returns safe fallback for empty, oversize and failed responses", async () => {
  for (const value of ["", "a".repeat(2001), { message: "not plain text" }]) {
    const service = createAssistantService({ providerMode: "live", catalog: loadCatalog(), chat: async () => value });
    expect((await service({ mode: "chat", consent: true, records: [], question: "你好" })).status).toBe("unavailable");
  }
});
