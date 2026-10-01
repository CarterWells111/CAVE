import { useLocalSearchParams } from "expo-router";

import { normalizeInviteToken } from "../src/features/rooms/domain/room";
import { RoomAccess, useRoomApi } from "../src/features/rooms/ui/room-access";
import { RoomJoinPage } from "../src/features/rooms/ui/room-pages";

export default function JoinRoute() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const normalized = normalizeInviteToken(invite);
  return <RoomAccess returnTo={normalized ? `/join?invite=${encodeURIComponent(normalized)}` : "/join"}><Content {...(normalized ? { token: normalized } : {})} /></RoomAccess>;
}

function Content({ token }: { token?: string }) {
  const api = useRoomApi();
  return api ? <RoomJoinPage api={api} {...(token ? { initialToken: token } : {})} /> : null;
}
