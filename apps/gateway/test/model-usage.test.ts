import { expect, it } from "vitest";
import { OpenAICompatibleProvider, type ProviderLogEntry } from "../src/providers/openai-compatible";

it.each([true, false])("records only token counters even when content validity is %s", async valid => {
  const entries: ProviderLogEntry[] = [];
  const provider = new OpenAICompatibleProvider({
    baseUrl: "https://model.example", apiKey: "secret-canary", modelName: "test",
    logger: entry => { entries.push(entry); },
    fetch: async () => new Response(JSON.stringify({
      choices: valid ? [{ message: { content: "private-reply-canary" } }] : [],
      usage: { prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 60, prompt_cache_miss_tokens: 40, private: "private-usage-canary" }
    }))
  });
  await provider.generateChat("private-prompt-canary", [{ role: "user", content: "private-user-canary" }], new AbortController().signal).catch(() => undefined);
  expect(entries.filter(entry => entry.event === "model.usage")).toEqual([expect.objectContaining({
    model: "test", usage: { prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 60, prompt_cache_miss_tokens: 40 }
  })]);
  expect(JSON.stringify(entries)).not.toContain("canary");
});

it.each([undefined, { prompt_tokens: -1, completion_tokens: 20 }])("does not invent usage when missing or malformed", async usage => {
  const entries: ProviderLogEntry[] = [];
  const provider = new OpenAICompatibleProvider({
    baseUrl: "https://model.example", apiKey: "secret", modelName: "test",
    logger: entry => { entries.push(entry); },
    fetch: async () => new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }], usage }))
  });
  expect(await provider.generateChat("hello", [], new AbortController().signal)).toBe("hello");
  expect(entries.some(entry => entry.event === "model.usage")).toBe(false);
});
