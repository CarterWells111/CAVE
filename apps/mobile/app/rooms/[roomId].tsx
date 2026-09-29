import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { saveRoomReportImage } from "../../src/features/rooms/infrastructure/save-room-report-image";
import { RoomAccess, useRoomApi } from "../../src/features/rooms/ui/room-access";
import { RoomDetailPage } from "../../src/features/rooms/ui/room-pages";

export default function RoomDetailRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return <RoomAccess returnTo={`/rooms/${encodeURIComponent(roomId)}`}><Content roomId={roomId} /></RoomAccess>;
}

function Content({ roomId }: { roomId: string }) {
  const api = useRoomApi();
  return api ? <RoomDetailPage api={api} roomId={roomId} onExport={async (view: View) => {
    const result = await saveRoomReportImage(view);
    if (result === "permission-denied") throw new Error("PERMISSION_DENIED");
  }} /> : null;
}
