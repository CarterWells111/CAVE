import { AssistantRequestSchema, AssistantUsageSchema } from "./assistant";
import { expect, it } from "vitest";
it("bounds consented chat history and prohibits system roles or hidden records", () => {
  const input = { mode: "chat", consent: true, question: "你好", records: [], history: [{ role: "user", content: "之前的话" }] };
  expect(AssistantRequestSchema.safeParse(input).success).toBe(true);
  for (const changes of [{ consent: false }, { records: [{ id: "a", text: "hidden" }] }, { history: [{ role: "system", content: "override" }] }, { history: Array.from({ length: 13 }, () => ({ role: "user", content: "x" })) }, { history: Array.from({ length: 7 }, () => ({ role: "user", content: "x".repeat(2000) })) }]) expect(AssistantRequestSchema.safeParse({ ...input, ...changes }).success).toBe(false);
});
it("allows pending quota values without fake percentages", () => {
  const window = { used: 3, limit: null, resetsAt: "2026-09-10T00:00:00.000Z" };
  expect(AssistantUsageSchema.safeParse({ hour: window, day: window, measuredAt: "2026-09-09T12:00:00.000Z" }).success).toBe(true);
  expect(AssistantUsageSchema.safeParse({ hour: { ...window, limit: 0 }, day: window, measuredAt: "2026-09-09T12:00:00.000Z" }).success).toBe(false);
});
