import { collectAssistantQuestionContext } from "./assistant-question-context";
import type { JournalService } from "../journal/application/journal-service";
import { createJournalEntry, createJournalRecord, type JournalRecord } from "../journal/domain/journal-record";

const now = new Date(2026, 9, 14, 12);

function record(id: string, title: string, occurredAt = "2026-10-14", body = "一段用于测试的正文"): JournalRecord {
  return createJournalRecord({ id, title, occurredAt, createdAt: `${occurredAt}T12:00:00Z`, body,
    highlight: { kind: "impression", text: "一段用于测试的摘要" }, topics: [], source: { kind: "freeform" } });
}

function journal(records: readonly JournalRecord[], entries: Parameters<typeof createJournalEntry>[0][] = []) {
  return {
    listRecords: jest.fn(async () => records.map(({ id, title, occurredAt, createdAt, highlight, topics }) => ({ id, title, occurredAt, createdAt, highlight, topics }))),
    loadRecord: jest.fn(async (id: string) => {
      const found = records.find((item) => item.id === id);
      return found ? { record: found, entries: entries.filter((entry) => entry.recordId === id).map(createJournalEntry) } : null;
    }),
  } satisfies Pick<JournalService, "listRecords" | "loadRecord">;
}

test("loads only records matching the question in metadata, with their entries", async () => {
  const service = journal([
    record("related", "与伴侣争吵"), record("unrelated", "周末看电影"),
    record("body-only", "午间小记", "2026-10-14", "我和伴侣争吵了"),
  ], [{ id: "entry", recordId: "related", kind: "insight", occurredAt: "2026-10-14", createdAt: "2026-10-14T12:00:00Z", body: "补充一个不同的想法" }]);
  const result = await collectAssistantQuestionContext({ question: "帮我分析与伴侣争吵的原因", journal: service, now });
  expect(result.records.map((item) => item.id)).toEqual(["related"]);
  expect(service.loadRecord).toHaveBeenCalledTimes(1);
  expect(result.records[0]!.text).toContain("补充一个不同的想法");
});

test("matches highlight and topic labels", async () => {
  const highlighted = { ...record("highlight", "简单记录"), highlight: { kind: "feeling" as const, text: "我有些焦虑" } };
  const tagged = { ...record("topic", "另一个记录"), topics: ["self-boundaries" as const] };
  const service = journal([highlighted, tagged]);
  expect((await collectAssistantQuestionContext({ question: "怎么处理焦虑和自我边界", journal: service })).records.map((item) => item.id)).toEqual(["topic", "highlight"]);
});

test.each(["帮我写日记", "请帮我写一篇日记", "你好", "请解释光合作用"])("does not load unrelated records for %s", async (question) => {
  const service = journal([record("private", "与伴侣争吵")]);
  expect((await collectAssistantQuestionContext({ question, journal: service })).records).toEqual([]);
  expect(service.loadRecord).not.toHaveBeenCalled();
});

test.each([
  ["帮我整理今天的日记", "today"],
  ["回顾昨天的日记", "yesterday"],
  ["帮我整理今天的手记", "today"],
  ["回顾昨天的手记", "yesterday"],
])("selects the requested local calendar day: %s", async (question, expected) => {
  const service = journal([record("yesterday", "昨天一件事", "2026-10-13"), record("today", "今天一件事")]);
  const result = await collectAssistantQuestionContext({ question, journal: service, now });
  expect(result.records.map((item) => item.id)).toEqual([expected]);
});

test.each([
  "帮我写一篇新日记",
  "帮我写一篇今天的日记",
  "帮我写一篇新手记",
  "帮我写今天的手记",
  "帮我写一篇今天关于边界的手记",
])("new journal starters do not read old entries even when metadata matches: %s", async (question) => {
  const service = journal([
    { ...record("private", "新日记"), highlight: { kind: "impression" as const, text: "今天写一篇边界手记" } },
  ]);
  expect((await collectAssistantQuestionContext({ question, journal: service, now })).records).toEqual([]);
  expect(service.listRecords).not.toHaveBeenCalled();
  expect(service.loadRecord).not.toHaveBeenCalled();
});

test.each([
  "总结今天的边界日记，再写一篇新手记",
  "回顾今天的边界手记，再写一篇新日记",
  "根据已有的边界日记写一篇新手记",
])("writing based on existing journals still selects relevant records: %s", async (question) => {
  const service = journal([record("related", "边界"), record("unrelated", "电影")]);
  const result = await collectAssistantQuestionContext({ question, journal: service, now });
  expect(result.records.map((item) => item.id)).toEqual(["related"]);
  expect(service.loadRecord).toHaveBeenCalledTimes(1);
});

test("today does not fall back to a journal on a different day", async () => {
  const service = journal([record("old", "昨天一件事", "2026-10-13")]);
  expect((await collectAssistantQuestionContext({ question: "总结今天的日记", journal: service, now })).records).toEqual([]);
  expect(service.loadRecord).not.toHaveBeenCalled();
});

test("uses yesterday across the local month boundary", async () => {
  const service = journal([record("last-month", "一件事", "2026-09-30"), record("new-month", "另一件事", "2026-10-01")]);
  const result = await collectAssistantQuestionContext({ question: "昨天的日记", journal: service, now: new Date(2026, 9, 1, 0, 15) });
  expect(result.records.map((item) => item.id)).toEqual(["last-month"]);
});

test("chooses the latest matching journal first for an explicit recent request", async () => {
  const service = journal([record("old", "边界边界边界", "2026-09-01"), record("new", "边界", "2026-10-14"), record("other", "电影", "2026-10-14")]);
  const result = await collectAssistantQuestionContext({ question: "回顾最近关于边界的日记", journal: service, now });
  expect(result.records.map((item) => item.id)).toEqual(["new", "old"]);
});

test("caps the number and text length and excludes snapshots/source metadata", async () => {
  const records = Array.from({ length: 5 }, (_, index) => ({
    ...record(`record-${index}`, "边界", `2026-10-${10 + index}`, "正文".repeat(5_000)),
    source: { kind: "journey" as const, journeyId: "private-source" },
    cardSnapshot: { cardId: "private-card", capturedAt: "2026-10-14T12:00:00Z", sections: [{ id: "private-section", text: "private-snapshot" }] },
  }));
  const service = journal(records);
  const result = await collectAssistantQuestionContext({ question: "分析边界", journal: service });
  expect(result.records).toHaveLength(3);
  expect(service.loadRecord).toHaveBeenCalledTimes(3);
  expect(result.records.every((item) => item.text.length <= 4_000)).toBe(true);
  expect(result.records.reduce((length, item) => length + item.text.length, 0)).toBeLessThanOrEqual(12_000);
  expect(JSON.stringify(result)).not.toMatch(/private-source|private-card|private-section|private-snapshot/);
});

test("a duplicate summary is loaded only once", async () => {
  const service = journal([record("same", "边界"), record("same", "边界")]);
  expect((await collectAssistantQuestionContext({ question: "边界", journal: service })).records).toHaveLength(1);
  expect(service.loadRecord).toHaveBeenCalledTimes(1);
});

test("works when journal access is unavailable or the question is empty", async () => {
  expect(await collectAssistantQuestionContext({ question: "我的日记" })).toEqual({ records: [] });
  const service = journal([record("private", "边界")]);
  expect(await collectAssistantQuestionContext({ question: "  ", journal: service })).toEqual({ records: [] });
  expect(service.listRecords).not.toHaveBeenCalled();
});

test.each(["旅程", "练习", "过夜", "内容知识", "journey"])("includes a journey identifier only for an explicit request: %s", async (question) => {
  expect(await collectAssistantQuestionContext({ question, journeyId: "current-journey" })).toEqual({ records: [], journeyId: "current-journey" });
});

test.each(["你好", "我的日记", "帮我处理伴侣争吵"])("does not attach the current journey to %s", async (question) => {
  expect(await collectAssistantQuestionContext({ question, journeyId: "current-journey" })).toEqual({ records: [] });
});

test("already aborted requests do not read journal metadata", async () => {
  const controller = new AbortController();
  controller.abort();
  const service = journal([record("private", "边界")]);
  await expect(collectAssistantQuestionContext({ question: "边界", journal: service, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(service.listRecords).not.toHaveBeenCalled();
});

test("aborting after metadata load prevents reading any journal bodies", async () => {
  const controller = new AbortController();
  const service = journal([record("private", "边界")]);
  const originalList = service.listRecords;
  service.listRecords = jest.fn(async () => {
    const records = await originalList();
    controller.abort();
    return records;
  });
  await expect(collectAssistantQuestionContext({ question: "边界", journal: service, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(service.loadRecord).not.toHaveBeenCalled();
});

test("aborting during a body read rejects rather than returning partial private context", async () => {
  const controller = new AbortController();
  const service = journal([record("private", "边界")]);
  const originalLoad = service.loadRecord;
  service.loadRecord = jest.fn(async (id: string) => {
    const loaded = await originalLoad(id);
    controller.abort();
    return loaded;
  });
  await expect(collectAssistantQuestionContext({ question: "边界", journal: service, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
});

test("metadata read failures propagate to the caller", async () => {
  const service = journal([]);
  service.listRecords.mockRejectedValue(new Error("local-read-failed"));
  await expect(collectAssistantQuestionContext({ question: "边界", journal: service })).rejects.toThrow("local-read-failed");
});

test("body read failures propagate without silently returning partial context", async () => {
  const service = journal([record("private", "边界")]);
  service.loadRecord.mockRejectedValue(new Error("local-body-read-failed"));
  await expect(collectAssistantQuestionContext({ question: "边界", journal: service })).rejects.toThrow("local-body-read-failed");
});

test("records deleted after listing are skipped", async () => {
  const service = journal([record("deleted", "边界")]);
  service.loadRecord.mockResolvedValue(null);
  expect((await collectAssistantQuestionContext({ question: "边界", journal: service })).records).toEqual([]);
});
