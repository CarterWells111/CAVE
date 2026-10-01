export type ReportHandoffTarget = "ai" | "journal";

export type ReportHandoff = Readonly<{
  id: number;
  target: ReportHandoffTarget;
  accountId: string;
  roomId: string;
  text: string;
}>;

let nextId = 0;
let pending: (ReportHandoff & { createdAt: number }) | null = null;
const MAX_AGE_MS = 5 * 60 * 1000;

// Keep the report out of navigation URLs, analytics and persistent storage.
export function stageReportHandoff(target: ReportHandoffTarget, accountId: string, roomId: string, text: string): void {
  if (!accountId || !roomId || !text.trim()) throw new Error("room-report-handoff-invalid");
  pending = { id: ++nextId, target, accountId, roomId, text, createdAt: Date.now() };
}

export function takeReportHandoff(target: ReportHandoffTarget, accountId: string | null | undefined): ReportHandoff | null {
  if (!pending) return null;
  if (Date.now() - pending.createdAt > MAX_AGE_MS || pending.accountId !== accountId) {
    pending = null;
    return null;
  }
  if (pending.target !== target) return null;
  const { id, roomId, text, accountId: stagedAccountId } = pending;
  pending = null;
  return { id, target, accountId: stagedAccountId, roomId, text };
}

export function reportJournalDraftKey(roomId: string, text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `new:room-report:${roomId}:${(hash >>> 0).toString(16)}`;
}
