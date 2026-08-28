import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { theme } from "../../../core/design/theme";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { InfoCard } from "../../../core/ui/info-card";
import { SecondaryButton } from "../../../core/ui/secondary-button";

export type SettingsScreenProps = {
  onChangeAddressPreference(): void;
  onDeleteAllData(): Promise<void>;
  onContinueAfterDelete(): void;
};

type DeleteState = "idle" | "confirming" | "deleting" | "error" | "success";

function DestructiveButton({
  label,
  loading = false,
  onPress
}: {
  label: string;
  loading?: boolean;
  onPress(): void;
}) {
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
  onChangeAddressPreference,
  onContinueAfterDelete,
  onDeleteAllData
}: SettingsScreenProps) {
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
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
      <View style={{ gap: theme.space.sm }}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
          设置
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          管理界面称呼，以及保存在这台设备上的内容。
        </Text>
      </View>

      <Card accessible={false}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
          界面称呼
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          只改变界面怎样称呼你，不会改变已经填写的内容。
        </Text>
        <SecondaryButton label="更改称呼" onPress={onChangeAddressPreference} />
      </Card>

      <InfoCard title="隐私与本机数据">
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          旅程、练习和沟通卡保存在本机。能解锁这台设备的人仍可能看到这些内容，请按自己的情况决定是否保留。
        </Text>
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
              删除失败，请重试。你的当前画面会保留。
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
