/** @jest-environment node */
import { buildGrowthSeries, createGrowthData, emptyGrowthData, type GrowthData, type GrowthEvent } from "./growth-records";

const now = new Date(2026, 9, 23, 12);
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString();
const event = (id: string, metric: GrowthEvent["metric"], time: string): GrowthEvent => ({ id, metric, at: time });
const data = (...events: GrowthEvent[]): GrowthData => ({ events, undatedAiTurns: 0, notes: [] });

test("week includes seven local calendar days, both boundaries, and zero days", () => {
  const series = buildGrowthSeries(data(
    event("before", "journal", new Date(2026, 9, 16, 23, 59, 59).toISOString()),
    event("first", "journal", at(17, 0)),
    event("today", "ai", now.toISOString()),
    event("future", "review", at(23, 13)),
    event("tomorrow", "journey", at(24, 0)),
  ), "week", now);
  expect(series.start).toEqual(new Date(2026, 9, 17));
  expect(series.end).toEqual(new Date(2026, 9, 24));
  expect(series.buckets).toHaveLength(7);
  expect(series.buckets[0]!.counts.journal).toBe(1);
  expect(series.buckets[1]!.counts).toEqual({ journal: 0, review: 0, journey: 0, ai: 0 });
  expect(series.buckets[6]!.counts.ai).toBe(1);
  expect(series.totals).toEqual({ journal: 1, review: 0, journey: 0, ai: 1 });
});

test("month means thirty local days and handles year boundaries", () => {
  const series = buildGrowthSeries(emptyGrowthData(), "month", new Date(2026, 0, 3, 12));
  expect(series.buckets).toHaveLength(30);
  expect(series.start).toEqual(new Date(2025, 11, 5));
  expect(series.end).toEqual(new Date(2026, 0, 4));
});

test("halfYear uses six calendar months including the current partial month", () => {
  const series = buildGrowthSeries(data(event("edge", "review", new Date(2025, 7, 1).toISOString())), "halfYear", new Date(2026, 0, 23, 12));
  expect(series.start).toEqual(new Date(2025, 7, 1));
  expect(series.buckets).toHaveLength(6);
  expect(series.buckets[0]!.counts.review).toBe(1);
  expect(series.buckets[5]!.end).toEqual(new Date(2026, 0, 24));
});

test("counts each metric and identifier once and ignores malformed or future events", () => {
  const original = data(
    event("same", "journal", at(20)), event("same", "journal", at(21)),
    event("same", "review", at(20)), event("bad", "ai", "not-a-date"),
    event("future", "journey", at(25)), event("first-invalid", "ai", "bad"),
    event("first-invalid", "ai", at(22)),
  );
  const before = JSON.stringify(original);
  expect(buildGrowthSeries(original, "week", now).totals).toEqual({ journal: 1, review: 1, journey: 0, ai: 1 });
  expect(JSON.stringify(original)).toBe(before);
});

test("all spans long histories with no more than thirty buckets and includes the oldest event", () => {
  const series = buildGrowthSeries(data(
    event("oldest", "journal", new Date(1999, 0, 2).toISOString()),
    event("latest", "ai", at(23)),
  ), "all", now);
  expect(series.buckets.length).toBeLessThanOrEqual(30);
  expect(series.buckets[0]!.start.getTime()).toBeLessThanOrEqual(new Date(1999, 0, 2).getTime());
  expect(series.buckets[series.buckets.length - 1]!.end).toEqual(new Date(2026, 9, 24));
  expect(series.totals.journal).toBe(1);
  expect(series.totals.ai).toBe(1);
});

test("empty or future-only all histories retain a zero bucket for today", () => {
  for (const value of [emptyGrowthData(), data(event("future", "ai", at(30)))]) {
    const series = buildGrowthSeries(value, "all", now);
    expect(series.buckets).toHaveLength(1);
    expect(series.start).toEqual(new Date(2026, 9, 23));
    expect(series.totals).toEqual({ journal: 0, review: 0, journey: 0, ai: 0 });
  }
});

test("day buckets follow the local calendar through DST transitions", () => {
  const series = buildGrowthSeries(emptyGrowthData(), "week", new Date(2026, 9, 28, 12));
  expect(series.buckets).toHaveLength(7);
  expect(series.buckets.map(bucket => bucket.start.getDate())).toEqual([22, 23, 24, 25, 26, 27, 28]);
  expect(series.buckets.every(bucket => bucket.start.getHours() === 0 && bucket.end.getHours() === 0)).toBe(true);
});

test("source conversion keeps period reviews separate and counts only completed journey reviews", () => {
  const sources = createGrowthData({
    journalRecords: [{ id: "record", createdAt: at(17) }, { id: "record", createdAt: at(17) }],
    periodReviews: [{ id: "period", createdAt: at(18) }],
    journeyReviews: [
      { id: "completed", createdAt: at(19), status: "completed" },
      { id: "incomplete", createdAt: at(20), status: "incomplete" },
    ],
    conversations: [],
  });
  expect(buildGrowthSeries(sources, "week", now).totals).toEqual({ journal: 1, review: 1, journey: 1, ai: 0 });
  expect(sources.notes.join("")).toContain("不按账号区分");
  expect(sources.events.find(item => item.metric === "review")?.href).toBeUndefined();
});

test("legacy AI turns remain undated and are never assigned the conversation date", () => {
  const conversation = {
    id: "conversation",
    turns: [
      { question: "旧问题", response: { status: "ok" as const, providerMode: "mock" as const, message: "旧回复", observations: [], sources: [] } },
      { question: "新问题", response: { status: "ok" as const, providerMode: "mock" as const, message: "新回复", observations: [], sources: [] }, createdAt: at(20) },
    ],
  };
  const sources = createGrowthData({ journalRecords: [], periodReviews: [], journeyReviews: [], conversations: [conversation, conversation] });
  expect(sources.undatedAiTurns).toBe(1);
  expect(sources.events).toHaveLength(1);
  expect(buildGrowthSeries(sources, "week", now).totals.ai).toBe(1);
  expect(sources.notes.join("")).toContain("未纳入时间曲线");
});
