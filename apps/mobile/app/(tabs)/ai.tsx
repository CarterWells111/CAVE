import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { AssistantHub } from "../../src/features/assistant/AssistantHub";
import { useOptionalAuth } from "../../src/features/auth/runtime/AuthProvider";
import { takeReportHandoff, type ReportHandoff } from "../../src/features/rooms/application/report-handoff";

export default function AiTabRoute() {
  const { journeyId } = useLocalSearchParams<{ journeyId?: string }>();
  const accountId = useOptionalAuth()?.accountId;
  const [handoff, setHandoff] = useState<ReportHandoff | null>(null);
  useFocusEffect(useCallback(() => {
    const next = takeReportHandoff("ai", accountId);
    if (next) setHandoff(next);
  }, [accountId]));
  return <AssistantHub key={handoff?.id ?? "default"} {...(handoff ? { initialDraft: handoff.text } : {})} {...(typeof journeyId === "string" ? { journeyId } : {})} />;
}
