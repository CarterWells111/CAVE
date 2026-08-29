export type JournalDate = string;

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

export function journalDateFromDate(value: Date): JournalDate {
  if (!Number.isFinite(value.getTime())) throw new Error("journal-date-invalid");
  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseJournalDate(value: string): Date {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (match === null) throw new Error("journal-date-invalid");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    throw new Error("journal-date-invalid");
  }
  return parsed;
}

export function normalizeJournalDate(value: string): JournalDate {
  const trimmed = value.trim();
  if (CALENDAR_DATE_PATTERN.test(trimmed)) return journalDateFromDate(parseJournalDate(trimmed));
  if (!trimmed.includes("T")) throw new Error("journal-date-invalid");
  const legacyTimestamp = new Date(trimmed);
  return journalDateFromDate(legacyTimestamp);
}

export function formatJournalDate(value: string): string {
  return parseJournalDate(normalizeJournalDate(value)).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function localJournalToday(): JournalDate {
  return journalDateFromDate(new Date());
}

export function isJournalDateInRange(value: string, start: string, end: string): boolean {
  const normalized = normalizeJournalDate(value);
  return normalized >= normalizeJournalDate(start) && normalized <= normalizeJournalDate(end);
}
