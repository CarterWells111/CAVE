import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { useOptionalAuth } from "../../src/features/auth/runtime/AuthProvider";
import { stageReportHandoff } from "../../src/features/rooms/application/report-handoff";
import { saveRoomReportImage } from "../../src/features/rooms/infrastructure/save-room-report-image";
import { RoomAccess, useRoomApi } from "../../src/features/rooms/ui/room-access";
import { RoomDetailPage } from "../../src/features/rooms/ui/room-pages";

export default function RoomDetailRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return <RoomAccess returnTo={`/rooms/${encodeURIComponent(roomId)}`}><Content roomId={roomId} /></RoomAccess>;
}

function Content({ roomId }: { roomId: string }) {
  const api = useRoomApi();
  const accountId = useOptionalAuth()?.accountId;
  const router = useRouter();
  return api && accountId ? <RoomDetailPage api={api} roomId={roomId} onDiscuss={(draft, scenarioId) => {
    stageReportHandoff("ai", accountId, roomId, draft);
    router.push({ pathname: "/(tabs)/ai", params: { journeyId: scenarioId } });
  }} onRecord={(text) => {
    stageReportHandoff("journal", accountId, roomId, text);
    router.push("/journal/new");
  }} onExport={async (view: View) => {
    const result = await saveRoomReportImage(view);
    if (result === "permission-denied") throw new Error("PERMISSION_DENIED");
  }} /> : null;
}
