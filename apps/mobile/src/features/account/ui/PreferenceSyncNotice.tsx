import { Pressable, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { useOptionalAccountPreferences } from "../runtime/AccountPreferencesProvider";

export function LoginSaveHint({ onPress, disabled = false }: { onPress?: (() => void) | undefined; disabled?: boolean }) {
  const theme = useTheme();
  if (onPress === undefined) return null;
  return <Pressable accessibilityRole="link" accessibilityLabel="登录后保存现有选择" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={{ alignSelf: "center", justifyContent: "center", minHeight: theme.size.minimumTouchTarget, paddingHorizontal: theme.space.md }}>
    <Text style={{ ...theme.typography.caption, color: theme.color.textMuted, textDecorationLine: "underline", textAlign: "center" }}>登录后保存现有选择</Text>
  </Pressable>;
}

export function PreferenceSyncNotice() {
  const preferences = useOptionalAccountPreferences();
  const theme = useTheme();
  if (preferences === null) return null;
  const failed = preferences.error || preferences.syncStatus === "error";
  if (!failed && preferences.syncStatus !== "pending" && preferences.syncStatus !== "syncing") return null;
  return <View accessibilityLiveRegion="polite" style={{ gap: theme.space.sm }}>
    <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
      {preferences.error ? "设置暂时无法读取，请重试。" : failed ? "已保存到本机，尚未同步" : "正在同步账号设置…"}
    </Text>
    {failed ? <Pressable accessibilityRole="button" accessibilityLabel="重试同步设置" onPress={preferences.retry} style={{ minHeight: theme.size.minimumTouchTarget, justifyContent: "center" }}>
      <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary, textDecorationLine: "underline" }}>重试同步设置</Text>
    </Pressable> : null}
  </View>;
}
