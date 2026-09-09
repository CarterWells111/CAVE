import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { useAdultDeclaration } from "../journey/runtime/JourneyRuntimeProvider";
import { AssistantChat } from "./assistant-chat";

export function AssistantHub({ journeyId = "first-overnight" }: { journeyId?: string }) {
  const auth = useOptionalAuth();
  const adult = useAdultDeclaration();
  return <AssistantChat key={`${auth?.accountId ?? "signed-out"}:${adult.status}:${journeyId}`} journeyId={journeyId} authorized={adult.status === "authorized"} />;
}
