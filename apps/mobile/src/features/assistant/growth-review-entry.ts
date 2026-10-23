import { buildGrowthSeries, emptyGrowthData, type GrowthRange } from "../growth/growth-records";
import { journalDateFromDate } from "../journal/domain/journal-date";

export const GROWTH_REVIEW_STARTER = "查看我最近一个月的旅程、房间、手记和AI记录，回顾一下我的成长，给我一些接下来的建议。";

export function growthReviewStarter(range: GrowthRange, now = new Date()): string {
  const series = buildGrowthSeries(emptyGrowthData(), range, now);
  const period = range === "week" ? "最近一周" : range === "month" ? "最近30天"
    : range === "halfYear" ? `从${journalDateFromDate(series.start)}至${journalDateFromDate(now)}` : "所有留存记录";
  return `查看我${period}的旅程、房间、手记和AI记录，回顾一下我的成长，给我一些接下来的建议。`;
}

export type GrowthReviewEntry = Readonly<{ id: number; accountId: string; range?: GrowthRange; starter?: string }>;
let nextId = 0;
let pending: (GrowthReviewEntry & { createdAt: number }) | null = null;
const MAX_AGE_MS = 5 * 60 * 1000;

/** Stage only visible intent and date-range text, without private records or permissions. */
export function stageGrowthReviewEntry(ownerAccountId: string, range?: GrowthRange): void {
  if (!ownerAccountId.trim()) throw new Error("growth-review-account-required");
  if (range && !["week", "month", "halfYear", "all"].includes(range)) throw new Error("growth-review-range-invalid");
  pending = { id: ++nextId, accountId: ownerAccountId, range: range ?? "month",
    starter: range ? growthReviewStarter(range) : GROWTH_REVIEW_STARTER, createdAt: Date.now() };
}

export function takeGrowthReviewEntry(accountId: string | undefined): GrowthReviewEntry | null {
  const entry = pending;
  pending = null;
  if (!entry || entry.accountId !== accountId || Date.now() - entry.createdAt > MAX_AGE_MS) return null;
  return { id: entry.id, accountId: entry.accountId, ...(entry.range ? { range: entry.range } : {}), ...(entry.starter ? { starter: entry.starter } : {}) };
}
