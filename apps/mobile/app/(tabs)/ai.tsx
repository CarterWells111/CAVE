import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { AssistantHub } from "../../src/features/assistant/AssistantHub";
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
  useFocusEffect(useCallback(() => {
    const next = takeReportHandoff("ai", accountId);
    if (next) setHandoff(next);
  }, [accountId]));
  const currentHandoff = handoff?.accountId === accountId ? handoff : null;
  return <AssistantHub key={currentHandoff?.id ?? "default"} {...(currentHandoff ? { initialDraft: currentHandoff.text } : {})} {...(typeof journeyId === "string" ? { journeyId } : {})} />;
}
