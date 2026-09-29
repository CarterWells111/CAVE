import { useRouter } from "expo-router";
import { type PropsWithChildren, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Screen } from "../../../core/ui/Screen";
import { useAuth } from "../../auth/runtime/AuthProvider";
import { getGatewayUrl } from "../../../config/gateway";
import { useAdultDeclaration } from "../../journey/runtime/JourneyRuntimeProvider";
import type { RoomApi } from "../domain/room";
import { createRoomApiClient } from "../infrastructure/room-api-client";

export function useRoomApi(): RoomApi | null {
  const auth = useAuth();
  const accountId = auth.accountId;
  return useMemo(() => accountId && auth.status === "signedIn"
    ? createRoomApiClient({ baseUrl: getGatewayUrl(), getAccessToken: () => auth.getAssistantAccessToken(accountId) })
    : null, [accountId, auth]);
}

export function RoomAccess({ children, returnTo }: PropsWithChildren<{ returnTo: string }>) {
  const auth = useAuth();
  const adult = useAdultDeclaration();
  const router = useRouter();
  const theme = useTheme();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  if (adult.status === "authorized" && auth.status === "signedIn") return children;
  return <Screen contentSafeAreaTop>
    <View style={{ gap: theme.space.md }}>
      <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>双人房间</Text>
      {adult.status !== "authorized" ? <>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>每位参与者都需自行声明已满 18 岁。这里仅记录声明，不核验身份或年龄。</Text>
        <Button label="我已年满 18 岁" loading={pending} onPress={() => {
          setPending(true); setError(false);
          void adult.confirmAdult().catch(() => setError(true)).finally(() => setPending(false));
        }} />
      </> : <>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>每位参与者都要使用自己的账号登录。登录后会回到当前房间入口。</Text>
        {auth.status === "loading" ? <Text>正在检查账号…</Text> : <Button label="登录后继续" onPress={() => router.push({ pathname: "/auth/email", params: { returnTo } })} />}
      </>}
      {error ? <Text accessibilityRole="alert" selectable>确认失败，请重试。</Text> : null}
    </View>
  </Screen>;
}
