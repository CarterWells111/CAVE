import { AssistantRequestSchema, type AssistantResponse } from "@cave/contracts";
import { JOURNAL_REVIEW_QUESTIONS } from "../journal/domain/journal-review-prompts";
import { adaptJournalReviewResponse, createJournalReviewRequest } from "./assistant-journal-review";

const draft = { mode: "review", requestId: "review-request-1", title: "一次倾听的回顾", occurredAt: "2026-10-14", body: "",
  original: { record: { id: "selected-1", occurredAt: "2026-10-01" }, entries: [] } };
const source = { id: "selected-1", text: JSON.stringify({ title: "一次倾听", occurredAt: "2026-10-01", body: "那天我很难开口，后来试着说出了自己的想法。", entries: [{ occurredAt: "2026-10-04", body: "再次交流时，我先说了自己需要一点时间。" }] }) };
const answer: AssistantResponse = { status: "ok", providerMode: "live", message: "可以从那次交流开始慢慢回顾。", observations: [], sources: [] };
const input = { question: "帮我回顾这之后有哪些变化", records: [source], draft, turns: [] };

function context(request: ReturnType<typeof createJournalReviewRequest>) {
  return JSON.parse(request.records.find(record => record.id.startsWith("journal-review-conversation"))!.text);
}

test("reuses review mode, its five existing questions and only one selected source including additions", () => {
  const request = createJournalReviewRequest(input);
  expect(AssistantRequestSchema.safeParse(request).success).toBe(true);
  expect(request).toMatchObject({ mode: "review", consent: true, contextConsent: true, question: input.question });
  expect(request).not.toHaveProperty("history");
  expect(request).not.toHaveProperty("journalDraft");
  expect(request.records[0]).toEqual(source);
  const reference = context(request);
  expect(reference.referenceType).toBe("journal-review-context");
  expect(reference.reviewTask).toMatchObject({ requestId: draft.requestId, selectedRecordId: source.id, periodStart: "2026-10-01", periodEnd: "2026-10-14", guidingQuestions: [...JOURNAL_REVIEW_QUESTIONS] });
  expect(reference.reviewTask.instructions).toContain("不把计划、建议或假设写成后来已发生的事实");
  expect(reference.reviewTask.instructions).toContain("信息足够才把可采用的小结放summary");
  expect(reference.reviewTask.instructions).toContain("没有后续资料时温和提问，不编造变化");
  expect(reference.reviewTask.instructions).toContain("记录者自己的第一人称口吻");
  expect(reference.reviewTask.instructions).toContain("用“我”表达，不称呼用户为“你”或“您”");
  expect(reference.reviewTask.instructions).toContain("不加入AI解释、写作说明、注释");
  expect(reference.reviewTask.instructions).toContain("不机械替换引语里的你、他、她");
  expect(reference.reviewTask.instructions).toContain("message/question中的正常提问可以保留对用户的称呼");
  expect(request.question).not.toContain(source.text);
});

test("preserves a complete 1000-character user question and rejects larger questions without truncation", () => {
  const question = "问".repeat(1000);
  expect(createJournalReviewRequest({ ...input, question }).question).toBe(question);
  expect(() => createJournalReviewRequest({ ...input, question: `${question}问` })).toThrow("invalid-input");
});

test("keeps the selected original and current review body complete while dropping whole old exchanges to fit context", () => {
  const records = [{ ...source, text: "原".repeat(4000) }];
  const current = { ...draft, body: "回".repeat(4000) };
  const turns = [1, 2, 3].map(index => ({ question: `${index}${"问".repeat(500)}`, response: { ...answer, message: `${index}${"答".repeat(1500)}` } }));
  const provided = { ...input, records, draft: current, turns };
  const before = JSON.stringify(provided);
  const request = createJournalReviewRequest(provided);
  expect(request.records).toHaveLength(3);
  expect(request.records[0]?.text).toBe(records[0]!.text);
  expect(request.records.find(record => record.id === "journal-review-current-draft")?.text).toBe(current.body);
  const reference = context(request);
  expect(reference.reviewTask.currentReviewDraftRecordId).toBe("journal-review-current-draft");
  expect(reference.recentConversation).toEqual([{ user: turns[2]!.question, assistant: { message: turns[2]!.response.message } }]);
  expect(request.records.every(record => record.text.length <= 4000)).toBe(true);
  expect(request.records.reduce((sum, record) => sum + record.text.length, 0)).toBeLessThanOrEqual(12000);
  expect(JSON.stringify(provided)).toBe(before);
});

test("does not overwrite source IDs when they collide with derived context labels", () => {
  for (const id of ["journal-review-conversation", "journal-review-current-draft"]) {
    const request = createJournalReviewRequest({ ...input, records: [{ ...source, id }], draft: { ...draft, body: "当前待确认回顾。", original: { ...draft.original, record: { ...draft.original.record, id } } } });
    expect(request.records[0]?.id).toBe(id);
    expect(new Set(request.records.map(record => record.id)).size).toBe(request.records.length);
    expect(AssistantRequestSchema.safeParse(request).success).toBe(true);
  }
});

test("rejects extra source selections, wrong identity, invalid dates or oversized private text before requesting", () => {
  for (const changes of [
    { records: [] }, { records: [source, { id: "another", text: "不应发送的其他手记" }] },
    { records: [{ ...source, id: "other" }] }, { records: [{ ...source, text: "原".repeat(4001) }] },
    { draft: { ...draft, mode: "new" } }, { draft: { ...draft, original: undefined } },
    { draft: { ...draft, requestId: "../unsafe" } }, { draft: { ...draft, occurredAt: "2026-02-30" } },
    { draft: { ...draft, occurredAt: "2026-09-30" } }, { draft: { ...draft, body: "回".repeat(4001) } },
  ]) expect(() => createJournalReviewRequest({ ...input, ...changes })).toThrow("invalid-input");
});

test("adopts only response.summary into a five-field local preview with captured title, request ID and review date", () => {
  const summary = "那次我试着表达了自己的想法。后来的补充里，我又提到需要一点时间；下次仍想给自己留出开口的空间。";
  const adapted = adaptJournalReviewResponse({ ...answer, summary, question: "还有什么想补充的吗？", observations: [{ text: "我记下了两次表达。", sourceRecordIds: [source.id] }] }, draft);
  expect(adapted).toEqual({ status: "ok", providerMode: "live", message: "这段回顾，我想这样记下。", observations: [], sources: [], journalStage: "ready", journalDraft: {
    protocol: "cave-journal-draft-v1", requestId: draft.requestId, title: draft.title, occurredAt: draft.occurredAt, body: summary,
  } });
  expect(Object.keys(adapted.journalDraft!).sort()).toEqual(["body", "occurredAt", "protocol", "requestId", "title"]);
  expect(JSON.stringify(adapted.journalDraft).length).toBeLessThanOrEqual(2000);
  expect(adapted.journalDraft?.body).not.toBe(answer.message);
});

test("without a summary preserves the actual message and question without creating a savable draft", () => {
  const reply = { ...answer, question: "从那天到现在，有没有哪次交流让你觉得不同？" };
  const adapted = adaptJournalReviewResponse(reply, draft);
  expect(adapted).toEqual(reply);
  expect(adapted).not.toHaveProperty("journalDraft");
  expect(adapted).not.toHaveProperty("journalStage");
});

test("preserves a user-owned English title while requiring Chinese AI prose", () => {
  const local = { ...draft, title: "A walk — review" };
  expect(createJournalReviewRequest({ ...input, draft: local }).mode).toBe("review");
  expect(adaptJournalReviewResponse({ ...answer, summary: "我回想起那次开口表达，也记下了后来需要一点时间的选择。" }, local).journalDraft?.title).toBe(local.title);
  expect(() => adaptJournalReviewResponse({ ...answer, summary: "I remembered speaking up." }, local)).toThrow("invalid-response");
});

test("rejects unavailable, blocked, forged and non-Chinese results without generating partial previews", () => {
  const summary = "后来我尝试表达了自己的想法。";
  for (const changes of [
    { status: "blocked" }, { status: "unavailable" }, { summary: "回".repeat(1201) },
    { summary: `${"\\".repeat(1199)}字` }, { summary: "I changed the way I communicate." },
    { message: "Here is your review." }, { question: "What changed?" },
    { observations: [{ text: "虚构出处", sourceRecordIds: ["not-selected"] }] },
    { sources: [{ id: "external", title: "其他资料", url: "https://example.com" }] },
    { journalStage: "collecting" },
  ]) expect(() => adaptJournalReviewResponse({ ...answer, summary, ...changes }, draft)).toThrow("invalid-response");
  const forged = { protocol: "cave-journal-draft-v1", requestId: "forged", title: "虚构草稿", occurredAt: "2026-10-14", body: "不应直接采用。" };
  expect(() => adaptJournalReviewResponse({ ...answer, journalDraft: forged }, draft)).toThrow("invalid-response");
});

test("first-person writing instructions preserve quoted people and pronouns in the selected original", () => {
  const quoted = { ...source, text: JSON.stringify({ body: "她对我说：‘你可以慢慢想，我会等你。’我当时感到安心。" }) };
  const request = createJournalReviewRequest({ ...input, records: [quoted] });
  expect(request.records[0]).toEqual(quoted);
  expect(request.records[0]?.text).toContain("你可以慢慢想，我会等你");
  expect(context(request).reviewTask.instructions).toContain("保留真实引语和其中的人物称呼");
});
