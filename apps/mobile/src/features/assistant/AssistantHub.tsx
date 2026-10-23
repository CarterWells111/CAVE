import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { useAdultDeclaration, useOptionalJourneyRuntime } from "../journey/runtime/JourneyRuntimeProvider";
import { AssistantChat } from "./assistant-chat";
import type { GrowthReviewEntry } from "./growth-review-entry";
import type { JournalAssistantEntry } from "./journal-assistant-entry";

export function AssistantHub({ journeyId = "first-overnight", initialDraft = "", journalEntry, onJournalEntryApplied, growthEntry, onGrowthEntryApplied }: { journeyId?: string; initialDraft?: string; journalEntry?: JournalAssistantEntry; onJournalEntryApplied?(id: number): void; growthEntry?: GrowthReviewEntry; onGrowthEntryApplied?(id: number): void }) {
  const auth = useOptionalAuth();
  const adult = useAdultDeclaration();
  const historyRepository = useOptionalJourneyRuntime()?.assistantHistory;
  return <AssistantChat key={`${auth?.accountId ?? "signed-out"}:${adult.status}:${journeyId}`} journeyId={journeyId} authorized={adult.status === "authorized"} initialDraft={initialDraft} {...(growthEntry ? { growthEntry } : {})} {...(onGrowthEntryApplied ? { onGrowthEntryApplied } : {})} {...(journalEntry ? { journalEntry } : {})} {...(onJournalEntryApplied ? { onJournalEntryApplied } : {})} {...(historyRepository ? { historyRepository } : {})} />;
}
