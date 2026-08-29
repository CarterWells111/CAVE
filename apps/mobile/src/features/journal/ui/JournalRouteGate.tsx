import { usePathname, useRouter } from "expo-router";
import { type PropsWithChildren, useCallback, useEffect, useRef } from "react";
import { Alert, Text } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Screen } from "../../../core/ui/Screen";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { useJournalAccess } from "../runtime/JournalAccessProvider";

export function JournalRouteGate({ children }: PropsWithChildren) {
  const access = useJournalAccess();
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const loginPrompted = useRef(false);
  const previewPrompted = useRef(false);
  const goToLogin = useCallback(
    () => router.push({ pathname: "/auth/email", params: { returnTo: pathname } }),
    [pathname, router],
  );

  useEffect(() => {
    if (access.status !== "locked" || loginPrompted.current) return;
    loginPrompted.current = true;
    const previewNotice = access.temporaryPreview
      ? "\n\n当前为 Expo Go 临时预览，关闭后不会保留记录。"
      : "";
    Alert.alert(
      "登录后使用内界手记",
      `登录会把这台设备上的手记与账号关联，避免同一设备上的其他账号查看。手记正文、后来与阶段回顾仍只保存在本机，不会上传；卸载 App 或清除本机数据仍会丢失。${previewNotice}`,
      [
        { text: "取消", style: "cancel", onPress: () => router.back() },
        {
          text: "去登录",
          onPress: goToLogin,
        },
      ],
    );
  }, [access.status, access.temporaryPreview, goToLogin, router]);

  useEffect(() => {
    if (access.status !== "ready" || !access.temporaryPreview || previewPrompted.current) return;
    previewPrompted.current = true;
    Alert.alert(
      "Expo Go 临时预览",
      "关闭 App 后，本次手记记录不会保留。请使用正式安装包保存手记。",
    );
  }, [access.status, access.temporaryPreview]);

  if (access.status === "ready") return children;
  if (access.status === "error") {
    return (
      <Screen>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          暂时无法读取手记
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          本机内容没有因此被删除。请重试账号与手记的本机绑定检查。
        </Text>
        <Button label="重试读取手记" onPress={access.retry} />
      </Screen>
    );
  }
  if (access.status === "locked") {
    return (
      <Screen>
        <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          登录后可打开与当前账号绑定的本机手记。
        </Text>
        <Button label="去登录" onPress={goToLogin} />
        <SecondaryButton label="返回上一页" onPress={() => router.back()} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
        正在读取当前账号的本机手记…
      </Text>
    </Screen>
  );
}
