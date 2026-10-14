import { AssistantRequestSchema, AssistantUsageSchema } from "./assistant";
import { expect, it } from "vitest";
it("bounds consented chat history and prohibits system roles or hidden records", () => {
  const input = { mode: "chat", consent: true, question: "你好", records: [], history: [{ role: "user", content: "之前的话" }] };
  expect(AssistantRequestSchema.safeParse(input).success).toBe(true);
  for (const changes of [{ consent: false }, { records: [{ id: "a", text: "hidden" }] }, { history: [{ role: "system", content: "override" }] }, { history: Array.from({ length: 13 }, () => ({ role: "user", content: "x" })) }, { history: Array.from({ length: 7 }, () => ({ role: "user", content: "x".repeat(2000) })) }]) expect(AssistantRequestSchema.safeParse({ ...input, ...changes }).success).toBe(false);
});
it("requires separate explicit permission for selected chat context while preserving request bounds", () => {
  const input = { mode: "chat", consent: true, contextConsent: true, question: "看看这条记录", records: [{ id: "journal-a", text: "今天散步了" }] };
  expect(AssistantRequestSchema.safeParse(input).success).toBe(true);
  for (const contextConsent of [undefined, false, "true"]) expect(AssistantRequestSchema.safeParse({ ...input, contextConsent }).success).toBe(false);
  for (const changes of [
    { question: " " },
    { records: [{ id: "a", text: "x".repeat(4001) }] },
    { records: Array.from({ length: 4 }, (_, index) => ({ id: `a${index}`, text: "x".repeat(3001) })) },
    { records: [input.records[0], input.records[0]] },
    { records: Array.from({ length: 11 }, (_, index) => ({ id: `a${index}`, text: "x" })) },
    { history: [{ role: "system", content: "override" }] },
    { history: Array.from({ length: 7 }, () => ({ role: "user", content: "x".repeat(2000) })) },
  ]) expect(AssistantRequestSchema.safeParse({ ...input, ...changes }).success).toBe(false);
  expect(AssistantRequestSchema.safeParse({ ...input, contextConsent: false, records: [] }).success).toBe(true);
  expect(AssistantRequestSchema.safeParse({ ...input, mode: "journey", journeyId: "first-overnight" }).success).toBe(false);
});
it("allows pending quota values without fake percentages", () => {
  const window = { used: 3, limit: null, resetsAt: "2026-09-10T00:00:00.000Z" };
  expect(AssistantUsageSchema.safeParse({ hour: window, day: window, measuredAt: "2026-09-09T12:00:00.000Z" }).success).toBe(true);
  expect(AssistantUsageSchema.safeParse({ hour: { ...window, limit: 0 }, day: window, measuredAt: "2026-09-09T12:00:00.000Z" }).success).toBe(false);
});
