import type { AssistantConversation } from "../assistant/history/assistant-history-repository";
import type { JournalPeriodReview, JournalRecordSummary } from "../journal/infrastructure/journal-repository";
import type { ReviewVersionMetadata } from "../reviews/infrastructure/review-history-repository";

export const GROWTH_METRICS = ["journal", "review", "journey", "ai"] as const;
export type GrowthMetric = (typeof GROWTH_METRICS)[number];
export type GrowthEvent = { id: string; metric: GrowthMetric; at: string; title?: string; href?: string };
export type GrowthData = { events: GrowthEvent[]; undatedAiTurns: number; notes: string[] };
export type GrowthRange = "week" | "month" | "halfYear" | "all";
export type GrowthCounts = Record<GrowthMetric, number>;
export type GrowthBucket = { key: string; label: string; start: Date; end: Date; counts: GrowthCounts };
export type GrowthSeries = { buckets: GrowthBucket[]; totals: GrowthCounts; start: Date; end: Date };

type GrowthSources = {
  journalRecords: readonly Pick<JournalRecordSummary, "id" | "createdAt">[];
  periodReviews: readonly Pick<JournalPeriodReview, "id" | "createdAt">[];
  journeyReviews: readonly Pick<ReviewVersionMetadata, "id" | "createdAt" | "status">[];
  conversations: readonly Pick<AssistantConversation, "id" | "turns">[];
};

export function emptyGrowthData(): GrowthData {
  return { events: [], undatedAiTurns: 0, notes: [] };
}

/** Read metadata only; historical AI turns without their own date remain undated. */
export function createGrowthData(sources: GrowthSources): GrowthData {
  const events = new Map<string, GrowthEvent>();
  const undated = new Set<string>();
  const add = (event: GrowthEvent) => {
    const key = `${event.metric}:${event.id}`;
    if (!events.has(key)) events.set(key, event);
  };
  for (const record of sources.journalRecords) add({
    id: record.id, metric: "journal", at: record.createdAt, title: "写下手记",
    href: `/journal/${encodeURIComponent(record.id)}`,
  });
  for (const review of sources.periodReviews) add({
    id: review.id, metric: "review", at: review.createdAt, title: "留下阶段回顾",
  });
  for (const review of sources.journeyReviews) {
    if (review.status !== "completed") continue;
    add({
      id: review.id, metric: "journey", at: review.createdAt, title: "完成旅程回顾",
      href: `/reviews/${encodeURIComponent(review.id)}`,
    });
  }
  for (const conversation of sources.conversations) {
    conversation.turns.forEach((turn, index) => {
      const id = `${conversation.id}:${index}`;
      if (!turn.createdAt || !Number.isFinite(Date.parse(turn.createdAt))) {
        undated.add(id);
        return;
      }
      add({ id, metric: "ai", at: turn.createdAt, title: "与 AI 交流", href: "/assistant-history" });
    });
  }
  const notes = [
    "手记和阶段回顾按保存时间统计，删除后不再计入。",
    "旅程统计本机已保存的完成记录，不按账号区分。",
  ];
  if (undated.size > 0) notes.push(`${undated.size} 条较早的 AI 交流没有时间信息，未纳入时间曲线。`);
  return { events: [...events.values()], undatedAiTurns: undated.size, notes };
}

const emptyCounts = (): GrowthCounts => ({ journal: 0, review: 0, journey: 0, ai: 0 });
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function calendarDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

/** end is exclusive. Calendar boundaries use the device timezone, including DST. */
export function buildGrowthSeries(data: GrowthData, range: GrowthRange, now: Date): GrowthSeries {
  if (!Number.isFinite(now.getTime())) throw new Error("growth-now-invalid");
  const seen = new Set<string>();
  const events = data.events.flatMap(event => {
    const time = Date.parse(event.at);
    const key = `${event.metric}:${event.id}`;
    if (!Number.isFinite(time) || time > now.getTime() || seen.has(key)) return [];
    seen.add(key);
    return [{ ...event, time }];
  });
  const today = dayStart(now);
  const end = shiftDays(today, 1);
  let start: Date;
  let monthStep = 0;
  if (range === "week" || range === "month") {
    start = shiftDays(end, range === "week" ? -7 : -30);
  } else if (range === "halfYear") {
    start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    monthStep = 1;
  } else {
    const earliest = events.reduce((minimum, event) => Math.min(minimum, event.time), now.getTime());
    start = dayStart(new Date(earliest));
    if (calendarDayNumber(today) - calendarDayNumber(start) + 1 > 30) {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
      const months = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth() + 1;
      monthStep = Math.ceil(months / 30);
    }
  }
  const buckets: GrowthBucket[] = [];
  for (let cursor = new Date(start); cursor < end;) {
    const boundary = monthStep
      ? new Date(cursor.getFullYear(), cursor.getMonth() + monthStep, 1)
      : shiftDays(cursor, 1);
    const next = boundary < end ? boundary : new Date(end);
    buckets.push({
      key: dateKey(cursor),
      label: monthStep ? `${cursor.getFullYear()}/${cursor.getMonth() + 1}` : `${cursor.getMonth() + 1}/${cursor.getDate()}`,
      start: new Date(cursor), end: next, counts: emptyCounts(),
    });
    cursor = next;
  }
  const totals = emptyCounts();
  for (const event of events) {
    const bucket = buckets.find(item => event.time >= item.start.getTime() && event.time < item.end.getTime());
    if (!bucket) continue;
    bucket.counts[event.metric] += 1;
    totals[event.metric] += 1;
  }
  return { buckets, totals, start: new Date(start), end };
}
