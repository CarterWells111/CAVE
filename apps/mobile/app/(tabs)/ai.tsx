import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { AssistantHub } from "../../src/features/assistant/AssistantHub";
import { takeJournalAssistantEntry, type JournalAssistantEntry } from "../../src/features/assistant/journal-assistant-entry";
import { useOptionalAuth } from "../../src/features/auth/runtime/AuthProvider";
import { takeReportHandoff, type ReportHandoff } from "../../src/features/rooms/application/report-handoff";

export default function AiTabRoute() {
  const { journeyId } = useLocalSearchParams<{ journeyId?: string }>();
  const accountId = useOptionalAuth()?.accountId;
  // Discard consumed reports synchronously when the account changes, even off-screen.
  return <AccountAiTabRoute key={accountId === undefined ? "signed-out" : `account:${accountId}`} accountId={accountId} journeyId={typeof journeyId === "string" ? journeyId : undefined} />;
}

function AccountAiTabRoute({ accountId, journeyId }: { accountId: string | undefined; journeyId: string | undefined }) {
  const [handoff, setHandoff] = useState<ReportHandoff | null>(null);
  const [journalEntry, setJournalEntry] = useState<JournalAssistantEntry | null>(null);
  useFocusEffect(useCallback(() => {
    const nextJournal = takeJournalAssistantEntry(accountId);
    const next = takeReportHandoff("ai", accountId);
    if (nextJournal) {
      setJournalEntry(nextJournal);
      setHandoff(null);
    } else if (next) {
      setJournalEntry(null);
      setHandoff(next);
    }
  }, [accountId]));
  const onJournalEntryApplied = useCallback((id: number) => {
    setJournalEntry(current => current?.id === id ? null : current);
  }, []);
  const currentHandoff = handoff?.accountId === accountId ? handoff : null;
  const currentJournalEntry = journalEntry?.accountId === accountId ? journalEntry : null;
  return <AssistantHub key={currentHandoff?.id ?? "default"} {...(currentJournalEntry ? { journalEntry: currentJournalEntry, onJournalEntryApplied } : {})} {...(currentHandoff ? { initialDraft: currentHandoff.text } : {})} {...(typeof journeyId === "string" ? { journeyId } : {})} />;
}
