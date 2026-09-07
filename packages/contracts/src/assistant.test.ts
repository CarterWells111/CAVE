import { expect, it } from "vitest";
import { AssistantRequestSchema, AssistantResponseSchema } from "./index";
it("requires per-request consent, selected records and bounded distinct IDs", () => {
  const valid = { mode: "summarize", consent: true, records: [{ id: "a", text: "today" }] };
  expect(AssistantRequestSchema.safeParse(valid).success).toBe(true);
  for (const changes of [{ consent: false }, { records: [] }, { records: [valid.records[0], valid.records[0]] }, { records: [{ id: "a", text: "x".repeat(4001) }] }, { accountId: "other" }])
    expect(AssistantRequestSchema.safeParse({ ...valid, ...changes }).success).toBe(false);
  expect(AssistantRequestSchema.safeParse({ mode: "journey", consent: true, records: [], question: "怎么使用？", journeyId: "first-overnight" }).success).toBe(true);
  expect(AssistantRequestSchema.safeParse({ ...valid, mode: "journey", question: "?", journeyId: "first-overnight" }).success).toBe(false);
});
it("bounds response observations and disallows unsafe source URLs", () => {
  const valid = { status: "ok", message: "hi", observations: [], sources: [], providerMode: "live" };
  expect(AssistantResponseSchema.safeParse(valid).success).toBe(true);
  expect(AssistantResponseSchema.safeParse({ ...valid, sources: [{ id: "a", title: "x", url: "javascript:alert(1)" }] }).success).toBe(false);
});
