import { AssistantResponseSchema, type AssistantRequest, type AssistantResponse } from "@cave/contracts";
import { describe, expect, it } from "vitest";
import { validateAssistantDelivery } from "../src/services/assistant-deliverable";

const input: AssistantRequest = { mode: "chat", consent: true, question: "我想聊聊今天", records: [] };
const response: AssistantResponse = { status: "ok", providerMode: "live", message: "可以从今天的一个片刻聊起。", observations: [], sources: [] };
const draft = { protocol: "cave-journal-draft-v1" as const, requestId: "draft-1", title: "河边的片刻", occurredAt: "2026-10-14", body: "我沿着河边走了一会儿，心情慢慢平静下来。" };
const journal: AssistantRequest = { ...input, mode: "journal-draft", journalDraft: { ...draft, operation: "new", title: "", body: "" } };
const ready: AssistantResponse = { ...response, journalDraft: draft, journalStage: "ready" };
const collecting: AssistantResponse = { ...response, journalStage: "collecting", message: "今天有没有一个想记下来的片刻？" };
const interview: AssistantRequest = { ...journal, journalDraft: { ...journal.journalDraft!, stage: "interview" } };

function review(options: { selectedId?: string; title?: string; requestId?: string; oldClient?: boolean; currentDraft?: boolean } = {}): AssistantRequest {
  const selectedId = options.selectedId ?? "selected-1";
  const unique = (id: string) => id === selectedId ? `${id}.context` : id;
  return {
    ...input, mode: "review", contextConsent: true,
    records: [
      { id: selectedId, text: JSON.stringify({ title: options.title ?? "一次散步", occurredAt: "2026-10-01", body: "我那天去了河边。", entries: [] }) },
      ...(options.currentDraft ? [{ id: unique("journal-review-current-draft"), text: "我后来又试着表达了自己的想法。" }] : []),
      { id: unique("journal-review-conversation"), text: JSON.stringify({ referenceType: "journal-review-context", reviewTask: {
        selectedRecordId: selectedId, periodStart: "2026-10-01", periodEnd: "2026-10-14",
        ...(!options.oldClient ? { requestId: options.requestId ?? "review-1" } : {}),
        ...(options.currentDraft ? { currentReviewDraftRecordId: unique("journal-review-current-draft") } : {}),
      }, recentConversation: [] }) },
    ],
  };
}

function summaryAtSerializedLimit(requestId: string, title: string) {
  const overhead = JSON.stringify({ protocol: draft.protocol, requestId, title, occurredAt: draft.occurredAt, body: "" }).length;
  const escapes = 2000 - overhead - 1200;
  expect(escapes).toBeGreaterThan(0);
  expect(escapes).toBeLessThan(1199);
  return `我${"\\".repeat(escapes)}${"回".repeat(1199 - escapes)}`;
}

function changeReviewTask(request: AssistantRequest, patch: Record<string, unknown>): AssistantRequest {
  return { ...request, records: request.records.map(record => {
    const value = JSON.parse(record.text) as Record<string, unknown>;
    return value.referenceType === "journal-review-context"
      ? { ...record, text: JSON.stringify({ ...value, reviewTask: { ...value.reviewTask as object, ...patch } }) } : record;
  }) };
}

describe("mobile-compatible assistant delivery", () => {
  it("returns a valid response without changing the request or model response", () => {
    const before = structuredClone({ input, response });
    expect(validateAssistantDelivery(input, response)).toEqual(response);
    expect({ input, response }).toEqual(before);
  });

  it.each(["blocked", "unavailable"] as const)("preserves a valid %s result for the caller to refund", status => {
    expect(validateAssistantDelivery(journal, { ...response, status }).status).toBe(status);
    expect(validateAssistantDelivery(review(), { ...response, status }).status).toBe(status);
  });

  it.each([
    null, { ...response, unexpected: true }, { ...response, question: "问".repeat(501) },
    { ...response, observations: [{ text: "我有新的理解。", sourceRecordIds: [] }] },
  ])("rejects a response outside the shared schema: %#", value => {
    expect(() => validateAssistantDelivery(input, value)).toThrow("invalid-assistant-delivery");
  });

  it("rejects valid schema data whose actual JSON transport exceeds 24000 characters", () => {
    const large = { ...response, message: `我${"\\".repeat(1999)}`, summary: `我${"\\".repeat(1999)}`, question: `我${"\\".repeat(499)}`,
      observations: Array.from({ length: 6 }, () => ({ text: `我${"\\".repeat(499)}`, sourceRecordIds: ["selected-1"] })),
      sources: Array.from({ length: 10 }, (_, index) => ({ id: `source-${index}`, title: "\\".repeat(200), url: `https://example.test/${"x".repeat(970)}` })) };
    expect(AssistantResponseSchema.safeParse(large).success).toBe(true);
    expect(JSON.stringify(large).length).toBeGreaterThan(24_000);
    expect(() => validateAssistantDelivery({ ...input, records: [{ id: "selected-1", text: "我散了步。" }] }, large)).toThrow("invalid-assistant-delivery");
  });

  it.each([
    { message: "Here is a response." }, { question: "What happened next?" }, { summary: "I took a walk." },
    { observations: [{ text: "I felt calmer afterward.", sourceRecordIds: ["selected-1"] }] },
  ])("rejects non-Chinese generated prose: %#", fields => {
    expect(() => validateAssistantDelivery({ ...input, records: [{ id: "selected-1", text: "我散了步。" }] }, { ...response, ...fields }))
      .toThrow("invalid-assistant-delivery");
  });

  it("accepts only observation references to records in the current request", () => {
    const current = { ...input, records: [{ id: "selected-1", text: "我散了步。" }] };
    const observation = { text: "我开始觉得放松。", sourceRecordIds: ["selected-1"] };
    expect(validateAssistantDelivery(current, { ...response, observations: [observation] }).observations).toEqual([observation]);
    expect(() => validateAssistantDelivery(current, { ...response, observations: [{ ...observation, sourceRecordIds: ["another-record"] }] }))
      .toThrow("invalid-assistant-delivery");
  });

  it.each([undefined, "ready"] as const)("accepts a completed draft with stage %s", journalStage => {
    expect(validateAssistantDelivery(journal, { ...ready, journalStage }).journalDraft).toEqual(draft);
  });

  it("accepts collecting only for an interview, including no generated draft", () => {
    expect(validateAssistantDelivery(interview, collecting)).toEqual(collecting);
    for (const request of [input, journal, { ...journal, journalDraft: { ...journal.journalDraft!, stage: "generate" as const } }])
      expect(() => validateAssistantDelivery(request, collecting)).toThrow("invalid-assistant-delivery");
  });

  it.each([
    { journalDraft: undefined }, { journalDraft: undefined, journalStage: undefined }, { journalDraft: { ...draft, requestId: "other-request" } },
    { journalDraft: { ...draft, occurredAt: "2026-10-13" } }, { journalDraft: { ...draft, title: "My walk" } },
    { journalDraft: { ...draft, body: "I felt calm after a walk." } },
    { journalDraft: { ...draft, body: "我".repeat(1201) } }, { journalStage: "collecting" },
  ])("rejects an unusable draft response: %#", fields => {
    expect(() => validateAssistantDelivery(journal, { ...ready, ...fields })).toThrow("invalid-assistant-delivery");
  });

  it("rejects journal output in a normal chat and accepts only an exact preserved edit title", () => {
    expect(() => validateAssistantDelivery(input, ready)).toThrow("invalid-assistant-delivery");
    const edit: AssistantRequest = { ...journal, journalDraft: { ...journal.journalDraft!, operation: "edit", title: "My original title" } };
    expect(validateAssistantDelivery(edit, { ...ready, journalDraft: { ...draft, title: edit.journalDraft!.title } }).journalDraft?.title)
      .toBe(edit.journalDraft!.title);
    expect(() => validateAssistantDelivery(edit, { ...ready, journalDraft: { ...draft, title: "修改后的标题" } })).toThrow("invalid-assistant-delivery");
  });
});

describe("local journal review adoption", () => {
  it("accepts a bounded summary and selected/context/current-draft citations while preserving an English original title", () => {
    const request = review({ title: "My original title", currentDraft: true });
    const value = { ...response, summary: "我后来更愿意给自己留出表达的时间。", observations: [{ text: "我有了新的理解。", sourceRecordIds: request.records.map(record => record.id) }] };
    expect(validateAssistantDelivery(request, value)).toEqual(value);
  });

  it("honors context ID suffixes when a selected journal has the reserved context name", () => {
    const request = review({ selectedId: "journal-review-conversation" });
    const value = { ...response, summary: "我开始理解那天的感受。", observations: [{ text: "我慢慢理解了自己的感受。", sourceRecordIds: request.records.map(record => record.id) }] };
    expect(validateAssistantDelivery(request, value)).toEqual(value);
  });

  it("allows a normal follow-up question without an adoptable summary", () => {
    const value = { ...response, question: "那之后有没有一次不同的交流？" };
    expect(validateAssistantDelivery(review(), value)).toEqual(value);
  });

  it("rejects external sources and citations to extra selections outside the captured review", () => {
    const request = { ...review(), records: [...review().records, { id: "other-selected", text: "另一篇手记。" }] };
    for (const value of [
      { ...response, summary: "我有新的理解。", sources: [{ id: "source-1", title: "外部资料" }] },
      { ...response, observations: [{ text: "我有新的理解。", sourceRecordIds: ["other-selected"] }] },
    ]) expect(() => validateAssistantDelivery(request, value)).toThrow("invalid-assistant-delivery");
  });

  it("checks both the 1200-character body limit and exact serialized draft size using the local request ID", () => {
    const title = "一段回顾";
    const requestId = "review-1";
    const request = review({ title, requestId });
    const summary = summaryAtSerializedLimit(requestId, title);
    expect(summary).toHaveLength(1200);
    expect(JSON.stringify({ ...draft, requestId, title, body: summary }).length).toBe(2000);
    expect(validateAssistantDelivery(request, { ...response, summary }).summary).toBe(summary);
    for (const body of ["我".repeat(1201), summary.replace("回", "\\")])
      expect(() => validateAssistantDelivery(request, { ...response, summary: body })).toThrow("invalid-assistant-delivery");
    expect(() => validateAssistantDelivery(review({ title, oldClient: true }), { ...response, summary })).toThrow("invalid-assistant-delivery");
  });

  it("reserves 100 request-ID characters for older clients without requestId metadata", () => {
    const title = "一段回顾";
    const summary = summaryAtSerializedLimit("x".repeat(100), title);
    const request = review({ title, oldClient: true });
    expect(validateAssistantDelivery(request, { ...response, summary }).summary).toBe(summary);
    expect(() => validateAssistantDelivery(request, { ...response, summary: summary.replace("回", "\\") })).toThrow("invalid-assistant-delivery");
  });

  it.each([
    { requestId: "../invalid" }, { periodEnd: "2026-02-30" }, { selectedRecordId: "not-supplied" },
    { currentReviewDraftRecordId: "not-supplied" },
  ])("rejects review metadata that cannot produce a valid local draft: %#", patch => {
    expect(() => validateAssistantDelivery(changeReviewTask(review(), patch), { ...response, summary: "我有新的理解。" }))
      .toThrow("invalid-assistant-delivery");
  });

  it("requires a real selected JSON title only when converting a summary, without restricting legacy period reviews", () => {
    const request = review();
    request.records[0] = { id: "selected-1", text: "纯文本原手记。" };
    expect(validateAssistantDelivery(request, response)).toEqual(response);
    expect(() => validateAssistantDelivery(request, { ...response, summary: "我开始理解这段经历。" })).toThrow("invalid-assistant-delivery");
    const legacy: AssistantRequest = { ...input, mode: "review", records: [{ id: "selected-1", text: "我那天去了河边。" }] };
    const summary = "我".repeat(2000);
    expect(validateAssistantDelivery(legacy, { ...response, summary }).summary).toBe(summary);
  });
});
