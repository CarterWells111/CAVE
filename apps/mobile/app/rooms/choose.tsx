import { useLocalSearchParams, useRouter } from "expo-router";

import { useOptionalJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { prepareFirstOvernight } from "../../src/features/shell/application/journey-entry";
import { isRoomScenarioId } from "../../src/features/rooms/domain/room";
import { RoomChoicePage } from "../../src/features/rooms/ui/room-pages";
import { Screen } from "../../src/core/ui/Screen";
import { ErrorState } from "../../src/core/ui/ErrorState";

export default function RoomChoiceRoute() {
  const { scenario } = useLocalSearchParams<{ scenario?: string }>();
  if (!isRoomScenarioId(scenario)) return <Screen><ErrorState title="未找到情景" message="请从房间页重新选择。" /></Screen>;
  return <Content scenario={scenario} />;
}

function Content({ scenario }: { scenario: "first-overnight" | "pause" | "adjust" }) {
  const runtime = useOptionalJourneyRuntime();
  const router = useRouter();
  return <RoomChoicePage scenarioId={scenario} onDuo={() => router.push({ pathname: "/rooms/start", params: { scenario } })} onSingle={async () => {
    if (scenario !== "first-overnight") {
      router.push({ pathname: "/practice/session", params: { scenario } });
      return;
    }
    if (runtime) router.push(await prepareFirstOvernight(runtime));
    else router.push("/journey/adult-gate");
  }} />;
}
