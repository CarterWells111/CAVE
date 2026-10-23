import { AssistantRequestSchema, type AssistantResponse } from "@cave/contracts";
import { createJournalRecord } from "../journal/domain/journal-record";
import type { JournalService } from "../journal/application/journal-service";
import type { AssistantConversation } from "./history/assistant-history-repository";
import { buildGrowthSeries, emptyGrowthData } from "../growth/growth-records";
import { journalDateFromDate } from "../journal/domain/journal-date";
import type { RoomHistoryRecord } from "../rooms/history/room-history-repository";
import { collectGrowthReviewContext, parseGrowthReviewPeriod, resolveGrowthReviewPeriod } from "./growth-review-context";
import { GROWTH_REVIEW_STARTER, growthReviewStarter, stageGrowthReviewEntry, takeGrowthReviewEntry } from "./growth-review-entry";

const now = new Date(2026, 9, 23, 12);
const reply: AssistantResponse = { status: "ok", providerMode: "mock", message: "当时的建议", observations: [], sources: [] };
function journal(dates: string[], body = "合成手记正文") {
  const records = dates.map((date, index) => createJournalRecord({
    id: `journal-${index}`, title: `手记 ${date}`, occurredAt: date, createdAt: date + "T12:00:00Z",
    body, highlight: { kind: "impression", text: "合成摘要" }, topics: [], source: { kind: "freeform" },
  }));
  return {
    listRecords: jest.fn(async () => records.map(({ id, title, occurredAt, createdAt, highlight, topics }) => ({ id, title, occurredAt, createdAt, highlight, topics }))),
    loadRecord: jest.fn(async (id: string) => ({ record: records.find(item => item.id === id)!, entries: [] })),
  } satisfies Pick<JournalService, "listRecords" | "loadRecord">;
}
function conversation(id: string, start: string, end: string, timestamps?: (string | undefined)[]): AssistantConversation {
  return { id, title: "合成会话", journeyId: "pause", createdAt: start, updatedAt: end,
    turns: (timestamps ?? [undefined]).map((createdAt, index) => ({
      question: `${id} 提问 ${index}`, response: reply, ...(createdAt ? { createdAt } : {}),
    })),
  };
}

afterEach(() => { jest.restoreAllMocks(); takeGrowthReviewEntry(undefined); });

test("entry is account-bound, consumed once, and expires without retaining record content", () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
  stageGrowthReviewEntry("owner-a");
  expect(takeGrowthReviewEntry("owner-b")).toBeNull();
  expect(takeGrowthReviewEntry("owner-a")).toBeNull();
  stageGrowthReviewEntry("owner-a");
  expect(takeGrowthReviewEntry("owner-a")).toMatchObject({ id: expect.any(Number), accountId: "owner-a" });
  expect(takeGrowthReviewEntry("owner-a")).toBeNull();
  stageGrowthReviewEntry("owner-a"); clock.mockReturnValue(301001);
  expect(takeGrowthReviewEntry("owner-a")).toBeNull();
});

test.each([
  ["最近一周", "2026-10-17"], ["最近一个月", "2026-09-23"], ["最近半年", "2026-04-23"],
  ["最近 10 天", "2026-10-14"], ["最近两周", "2026-10-10"], ["过去三个月", "2026-07-23"],
  ["所有记录", null],
])("resolves editable local date range: %s", (question, startDate) => {
  expect(parseGrowthReviewPeriod(question, now)).toMatchObject({ startDate, endDate: "2026-10-23" });
});
test("unrecognized range stays unresolved and month subtraction clamps month-end", () => {
  expect(parseGrowthReviewPeriod("回顾一下", now)).toBeNull();
  expect(parseGrowthReviewPeriod("最近一个月", new Date(2026, 2, 31))).toMatchObject({ startDate: "2026-02-28" });
});

test("uses the edited week instead of month, excludes future records and reports room gap", async () => {
  const source = journal(["2026-10-23", "2026-10-17", "2026-10-16", "2026-09-30", "2026-10-24"]);
  const result = await collectGrowthReviewContext({ question: "查看我最近一周的成长", ownerAccountId: "owner-a", journal: source, now });
  expect(source.loadRecord.mock.calls.map(([id]) => id)).toEqual(["journal-0", "journal-1"]);
  const coverage = result.records[0]!.text;
  expect(coverage).toContain("2026-10-17 至 2026-10-23");
  expect(coverage).toContain("房间：当前本机历史不可用");
  expect(coverage).toContain("AI 历史：当前资料不可用");
});

test("reads only current-account AI turns and conservatively omits legacy conversations crossing range", async () => {
  const history = { list: jest.fn(async () => [
    conversation("timed", "2026-08-01T12:00:00Z", "2026-10-23T12:00:00Z", ["2026-10-20T12:00:00Z", "2026-09-01T12:00:00Z"]),
    conversation("legacy-in", "2026-10-18T12:00:00Z", "2026-10-20T12:00:00Z"),
    conversation("legacy-cross", "2026-09-01T12:00:00Z", "2026-10-20T12:00:00Z"),
    conversation("current", "2026-10-20T12:00:00Z", "2026-10-20T12:00:00Z"),
  ]) };
  const result = await collectGrowthReviewContext({ question: "回顾最近一周", ownerAccountId: "owner-a", assistantHistory: history, excludeConversationId: "current", now });
  expect(history.list).toHaveBeenCalledWith("owner-a");
  const text = result.records.map(record => record.text).join("\n");
  expect(text).toContain("timed 提问 0"); expect(text).not.toContain("timed 提问 1");
  expect(text).toContain("legacy-in 提问"); expect(text).not.toContain("legacy-cross 提问");
  expect(text).not.toContain("current 提问");
  expect(text).toContain("1 条旧记录因时间范围无法可靠确认而未提供");
});

test("includes only completed journey metadata and never requests private journey payload", async () => {
  const reviewHistory = { listMetadata: jest.fn(async () => [
    { id: "done", parentVersionId: null, title: "完成的回顾", status: "completed" as const, createdAt: "2026-10-20T12:00:00Z", sourceRevision: 1, payload: { privatePreparation: "不能读取" } },
    { id: "draft", parentVersionId: null, title: "未完成的回顾", status: "incomplete" as const, createdAt: "2026-10-20T12:00:00Z", sourceRevision: 1 },
  ]), loadVersion: jest.fn() };
  const result = await collectGrowthReviewContext({ question: "最近一周", ownerAccountId: "owner-a", reviewHistory, now });
  const text = result.records.map(record => record.text).join("\n");
  expect(text).toContain("完成的回顾"); expect(text).not.toContain("未完成的回顾");
  expect(text).not.toContain("不能读取"); expect(reviewHistory.loadVersion).not.toHaveBeenCalled();
});

test("bounds private context and explicitly reports selection and truncation", async () => {
  const source = journal(Array.from({ length: 20 }, () => "2026-10-20"), "记".repeat(4000));
  const history = { list: jest.fn(async () => [conversation("many", "2026-10-20T12:00:00Z", "2026-10-20T12:00:00Z", Array.from({ length: 20 }, () => "2026-10-20T12:00:00Z"))]) };
  const result = await collectGrowthReviewContext({ question: "所有记录", ownerAccountId: "owner-a", journal: source, assistantHistory: history, now });
  expect(result.records.length).toBeLessThanOrEqual(10);
  expect(result.records.every(record => record.text.length <= 4000)).toBe(true);
  expect(result.records.reduce((sum, record) => sum + record.text.length, 0)).toBeLessThanOrEqual(12000);
  expect(result.records[0]!.text).toContain("资料因数量或长度限制被筛选/截短");
  expect(AssistantRequestSchema.safeParse({ mode: "chat", consent: true, contextConsent: true, records: result.records, question: "所有记录" }).success).toBe(true);
});

test("aborted collection neither loads later records nor returns context", async () => {
  const controller = new AbortController();
  const source = journal(["2026-10-20"]);
  source.listRecords.mockImplementationOnce(async () => { controller.abort(); return []; });
  await expect(collectGrowthReviewContext({ question: "最近一周", ownerAccountId: "owner-a", journal: source, signal: controller.signal, now })).rejects.toThrow("growth-review-aborted");
  expect(source.loadRecord).not.toHaveBeenCalled();
});

test.each([
  ["查看我最近一周的记录，给我接下来半年成长的建议", "2026-10-17"],
  ["查看我最近一个月的记录，给我接下来半年成长的建议", "2026-09-23"],
  ["回顾所有记录，给我未来半年的成长建议", null],
  ["回顾最近一个月的所有手记，给未来半年一些建议", "2026-09-23"],
])("future advice horizon never widens the historical review: %s", (question, startDate) => {
  expect(parseGrowthReviewPeriod(question, now)).toMatchObject({ startDate, endDate: "2026-10-23" });
});

test.each([
  "给我接下来半年成长的建议",
  "请给未来半年的自己一些建议",
  "查看我最近一周和过去一个月的记录",
])("missing or conflicting history range requires clarification: %s", question => {
  expect(parseGrowthReviewPeriod(question, now)).toBeNull();
});

test("follow-up retains approved range only without a conflicting new historical range", async () => {
  const previous = { startDate: "2026-10-17", endDate: "2026-10-23", label: "最近一周" };
  expect(resolveGrowthReviewPeriod("给我接下来半年成长的建议", previous, now)).toEqual(previous);
  expect(resolveGrowthReviewPeriod("最近一周和过去一个月都回顾一下", previous, now)).toBeNull();
  const source = journal(["2026-10-20", "2026-09-01"]);
  await expect(collectGrowthReviewContext({ question: "回顾最近一周和过去一个月", ownerAccountId: "owner-a", period: previous, journal: source, now })).rejects.toThrow("growth-review-period-required");
  expect(source.listRecords).not.toHaveBeenCalled();
});

test("collection reads the requested week even when recommendations mention the next half-year", async () => {
  const source = journal(["2026-10-20", "2026-09-01"]);
  const result = await collectGrowthReviewContext({ question: "查看我最近一周的记录，给我接下来半年成长的建议", ownerAccountId: "owner-a", journal: source, now });
  expect(result.period.startDate).toBe("2026-10-17");
  expect(source.loadRecord.mock.calls.map(([id]) => id)).toEqual(["journal-0"]);
});

function roomEvent(id: string, roomId: string, occurredAt: string, action: RoomHistoryRecord["action"], answer = "本人合成回答"): RoomHistoryRecord {
  return { id, roomId, scenarioId: "pause", occurredAt, action, timeKind: action === "observed" ? "observed" : "action", myAnswers: { boundary: answer } };
}

test.each(["week", "month", "halfYear", "all"] as const)("selected %s range prefill matches the visible growth interval", range => {
  const starter = growthReviewStarter(range, now);
  const selected = parseGrowthReviewPeriod(starter, now);
  const series = buildGrowthSeries(emptyGrowthData(), range, now);
  expect(selected).toMatchObject({
    startDate: range === "all" ? null : journalDateFromDate(series.start),
    endDate: "2026-10-23",
  });
});

test("explicit range is staged once while the original default month remains compatible", () => {
  stageGrowthReviewEntry("owner-a");
  expect(takeGrowthReviewEntry("owner-a")).toMatchObject({ range: "month", starter: GROWTH_REVIEW_STARTER });
  stageGrowthReviewEntry("owner-a", "week");
  expect(takeGrowthReviewEntry("owner-a")).toMatchObject({ range: "week", starter: growthReviewStarter("week", now) });
});

test.each([
  "查看我从2026-02-30至2026-10-23的手记",
  "查看我从2026-10-24至2026-10-23的手记",
  "查看我从2026-05-01至2026-10-24的手记",
  "查看我从2026-05-01至2026-10-23的手记，回顾最近一周",
])("invalid, future or contradictory explicit dates do not authorize context: %s", question => {
  expect(parseGrowthReviewPeriod(question, now)).toBeNull();
  expect(resolveGrowthReviewPeriod(question, { startDate: null, endDate: "2026-10-23", label: "所有" }, now)).toBeNull();
});

test("room history uses current owner and exact dates, grouping snapshots of one room", async () => {
  const first = roomEvent("first", "same-room", "2026-10-18T10:00:00Z", "created", "较早边界");
  const changed = roomEvent("changed", "same-room", "2026-10-19T10:00:00Z", "answer-saved", "后来边界");
  const completed: RoomHistoryRecord = { ...roomEvent("complete", "same-room", "2026-10-20T10:00:00Z", "completed", "后来边界"),
    report: { status: "ready", sections: { commonAndDifferences: "已可见公共报告", adviceForBoth: "当时共同建议", nextSteps: "下一步建议" } } };
  const observed = { ...roomEvent("observed", "observed-room", "2026-10-21T10:00:00Z", "observed"), partnerAnswers: "伙伴原文不能传送" };
  const history = { list: jest.fn(async () => [
    observed, completed, completed, changed, first,
    roomEvent("old", "old-room", "2026-09-01T10:00:00Z", "created", "范围外内容"),
    roomEvent("future", "future-room", "2026-10-23T16:00:00Z", "created", "未来内容"),
  ]) };
  const result = await collectGrowthReviewContext({ question: "查看我最近一周的房间记录", ownerAccountId: "owner-a", roomHistory: history, now });
  expect(history.list).toHaveBeenCalledWith("owner-a");
  const rooms = result.records.filter(record => record.id.startsWith("growth-room-"));
  expect(rooms).toHaveLength(2);
  const coverage = result.records[0]!.text;
  expect(coverage).toContain("2 个房间、3 条真实操作和 1 条首次看到快照");
  expect(coverage).toContain("首次看到快照不是原创建、完成或生成报告时间");
  expect(coverage).toContain("已删除且未留存的记录可能缺失");
  expect(rooms[0]!.text).toContain("较早边界");
  expect(rooms[0]!.text).toContain("后来边界");
  expect(rooms[0]!.text).toContain("已可见公共报告");
  const text = result.records.map(record => record.text).join("\n");
  expect(text).not.toContain("伙伴原文不能传送");
  expect(text).not.toContain("范围外内容");
  expect(text).not.toContain("未来内容");
  expect(rooms[1]!.text).toContain("首次在本机看到这一快照；不是房间创建、完成或报告生成时间");
});

test("room history read failures are not silently treated as no room activity", async () => {
  const history = { list: jest.fn(async () => { throw new Error("room-history-read-failed"); }) };
  await expect(collectGrowthReviewContext({ question: "最近一周", ownerAccountId: "owner-a", roomHistory: history, now })).rejects.toThrow("room-history-read-failed");
});

test("many room events and long answers remain bounded with an explicit selection note", async () => {
  const items = Array.from({ length: 30 }, (_, index) => roomEvent("event-" + index, "room-" + index, "2026-10-20T10:00:00Z", "answer-saved", "答".repeat(2000)));
  const result = await collectGrowthReviewContext({ question: "所有记录", ownerAccountId: "owner-a", roomHistory: { list: async () => items }, now });
  expect(result.records.length).toBeLessThanOrEqual(10);
  expect(result.records.reduce((sum, record) => sum + record.text.length, 0)).toBeLessThanOrEqual(12000);
  expect(result.records.every(record => record.text.length <= 4000)).toBe(true);
  expect(result.records[0]!.text).toContain("资料因数量或长度限制被筛选/截短");
});

test("an empty ended snapshot does not erase the in-range answer saved between creation and ending", async () => {
  const created = { ...roomEvent("created-empty", "one-room", "2026-10-18T10:00:00Z", "created"), myAnswers: {} };
  const answered = roomEvent("middle-answer", "one-room", "2026-10-19T10:00:00Z", "answer-saved", "结束前真实保存的本人正文");
  const ended = { ...roomEvent("ended-empty", "one-room", "2026-10-20T10:00:00Z", "ended"), myAnswers: {} };
  const outside = roomEvent("outside-answer", "one-room", "2026-10-16T10:00:00Z", "answer-saved", "范围外旧答案不能回捞");
  const result = await collectGrowthReviewContext({ question: "回顾最近一周", ownerAccountId: "owner-a", roomHistory: { list: async () => [created, answered, ended, outside] }, now });
  const rooms = result.records.filter(record => record.id.startsWith("growth-room-"));
  expect(rooms).toHaveLength(1);
  expect(rooms[0]!.text).toContain("结束房间（真实操作发生时间）");
  expect(rooms[0]!.text).toContain("最近活动快照（2026-10-20T10:00:00Z）的本人回答：\n此快照没有留存本人的回答正文");
  expect(rooms[0]!.text).toContain("历史里最近留存的非空本人回答（2026-10-19T10:00:00Z");
  expect(rooms[0]!.text).toContain("结束前真实保存的本人正文");
  expect(rooms[0]!.text).not.toContain("范围外旧答案不能回捞");
});

test("timestamps later today are excluded from room, AI and completed-journey context", async () => {
  const future = "2026-10-23T20:00:00Z";
  const result = await collectGrowthReviewContext({
    question: "回顾最近一周", ownerAccountId: "owner-a", now,
    roomHistory: { list: async () => [roomEvent("future-room", "future-only", future, "created", "未来房间内容")] },
    assistantHistory: { list: async () => [conversation("future-ai", future, future, [future])] },
    reviewHistory: { listMetadata: async () => [{ title: "未来的旅程完成记录", status: "completed", createdAt: future }] },
  });
  expect(result.records).toHaveLength(1);
  const text = result.records[0]!.text;
  expect(text).toContain("0 个房间、0 条真实操作");
  expect(text).not.toContain("未来房间内容");
  expect(text).not.toContain("future-ai 提问");
  expect(text).not.toContain("未来的旅程完成记录");
});

test("coverage remains internal while no-match data keeps truthful dates and zero counts", async () => {
  const result = await collectGrowthReviewContext({ question: "最近一周", ownerAccountId: "owner-a", now,
    journal: { listRecords: async () => [], loadRecord: async () => null },
    assistantHistory: { list: async () => [] }, roomHistory: { list: async () => [] },
    reviewHistory: { listMetadata: async () => [] },
  });
  expect(result.records).toHaveLength(1);
  const coverage = result.records[0]!.text;
  expect(coverage).toContain("成长回顾内部资料边界");
  expect(coverage).toContain("不作为逐项向用户说明的内容");
  expect(coverage).not.toContain("必须向我明确说明缺口");
  expect(coverage).toContain("2026-10-17 至 2026-10-23");
  expect(coverage).toContain("手记：范围内有 0 篇");
  expect(coverage).toContain("0 个房间、0 条真实操作");
  expect(coverage).toContain("未提供的内容不能推断");
});

const unparsedFollowupRanges = [
  "只看周一到周三的记录。",
  "只看星期一到星期三的记录。",
  "只看周末的记录。",
  "周末呢？",
  "工作日呢？",
  "回顾最近一周，但只看工作日。",
  "只看国庆假期的记录。",
  "改成国庆假期。",
  "仅限周末。",
  "日期换成假期。",
  "只看今天的记录。",
  "改成昨天。",
  "上周呢？",
  "上个月呢？",
  "回顾最近一周，但只看今天的记录。",
  "只看2026-10-20至2026-10-21的记录。",
  "回顾最近一周和所有记录。",
  "查看所有记录，再回顾最近一周。",
];

test.each(unparsedFollowupRanges)("new unresolved or conflicting scope cannot inherit a previous month: %s", async question => {
  const previous = { startDate: "2026-09-23", endDate: "2026-10-23", label: "最近一个月" };
  expect(resolveGrowthReviewPeriod(question, previous, now)).toBeNull();
  const source = journal(["2026-10-01", "2026-10-23"], "旧整月范围的正文不应在缩小范围时读取");
  await expect(collectGrowthReviewContext({ question, period: previous, ownerAccountId: "owner-a", journal: source, now })).rejects.toThrow("growth-review-period-required");
  expect(source.listRecords).not.toHaveBeenCalled();
  expect(source.loadRecord).not.toHaveBeenCalled();
});

test.each([
  "查看我最近一周的所有记录。",
  "回顾最近一周所有留存记录。",
])("all records qualified by one finite range remain finite: %s", question => {
  expect(resolveGrowthReviewPeriod(question, { startDate: null, endDate: "2026-10-23", label: "所有" }, now))
    .toMatchObject({ startDate: "2026-10-17", endDate: "2026-10-23" });
});

test.each([
  "查看我最近一周的记录，给我明天能做的一个建议。",
  "查看我最近一周的记录，给我接下来半年从今天开始的行动建议。",
  "查看我最近一周的记录，给我接下来半年成长的建议。",
])("future advice does not become a new historical scope: %s", question => {
  expect(resolveGrowthReviewPeriod(question, { startDate: "2026-09-23", endDate: "2026-10-23", label: "最近一个月" }, now))
    .toMatchObject({ startDate: "2026-10-17", endDate: "2026-10-23" });
});

test.each([
  ["改成最近一周。", "2026-10-17"],
  ["只看最近一周的记录。", "2026-10-17"],
  ["仅限最近30天。", "2026-09-24"],
])("a fully consumed scope change still selects its supported finite period: %s", (question, startDate) => {
  expect(resolveGrowthReviewPeriod(question, { startDate: "2026-09-23", endDate: "2026-10-23", label: "最近一个月" }, now))
    .toMatchObject({ startDate, endDate: "2026-10-23" });
});
