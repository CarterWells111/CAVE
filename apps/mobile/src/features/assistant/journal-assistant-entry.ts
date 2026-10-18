import type { JournalPeriodReviewContext } from "./assistant-journal";

export const JOURNAL_ASSISTANT_STARTER = "我有一些想记下来的事，我描述给你，你帮我梳理记录一下：";

export const JOURNAL_PERIOD_REVIEW_STARTER = "我想回顾这段时间的经历，请结合我选择的手记，先问我一个简单的问题，帮我梳理阶段小结。";

export type JournalAssistantEntry = Readonly<{ id: number; accountId: string; periodReview?: JournalPeriodReviewContext }>;

let nextEntryId = 0;
let pendingEntry: JournalAssistantEntry | null = null;

export function stageJournalAssistantEntry(accountId: string): void {
  pendingEntry = { id: ++nextEntryId, accountId };
}

export function stageJournalPeriodReviewEntry(accountId: string, context: JournalPeriodReviewContext): void {
  pendingEntry = { id: ++nextEntryId, accountId, periodReview: { ...context, sourceRecordIds: [...context.sourceRecordIds] } };
}

export function takeJournalAssistantEntry(accountId: string | undefined): JournalAssistantEntry | null {
  const entry = pendingEntry;
  pendingEntry = null;
  return accountId && entry?.accountId === accountId ? entry : null;
}
