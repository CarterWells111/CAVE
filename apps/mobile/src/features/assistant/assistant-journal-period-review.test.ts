import { AssistantRequestSchema, type AssistantResponse } from "@cave/contracts";
import { createJournalPeriodReviewRequest, adaptJournalPeriodReviewResponse } from "./assistant-journal-period-review";

const draft = { mode: "period-review", requestId: "period-review-test-1", title: "我的阶段回顾", occurredAt: "2026-10-14", body: "我已经写下的提醒。",
  period: { startDate: "2026-10-01", endDate: "2026-10-14" } };
const records = [{ id: "source-1", text: "第一条合成记录" }, { id: "source-2", text: "第二条合成记录" }];
const response: AssistantResponse = { status: "ok", providerMode: "live", message: "可以，我们慢慢回顾。", observations: [], sources: [] };
const input = { question: "请陪我回顾这段时间", records, draft };
const ids = records.map(record => record.id);
const context = (request: ReturnType<typeof createJournalPeriodReviewRequest>) => JSON.parse(request.records.find(record => record.id.startsWith("journal-period-review-conversation"))!.text);

test("period requests reuse review with exact selected sources, dates, local summary and review questions", () => {
  const request = createJournalPeriodReviewRequest(input);
  expect(AssistantRequestSchema.safeParse(request).success).toBe(true);
  expect(request).toMatchObject({ mode: "review", consent: true, contextConsent: true, question: input.question });
  expect(request).not.toHaveProperty("history"); expect(request).not.toHaveProperty("journalDraft");
  expect(request.records.slice(0, 2)).toEqual(records);
  expect(request.records.find(record => record.id === "journal-period-review-current-draft")?.text).toBe(draft.body);
  expect(context(request)).toMatchObject({ referenceType: "journal-period-review-context", reviewTask: {
    requestId: draft.requestId, selectedRecordIds: ids, periodStart: draft.period.startDate, periodEnd: draft.period.endDate,
    title: draft.title, guidingQuestions: expect.arrayContaining(["遇到了什么困难？", "下次想提醒自己什么？"]),
  } });
  expect(context(request).reviewTask.instructions).toContain("独立阶段回顾");
  expect(context(request).reviewTask.instructions).toContain("不把计划、建议或假设写成事实");
});

test("eight sources fit with draft and context; zero, excess, duplicate, oversized and over-budget sources are rejected", () => {
  expect(createJournalPeriodReviewRequest({ ...input, records: Array.from({ length: 8 }, (_, index) => ({ id: `source-${index}`, text: "合成来源" })) }).records).toHaveLength(10);
  for (const changes of [
    { records: [] }, { records: Array.from({ length: 9 }, (_, index) => ({ id: `source-${index}`, text: "合成" })) },
    { records: [records[0]!, records[0]!] }, { records: [{ id: "source", text: "字".repeat(4001) }] },
    { records: Array.from({ length: 3 }, (_, index) => ({ id: `source-${index}`, text: "字".repeat(4000) })) },
    { draft: { ...draft, body: "字".repeat(4001) } }, { draft: { ...draft, mode: "review" } },
    { draft: { ...draft, period: { startDate: "2026-10-15", endDate: "2026-10-14" } } },
    { draft: { ...draft, occurredAt: "2026-10-13" } }, { question: "问".repeat(1001) },
  ]) expect(() => createJournalPeriodReviewRequest({ ...input, ...changes })).toThrow("invalid-input");
});

test("whole recent exchanges are trimmed to fit while selected records and current summary remain complete", () => {
  const source = { id: "source", text: "原".repeat(4000) };
  const local = { ...draft, body: "回".repeat(4000) };
  const turns = Array.from({ length: 6 }, (_, index) => ({ question: `${index}${"问".repeat(999)}`, response: { ...response, message: "答".repeat(1800) } }));
  const request = createJournalPeriodReviewRequest({ ...input, records: [source], draft: local, turns });
  expect(request.records[0]).toEqual(source);
  expect(request.records.find(record => record.id === "journal-period-review-current-draft")?.text).toBe(local.body);
  expect(context(request).recentConversation.length).toBeLessThan(6);
  expect(request.records.reduce((sum, record) => sum + record.text.length, 0)).toBeLessThanOrEqual(12000);
  expect(request.records.every(record => record.text.length <= 4000)).toBe(true);
});

test("context IDs cannot collide with any selected source ID", () => {
  const sources = ["journal-period-review-conversation", "journal-period-review-conversation.context", "journal-period-review-current-draft"].map(id => ({ id, text: "合成来源" }));
  const request = createJournalPeriodReviewRequest({ ...input, records: sources });
  expect(request.records.slice(0, 3)).toEqual(sources);
  expect(new Set(request.records.map(record => record.id)).size).toBe(request.records.length);
});

test("only a valid summary produces a request-bound preview retaining the period destination identity", () => {
  const result = adaptJournalPeriodReviewResponse({ ...response, summary: "我发现先停一下对我有帮助。", observations: [{ text: "我愿意保留这个提醒。", sourceRecordIds: ids }] }, draft, ids);
  expect(result).toMatchObject({ journalStage: "ready", journalDraft: { requestId: draft.requestId, title: draft.title, occurredAt: draft.period.endDate, body: "我发现先停一下对我有帮助。" } });
  expect(result.summary).toBeUndefined();
  expect(adaptJournalPeriodReviewResponse({ ...response, question: "先从哪件事开始？" }, draft, ids)).toEqual({ ...response, question: "先从哪件事开始？" });
});

test("period adoption rejects forged, external or non-Chinese content instead of creating a savable result", () => {
  for (const changes of [
    { status: "blocked" }, { status: "unavailable" }, { summary: "字".repeat(1201) },
    { summary: "Here is a review." }, { observations: [{ text: "无关引用", sourceRecordIds: ["not-selected"] }] },
    { sources: [{ id: "external", title: "其他资料", url: "https://example.com" }] },
    { journalStage: "collecting" },
  ]) expect(() => adaptJournalPeriodReviewResponse({ ...response, summary: "我想保留这段提醒。", ...changes }, draft, ids)).toThrow("invalid-response");
});

test("a later period summary uses the user's current edited title and summary context", () => {
  const edited = { ...draft, title: "我重新命名的回顾", body: "我刚补充了自己的小结。" };
  const request = createJournalPeriodReviewRequest({ ...input, draft: edited });
  expect(context(request).reviewTask.title).toBe(edited.title);
  expect(request.records.find(record => record.id === "journal-period-review-current-draft")?.text).toBe(edited.body);
  expect(adaptJournalPeriodReviewResponse({ ...response, summary: "我想保留新的经验。" }, edited, ids).journalDraft).toMatchObject({
    title: edited.title, occurredAt: edited.period.endDate, body: "我想保留新的经验。",
  });
});
