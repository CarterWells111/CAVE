import { RoomAccess, useRoomApi } from "../../src/features/rooms/ui/room-access";
import { RoomNewPage } from "../../src/features/rooms/ui/room-pages";

export default function NewRoomRoute() {
  return <RoomAccess returnTo="/rooms/new"><Content /></RoomAccess>;
}

function Content() {
  const api = useRoomApi();
  return api ? <RoomNewPage api={api} /> : null;
}
