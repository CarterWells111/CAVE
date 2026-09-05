import { Pressable, Text, View } from "react-native";
import { useState } from "react";

import { useTheme } from "../../../core/design/theme-provider";
import { ErrorState } from "../../../core/ui/ErrorState";
import { JourneyMap } from "../../explore/ui/journey-map";
import { ShellLoading, type ShellLoadState } from "./shell-ui-components";

export type HomeScreenProps = {
  account?: {
    status: "signedOut" | "loading" | "ready" | "error";
    displayName?: string;
    onOpen(): void;
  };
  loadState?: ShellLoadState;
  onRetry?: () => void;
  onOpenSample: (id: string) => void;
  onOpenScenario: () => void | Promise<void>;
  scenarioPending?: boolean;
  scenarioError?: boolean;
};

export function HomeScreen({
  account, loadState = "ready", onRetry, onOpenSample, onOpenScenario,
  scenarioPending = false, scenarioError = false,
}: HomeScreenProps) {
  const theme = useTheme();
  const [accountFocused, setAccountFocused] = useState(false);
  const accountLabel = account?.status === "signedOut" ? "登录"
    : account?.status === "loading" ? "正在检查账号状态…"
      : account?.status === "ready" ? `查看${account.displayName ?? "内界用户"}的账号` : "打开账号";
  return (
    <View style={{ gap: theme.space.xl, minWidth: 0 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: theme.space.md }}>
        <Text selectable style={{ ...theme.typography.heading, color: theme.color.text, letterSpacing: 2 }}>CAVE 内界</Text>
        {account ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accountLabel}
            accessibilityState={{ disabled: account.status === "loading" }}
            disabled={account.status === "loading"}
            onFocus={() => setAccountFocused(true)}
            onBlur={() => setAccountFocused(false)}
            onPress={account.onOpen}
            style={({ pressed }) => ({
              minHeight: theme.size.minimumTouchTarget, minWidth: theme.size.minimumTouchTarget,
              justifyContent: "center", borderRadius: theme.radius.pill,
              paddingHorizontal: theme.space.md, backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
              borderWidth: 1, borderColor: theme.color.border, flexShrink: 1,
              outlineColor: theme.color.focus, outlineOffset: theme.border.focusOffset,
              outlineWidth: accountFocused ? theme.border.focusWidth : 0,
            })}
          >
            <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 }}>
              {account.status === "signedOut" ? "登录" : account.status === "loading" ? "账号加载中" : account.displayName ?? "我的"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ gap: theme.space.sm }}>
        <Text selectable style={{ ...theme.typography.numericLabel, color: theme.color.brandSoft, letterSpacing: 2 }}>跟随自己的节奏</Text>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>选择一段旅程</Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>没有固定顺序，从此刻想探索的地方开始。</Text>
      </View>
      {loadState === "loading" ? <ShellLoading /> : null}
      {loadState === "error" ? (
        <ErrorState
          title="读取失败" message="暂时无法读取本机首页内容。你的记录没有因此被删除。"
          actionLabel="重试" {...(onRetry ? { onAction: onRetry } : {})}
        />
      ) : null}
      {loadState === "ready" ? (
        <JourneyMap onOpenSample={onOpenSample} onOpenScenario={onOpenScenario} scenarioPending={scenarioPending} scenarioError={scenarioError} />
      ) : null}
    </View>
  );
}
