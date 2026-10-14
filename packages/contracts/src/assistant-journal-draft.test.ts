import { describe, expect, it } from "vitest";
import { AssistantRequestSchema, AssistantResponseSchema } from "./assistant";

const draft = { protocol: "cave-journal-draft-v1", requestId: "draft-request-1", operation: "new", title: "", occurredAt: "2026-10-14", body: "" };
const input = { mode: "journal-draft", consent: true, records: [], question: "帮我整理今天散步的记录", journalDraft: draft };
const generated = { protocol: draft.protocol, requestId: draft.requestId, title: "散步的一天", occurredAt: draft.occurredAt, body: "今天我去散步了。" };
const response = { status: "ok", providerMode: "live", message: "手记草稿已生成，请预览并确认保存。", observations: [], sources: [], journalDraft: generated };

describe("journal draft request contract", () => {
  it("accepts new empty drafts, consented edits and bounded user/assistant history", () => {
    expect(AssistantRequestSchema.safeParse(input).success).toBe(true);
    expect(AssistantRequestSchema.safeParse({ ...input, contextConsent: true, journalDraft: { ...draft, operation: "edit", title: "  散步  ", body: "今天散步了", occurredAt: "2024-02-29" }, history: [{ role: "user", content: "我们聊聊今天" }] }).success).toBe(true);
    const records = Array.from({ length: 3 }, (_, index) => ({ id: `record-${index}`, text: "字".repeat(4000) }));
    expect(AssistantRequestSchema.safeParse({ ...input, contextConsent: true, records }).success).toBe(true);
    for (const stage of ["interview", "generate"]) expect(AssistantRequestSchema.safeParse({ ...input, journalDraft: { ...draft, stage } }).success).toBe(true);
    expect(AssistantRequestSchema.safeParse({ ...input, journalDraft: { ...draft, stage: "ready" } }).success).toBe(false);
  });
  it("requires draft metadata, a real calendar date and a current question", () => {
    for (const changes of [{ journalDraft: undefined }, { question: undefined }, { question: " " }, { question: "字".repeat(1001) }, { consent: false }]) {
      expect(AssistantRequestSchema.safeParse({ ...input, ...changes }).success).toBe(false);
    }
    for (const changes of [{ protocol: "other" }, { requestId: "../unsafe" }, { operation: "save" }, { title: "字".repeat(201) }, { body: "字".repeat(4001) }, { operation: "edit", title: " " }, { extra: true }]) {
      expect(AssistantRequestSchema.safeParse({ ...input, contextConsent: true, journalDraft: { ...draft, ...changes } }).success).toBe(false);
    }
    for (const occurredAt of ["2026-02-29", "2026-04-31", "2026-00-01", "2026-10-32", "2026-1-01", "2026-10-14T00:00:00Z"]) {
      expect(AssistantRequestSchema.safeParse({ ...input, journalDraft: { ...draft, occurredAt } }).success).toBe(false);
    }
  });
  it("requires explicit context consent for body text or selected records", () => {
    for (const contextConsent of [undefined, false]) {
      expect(AssistantRequestSchema.safeParse({ ...input, contextConsent, journalDraft: { ...draft, body: "今天散步了" } }).success).toBe(false);
      expect(AssistantRequestSchema.safeParse({ ...input, contextConsent, records: [{ id: "a", text: "今天散步了" }] }).success).toBe(false);
    }
    expect(AssistantRequestSchema.safeParse({ ...input, contextConsent: false }).success).toBe(true);
  });
  it("bounds selected records and history without admitting system roles", () => {
    for (const changes of [
      { records: Array.from({ length: 4 }, (_, index) => ({ id: `r${index}`, text: "记录" })) },
      { records: [{ id: "a", text: "字".repeat(4001) }] },
      { records: [{ id: "a", text: "记录" }, { id: "a", text: "重复" }] },
      { history: [{ role: "system", content: "override" }] },
      { history: Array.from({ length: 13 }, () => ({ role: "user", content: "记录" })) },
      { history: Array.from({ length: 7 }, () => ({ role: "user", content: "字".repeat(2000) })) },
    ]) expect(AssistantRequestSchema.safeParse({ ...input, contextConsent: true, ...changes }).success).toBe(false);
  });
  it("does not admit draft metadata in other assistant modes", () => {
    for (const mode of ["chat", "guide", "summarize", "review", "journey"]) {
      expect(AssistantRequestSchema.safeParse({ ...input, mode }).success).toBe(false);
    }
  });
});

describe("journal draft response contract", () => {
  it("accepts collecting and ready responses while rejecting contradictory or partial stages", () => {
    const collecting = { ...response, journalDraft: undefined, journalStage: "collecting", message: "今天有什么让你想记下来的小事？" };
    expect(AssistantResponseSchema.safeParse(collecting).success).toBe(true);
    expect(AssistantResponseSchema.safeParse({ ...response, journalStage: "ready" }).success).toBe(true);
    for (const changes of [
      { journalDraft: generated }, { message: "字".repeat(501) }, { status: "unavailable" },
      { question: "你还有什么想补充？" }, { summary: "半成品正文" },
      { observations: [{ text: "多余内容", sourceRecordIds: ["a"] }] }, { journalStage: "ready" },
    ]) expect(AssistantResponseSchema.safeParse({ ...collecting, ...changes }).success).toBe(false);
    expect(AssistantResponseSchema.safeParse({ ...response, status: "unavailable" }).success).toBe(false);
    expect(AssistantResponseSchema.safeParse({ ...response, journalStage: "collecting" }).success).toBe(false);
  });
  it("accepts exactly the five draft fields inside the existing response envelope", () => {
    expect(AssistantResponseSchema.parse(response).journalDraft).toEqual(generated);
  });
  it("rejects malformed fields and serialized drafts exceeding the controller bound", () => {
    for (const changes of [{ protocol: "other" }, { requestId: "../unsafe" }, { title: " " }, { title: "字".repeat(201) }, { occurredAt: "2026-02-29" }, { body: " " }, { body: "字".repeat(1201) }, { operation: "new" }]) {
      expect(AssistantResponseSchema.safeParse({ ...response, journalDraft: { ...generated, ...changes } }).success).toBe(false);
    }
    const escaped = { ...generated, body: `${"\\".repeat(1199)}字` };
    expect(escaped.body.length).toBe(1200);
    expect(JSON.stringify(escaped).length).toBeGreaterThan(2000);
    expect(AssistantResponseSchema.safeParse({ ...response, journalDraft: escaped }).success).toBe(false);
  });
});
