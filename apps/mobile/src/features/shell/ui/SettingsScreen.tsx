import { Ionicons } from "@expo/vector-icons";
import { type ComponentProps, useRef, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import type { ResolvedTheme, ThemePreference } from "../../../core/design/theme";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { InfoCard } from "../../../core/ui/info-card";
import { IconTextAction } from "../../../core/ui/icon-text-action";
import { SecondaryButton } from "../../../core/ui/secondary-button";

export type SettingsScreenProps = {
  appearancePreference: ThemePreference;
  appearanceSaving: boolean;
  resolvedTheme: ResolvedTheme;
  onAppearancePreferenceChange(preference: ThemePreference): Promise<void>;
  onBack(): void;
  onChangeJournalSaveNotice(enabled: boolean): Promise<void>;
  onDeleteAllData(): Promise<void>;
  onContinueAfterDelete(): void;
  onRetryPrivacySettings(): void;
  privacySettingsStatus: "loading" | "ready" | "error";
  showLocalJournalSaveNotice: boolean;
};

type DeleteState = "idle" | "confirming" | "deleting" | "error" | "success";

function AppearanceChoice({
  checked,
  detail,
  disabled,
  icon,
  label,
  onPress,
}: {
  checked: boolean;
  detail?: string;
  disabled: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress(): void;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const accessibilityLabel = detail ? `${label}，${detail}` : label;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: checked
          ? theme.color.surfaceAccent
          : pressed ? theme.color.surfacePressed : theme.color.surface,
        borderColor: checked ? theme.color.primary : theme.color.interactiveBorder,
        borderCurve: "continuous",
        borderRadius: theme.radius.control,
        borderWidth: checked ? theme.border.selectedWidth : theme.border.width,
        flexDirection: "row",
        gap: theme.space.md,
        minHeight: theme.size.primaryActionHeight,
        minWidth: theme.size.minimumTouchTarget,
        opacity: disabled ? 0.65 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.compact,
        width: "100%",
      })}
    >
      <Ionicons accessible={false} color={checked ? theme.color.primary : theme.color.textSecondary} name={icon} size={theme.size.iconLarge} />
      <View style={{ flex: 1, gap: theme.space.xs }}>
        <Text style={{ ...theme.typography.button, color: theme.color.text }}>{label}</Text>
        {detail ? <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{detail}</Text> : null}
      </View>
      {checked ? <Ionicons accessible={false} color={theme.color.primary} name="checkmark-circle" size={theme.size.iconLarge} /> : null}
    </Pressable>
  );
}

function DestructiveButton({
  label,
  loading = false,
  onPress
}: {
  label: string;
  loading?: boolean;
  onPress(): void;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? theme.color.surfacePressed : theme.color.dangerSurface,
        borderColor: theme.color.danger,
        borderCurve: "continuous",
        borderRadius: theme.radius.control,
        borderWidth: loading ? theme.border.selectedWidth : theme.border.width,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.space.sm,
        justifyContent: "center",
        minHeight: theme.size.primaryActionHeight,
        minWidth: theme.size.minimumTouchTarget,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.compact,
        width: "100%"
      })}
    >
      <Text style={{ ...theme.typography.button, color: theme.color.onDanger, flexShrink: 1, textAlign: "center" }}>
        {label}
      </Text>
      {loading ? <Text style={{ ...theme.typography.caption, color: theme.color.onDanger }}>处理中</Text> : null}
    </Pressable>
  );
}

export function SettingsScreen({
  appearancePreference,
  appearanceSaving,
  onAppearancePreferenceChange,
  onBack,
  resolvedTheme,
  onChangeJournalSaveNotice,
  onContinueAfterDelete,
  onDeleteAllData,
  onRetryPrivacySettings,
  privacySettingsStatus,
  showLocalJournalSaveNotice,
}: SettingsScreenProps) {
  const theme = useTheme();
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  const [appearanceError, setAppearanceError] = useState(false);
  const [privacySaveState, setPrivacySaveState] = useState<"idle" | "saving" | "error">("idle");
  const deletionInFlight = useRef(false);

  const deleteAll = async () => {
    if (deletionInFlight.current) return;
    deletionInFlight.current = true;
    setDeleteState("deleting");
    try {
      await onDeleteAllData();
      setDeleteState("success");
    } catch {
      setDeleteState("error");
    } finally {
      deletionInFlight.current = false;
    }
  };

  const changeAppearance = async (preference: ThemePreference) => {
    if (appearanceSaving || preference === appearancePreference) return;
    setAppearanceError(false);
    try {
      await onAppearancePreferenceChange(preference);
    } catch {
      setAppearanceError(true);
    }
  };

  const changeJournalSaveNotice = async (enabled: boolean) => {
    if (privacySaveState === "saving") return;
    setPrivacySaveState("saving");
    try {
      await onChangeJournalSaveNotice(enabled);
      setPrivacySaveState("idle");
    } catch {
      setPrivacySaveState("error");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        alignSelf: "center",
        gap: theme.space.xl,
        maxWidth: theme.size.readableContentMax,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.xl,
        width: "100%"
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      testID="settings-scroll"
    >
      <IconTextAction icon="arrow-back" label="返回" onPress={onBack} />
      <View style={{ gap: theme.space.sm }}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
          设置
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          管理账户、保存方式、外观与这台设备上的内容。
        </Text>
      </View>

      <Card accessible={false}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          账户与保存
        </Text>
        <View style={{ gap: theme.space.compact }}>
          <View style={{ gap: theme.space.xs }}>
            <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>未登录</Text>
            <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
              当前不需要账户即可使用本机功能。
            </Text>
          </View>
          <View style={{ gap: theme.space.xs }}>
            <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.primary }}>本机保存（当前）</Text>
            <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
              卡片、回顾和设置只保存在这台设备上。
            </Text>
          </View>
          <View style={{ gap: theme.space.xs }}>
            <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.textSecondary }}>
              登录与云端同步（尚未开放）
            </Text>
            <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
              这里不会假装登录或上传任何内容。
            </Text>
          </View>
        </View>
      </Card>

      <Card accessible={false}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          外观
        </Text>
        <View accessibilityRole="radiogroup" style={{ gap: theme.space.compact }}>
          <AppearanceChoice
            checked={appearancePreference === "system"}
            detail={`当前：${resolvedTheme === "dark" ? "深色" : "亮色"}`}
            disabled={appearanceSaving}
            icon="phone-portrait-outline"
            label="跟随系统"
            onPress={() => { void changeAppearance("system"); }}
          />
          <AppearanceChoice
            checked={appearancePreference === "light"}
            disabled={appearanceSaving}
            icon="sunny-outline"
            label="亮色"
            onPress={() => { void changeAppearance("light"); }}
          />
          <AppearanceChoice
            checked={appearancePreference === "dark"}
            disabled={appearanceSaving}
            icon="moon-outline"
            label="深色"
            onPress={() => { void changeAppearance("dark"); }}
          />
        </View>
        {appearanceSaving ? (
          <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            正在保存外观设置…
          </Text>
        ) : null}
        {appearanceError ? (
          <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>
            外观设置未保存，请重试。
          </Text>
        ) : null}
      </Card>

      <InfoCard title="隐私与本机数据">
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          旅程、练习和沟通草稿保存在本机。能解锁这台设备的人仍可能看到这些内容，请按自己的情况决定是否保留。
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: theme.space.md, justifyContent: "space-between" }}>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flex: 1 }}>
            保存私人记录前显示本机提示
          </Text>
          <Switch
            accessibilityLabel="保存私人记录前显示本机提示"
            disabled={privacySettingsStatus !== "ready" || privacySaveState === "saving"}
            onValueChange={(enabled) => { void changeJournalSaveNotice(enabled); }}
            trackColor={{ false: theme.color.disabled, true: theme.color.brandSoft }}
            value={showLocalJournalSaveNotice}
          />
        </View>
        {privacySettingsStatus === "loading" ? (
          <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            正在读取本机隐私设置…
          </Text>
        ) : null}
        {privacySaveState === "saving" ? (
          <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            正在保存设置…
          </Text>
        ) : null}
        {privacySettingsStatus === "error" ? (
          <View style={{ gap: theme.space.sm }}>
            <Text accessibilityRole="alert" selectable style={{ ...theme.typography.caption, color: theme.color.error }}>
              暂时无法读取本机隐私设置；保存提示会保持开启。
            </Text>
            <SecondaryButton label="重试读取隐私设置" onPress={onRetryPrivacySettings} />
          </View>
        ) : null}
        {privacySaveState === "error" ? (
          <Text accessibilityRole="alert" selectable style={{ ...theme.typography.caption, color: theme.color.error }}>
            设置尚未保存，请重试。
          </Text>
        ) : null}
      </InfoCard>

      <Card accessible={false} style={{ borderColor: theme.color.danger }}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          删除本机数据
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          删除后，当前旅程、已保存内容和本机设置都需要重新开始。
        </Text>

        {deleteState === "idle" ? (
          <DestructiveButton label="删除全部本机数据" onPress={() => setDeleteState("confirming")} />
        ) : null}

        {deleteState === "confirming" ? (
          <View style={{ gap: theme.space.md }}>
            <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>
              请再次确认：全部本机数据会被删除，并且无法恢复。
            </Text>
            <DestructiveButton label="确认删除全部本机数据" onPress={() => { void deleteAll(); }} />
            <SecondaryButton label="取消删除" onPress={() => setDeleteState("idle")} />
          </View>
        ) : null}

        {deleteState === "deleting" ? (
          <View accessibilityLiveRegion="polite" style={{ gap: theme.space.sm }}>
            <DestructiveButton label="正在删除本机数据…" loading onPress={() => undefined} />
            <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
              完成前请留在这个画面。
            </Text>
          </View>
        ) : null}

        {deleteState === "error" ? (
          <View style={{ gap: theme.space.md }}>
            <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.error }}>
              删除尚未完成；部分本机清理步骤可能已经完成。当前画面会保留，请安全重试直到显示完成。
            </Text>
            <DestructiveButton label="重试删除" onPress={() => { void deleteAll(); }} />
            <SecondaryButton label="取消删除" onPress={() => setDeleteState("idle")} />
          </View>
        ) : null}

        {deleteState === "success" ? (
          <View accessibilityLiveRegion="polite" style={{ gap: theme.space.md }}>
            <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.success }}>
              本机数据已删除。
            </Text>
            <Button label="返回欢迎页" onPress={onContinueAfterDelete} />
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}
