import { useLocalSearchParams } from "expo-router";
import { AssistantHub } from "../../src/features/assistant/AssistantHub";

export default function AiTabRoute() {
  const { journeyId } = useLocalSearchParams<{ journeyId?: string }>();
  return <AssistantHub {...(typeof journeyId === "string" ? { journeyId } : {})} />;
}
