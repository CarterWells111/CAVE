import type { AssistantUsage } from "@cave/contracts";
export type AssistantLimits = { hour: number | null; day: number | null };
export interface AssistantUsageStore {
  read(accountId: string, now: number): Promise<AssistantUsage>;
  consume(accountId: string, now: number): Promise<boolean>;
}
export function parseAssistantLimit(value: unknown): number | null {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("invalid-assistant-limit");
  return Number(value);
}
type Row = { hour_start: number; hour_used: number; day_start: number; day_used: number };
const HOUR = 3600000;
const DAY = 86400000;
export class D1AssistantUsageStore implements AssistantUsageStore {
  constructor(private readonly db: D1Database, private readonly limits: AssistantLimits) {}
  async read(accountId: string, now: number): Promise<AssistantUsage> {
    const hour = Math.floor(now / HOUR) * HOUR;
    const day = Math.floor(now / DAY) * DAY;
    const row = await this.db.prepare("SELECT hour_start, hour_used, day_start, day_used FROM assistant_usage WHERE account_id = ?").bind(accountId).first<Row>();
    return {
      hour: { used: row?.hour_start === hour ? row.hour_used : 0, limit: this.limits.hour, resetsAt: new Date(hour + HOUR).toISOString() },
      day: { used: row?.day_start === day ? row.day_used : 0, limit: this.limits.day, resetsAt: new Date(day + DAY).toISOString() },
      measuredAt: new Date(now).toISOString(),
    };
  }
  async consume(accountId: string, now: number): Promise<boolean> {
    const hour = Math.floor(now / HOUR) * HOUR;
    const day = Math.floor(now / DAY) * DAY;
    // One primary-key UPSERT checks and increments BOTH windows atomically.
    // No read-then-write race and no partially consumed hour/day allowance.
    const result = await this.db.prepare(`INSERT INTO assistant_usage (account_id, hour_start, hour_used, day_start, day_used)
      VALUES (?, ?, 1, ?, 1)
      ON CONFLICT(account_id) DO UPDATE SET
        hour_used = CASE WHEN hour_start = excluded.hour_start THEN hour_used + 1 ELSE 1 END,
        day_used = CASE WHEN day_start = excluded.day_start THEN day_used + 1 ELSE 1 END,
        hour_start = excluded.hour_start, day_start = excluded.day_start
      WHERE (? IS NULL OR CASE WHEN hour_start = excluded.hour_start THEN hour_used ELSE 0 END < ?)
        AND (? IS NULL OR CASE WHEN day_start = excluded.day_start THEN day_used ELSE 0 END < ?)`)
      .bind(accountId, hour, day, this.limits.hour, this.limits.hour, this.limits.day, this.limits.day).run();
    if (!result.success) throw new Error("assistant-usage-write-failed");
    return result.meta.changes === 1;
  }
}
