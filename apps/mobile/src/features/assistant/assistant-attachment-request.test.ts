import type { AssistantResponse } from "@cave/contracts";
import { createAttachmentChatRequest } from "./assistant-attachment-request";

const response: AssistantResponse = { status: "ok", providerMode: "live", message: "回应", observations: [], sources: [] };

test("keeps the actual question separate and adds explicit context consent only for attachments", () => {
  const request = createAttachmentChatRequest({ question: "优化这一段", turns: [], instruction: "生成手记草稿", records: [{ id: "mine", text: "原文" }] });
  expect(request).toMatchObject({ question: "优化这一段", contextConsent: true, records: [{ id: "mine", text: "原文" }], history: [{ role: "user", content: "生成手记草稿" }] });
  expect(createAttachmentChatRequest({ question: "你好", turns: [] })).not.toHaveProperty("contextConsent");
});

test("retains the newest complete turns when a generation instruction uses a history slot", () => {
  const turns = Array.from({ length: 6 }, (_, index) => ({ question: `问${index}`, response }));
  const request = createAttachmentChatRequest({ question: "继续", turns, instruction: "草稿协议" });
  expect(request.history).toHaveLength(11);
  expect(request.history?.[1]).toEqual({ role: "user", content: "问1" });
  expect(request.history?.at(-2)).toEqual({ role: "user", content: "问5" });
});

test("trims history against the combined character bound, preserving instruction and latest turn", () => {
  const turns = Array.from({ length: 6 }, (_, index) => ({ question: `${index}${"问".repeat(999)}`, response: { ...response, message: "答".repeat(2000) } }));
  const request = createAttachmentChatRequest({ question: "继续", turns, instruction: "规".repeat(2000) });
  expect(request.history?.reduce((total, item) => total + item.content.length, 0)).toBeLessThanOrEqual(12000);
  expect(request.history?.at(-2)?.content).toBe(turns.at(-1)?.question);
});

test("rejects invalid or oversized attachments instead of silently dropping them", () => {
  expect(() => createAttachmentChatRequest({ question: "优化", turns: [], records: [{ id: "same", text: "一" }, { id: "same", text: "二" }] })).toThrow();
  expect(() => createAttachmentChatRequest({ question: "优化", turns: [], records: [{ id: "long", text: "字".repeat(4001) }] })).toThrow();
  expect(() => createAttachmentChatRequest({ question: "优化", turns: [], instruction: "字".repeat(2001) })).toThrow("assistant-instruction-too-long");
});
