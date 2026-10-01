import { RoomAccess, useRoomApi } from "../../src/features/rooms/ui/room-access";
import { MyRoomsPage } from "../../src/features/rooms/ui/room-pages";

export default function MyRoomsRoute() {
  return <RoomAccess returnTo="/rooms/mine"><Content /></RoomAccess>;
}

function Content() {
  const api = useRoomApi();
  return api ? <MyRoomsPage api={api} /> : null;
}
