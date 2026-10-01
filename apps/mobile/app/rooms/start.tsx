import { useLocalSearchParams } from "expo-router";

import { ErrorState } from "../../src/core/ui/ErrorState";
import { Screen } from "../../src/core/ui/Screen";
import { isRoomScenarioId, type RoomScenarioId } from "../../src/features/rooms/domain/room";
import { RoomAccess, useRoomApi } from "../../src/features/rooms/ui/room-access";
import { RoomStartPage } from "../../src/features/rooms/ui/room-pages";

export default function RoomStartRoute() {
  const { scenario } = useLocalSearchParams<{ scenario?: string }>();
  if (!isRoomScenarioId(scenario)) return <Screen><ErrorState title="未找到情景" message="请从房间页重新选择。" /></Screen>;
  return <RoomAccess returnTo={`/rooms/start?scenario=${scenario}`}><Content scenario={scenario} /></RoomAccess>;
}

function Content({ scenario }: { scenario: RoomScenarioId }) {
  const api = useRoomApi();
  return api ? <RoomStartPage api={api} scenarioId={scenario} /> : null;
}
