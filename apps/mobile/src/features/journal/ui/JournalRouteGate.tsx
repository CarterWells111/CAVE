import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef } from "react";
import { Alert, Text } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Screen } from "../../../core/ui/Screen";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { useJournalAccess } from "../runtime/JournalAccessProvider";

export function JournalRouteGate({ children }: PropsWithChildren) {
  const access = useJournalAccess();
  const pathname = usePathname();
  const { cardId, reviewId } = useLocalSearchParams<{ cardId?: string; reviewId?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const loginPrompted = useRef(false);
  const previewPrompted = useRef(false);
  const returnTo = useMemo(() => {
    const query = [
      typeof cardId === "string" ? `cardId=${encodeURIComponent(cardId)}` : null,
      typeof reviewId === "string" ? `reviewId=${encodeURIComponent(reviewId)}` : null,
    ].filter((value): value is string => value !== null);
    return query.length === 0 ? pathname : `${pathname}?${query.join("&")}`;
  }, [cardId, pathname, reviewId]);
  const goToLogin = useCallback(
    () => router.push({ pathname: "/auth/email", params: { returnTo } }),
    [returnTo, router],
  );

  useEffect(() => {
    if (access.status !== "locked" || loginPrompted.current) return;
    loginPrompted.current = true;
    const persistenceNotice = access.journalPersistence === "plaintext-sqlite"
      ? "\n\n当前为 Expo Go 开发预览：手记会在此安装中跨重启保留，但未使用 SQLCipher 加密。卸载 Expo Go、清除项目数据或主动删除后不可恢复。"
      : access.journalPersistence === "memory-only"
        ? "\n\n当前手记仅在本次内存会话中保留，关闭 App 后会丢失。"
        : "\n\n正式构建中的手记会在本机加密保存。";
    Alert.alert(
      "登录后使用内界手记",
      `登录会把这台设备上的手记与账号关联，避免同一设备上的其他账号查看。手记正文、后来与阶段回顾仍只保存在本机，不会上传；卸载 App 或清除本机数据仍会丢失。${persistenceNotice}`,
      [
        { text: "取消", style: "cancel", onPress: () => router.back() },
        {
          text: "去登录",
          onPress: goToLogin,
        },
      ],
    );
  }, [access.journalPersistence, access.status, goToLogin, router]);

  useEffect(() => {
    if (access.status !== "ready" || access.journalPersistence === "sqlcipher" || previewPrompted.current) return;
    previewPrompted.current = true;
    if (access.journalPersistence === "plaintext-sqlite") {
      Alert.alert(
        "Expo Go 明文存储提示",
        "手记会在此安装中跨重启保留，但数据库未使用 SQLCipher 加密。此模式仅适合开发预览，请勿录入真实敏感内容。卸载 Expo Go、清除项目数据或主动删除后不可恢复。",
      );
      return;
    }
    Alert.alert(
      "临时手记预览",
      "手记只存在于本次内存会话，关闭 App 后不会保留。请使用正式安装包保存手记。",
    );
  }, [access.journalPersistence, access.status]);

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
