import { canEditJournalItem, type JournalRecord, type JournalEntry } from "./journal-record";

export type JournalWriteGuard = Readonly<{ canCommit(): boolean }>;
export type JournalEntryGuard = JournalWriteGuard & Readonly<{ expected: JournalRecord; expectedEntries?: readonly JournalEntry[] }>;
export type JournalUpdateGuard = JournalWriteGuard & Readonly<{ expected: JournalRecord; now(): string }>;

export function checkJournalWriteGuard(guard?: JournalWriteGuard): void {
  if (guard && !guard.canCommit()) throw new Error("journal-session-changed");
}

// Compare values, including the original prose, rather than a timestamp alone:
// two local edits can share the same millisecond.
function sameJournalValue(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    return value;
  };
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function sameJournalRecord(left: JournalRecord, right: JournalRecord): boolean { return sameJournalValue(left, right); }

export function checkJournalUpdateGuard(current: JournalRecord | null, guard: JournalUpdateGuard): void {
  checkJournalWriteGuard(guard);
  if (!current) throw new Error("journal-record-not-found");
  if (!sameJournalRecord(current, guard.expected)) throw new Error("journal-record-conflict");
  if (!canEditJournalItem(guard.now(), current.editableUntil)) throw new Error("journal-item-locked");
}

// Adding a later insight does not edit the original record or use its edit window.
export function checkJournalEntryGuard(current: JournalRecord | null, entries: readonly JournalEntry[], guard: JournalEntryGuard): void {
  checkJournalWriteGuard(guard);
  if (!current) throw new Error("journal-record-not-found");
  if (!sameJournalRecord(current, guard.expected)) throw new Error("journal-record-conflict");
  if (guard.expectedEntries) {
    const byId = (values: readonly JournalEntry[]) => [...values].sort((left, right) => left.id.localeCompare(right.id));
    const currentEntries = byId(entries);
    const expectedEntries = byId(guard.expectedEntries);
    if (currentEntries.length !== expectedEntries.length || currentEntries.some((entry, index) => {
      // The same canonical value comparison also applies to entry snapshots.
      return !sameJournalValue(entry, expectedEntries[index]);
    })) throw new Error("journal-record-conflict");
  }
}
