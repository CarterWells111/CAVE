import { useRoomApi } from "../../src/features/rooms/ui/room-access";
import { RoomListPage } from "../../src/features/rooms/ui/room-pages";

export default function RoomsTab() {
  const api = useRoomApi();
  return <RoomListPage api={api} />;
}
