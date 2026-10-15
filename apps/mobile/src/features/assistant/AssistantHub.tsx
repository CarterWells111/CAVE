import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { useAdultDeclaration, useOptionalJourneyRuntime } from "../journey/runtime/JourneyRuntimeProvider";
import { AssistantChat } from "./assistant-chat";

export function AssistantHub({ journeyId = "first-overnight", initialDraft = "" }: { journeyId?: string; initialDraft?: string }) {
  const auth = useOptionalAuth();
  const adult = useAdultDeclaration();
  const historyRepository = useOptionalJourneyRuntime()?.assistantHistory;
  return <AssistantChat key={`${auth?.accountId ?? "signed-out"}:${adult.status}:${journeyId}`} journeyId={journeyId} authorized={adult.status === "authorized"} initialDraft={initialDraft} {...(historyRepository ? { historyRepository } : {})} />;
}
