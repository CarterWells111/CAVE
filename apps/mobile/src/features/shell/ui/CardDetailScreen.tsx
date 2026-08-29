import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { paperTheme } from "../../../core/design/theme";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";

export type CommunicationDraftSection = Readonly<{
  id: string;
  title: string;
  text: string;
}>;

export type CardDetailMetadata = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  statusLabel: string;
}>;

export type CardDetailScreenProps = {
  metadata: CardDetailMetadata;
  sections: readonly CommunicationDraftSection[];
  mode?: "normal" | "fullscreen";
  onBack(): void;
  onEdit(): Promise<void>;
  onFullscreen?(): void;
  onSaveToJournal?(): void;
};

type ActionState = "idle" | "editing" | "edit-error";

export function CardDetailScreen({
  metadata,
  mode = "normal",
  onBack,
  onEdit,
  onFullscreen,
  onSaveToJournal,
  sections,
}: CardDetailScreenProps) {
  const theme = useTheme();
  const [actionState, setActionState] = useState<ActionState>("idle");
  const editing = useRef(false);
  const busy = actionState === "editing";

  const openEdit = async () => {
    if (editing.current) return;
    editing.current = true;
    setActionState("editing");
    try {
      await onEdit();
      setActionState("idle");
    } catch {
      setActionState("edit-error");
    } finally {
      editing.current = false;
    }
  };
  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: "center",
        gap: theme.space.xl,
        paddingHorizontal: mode === "fullscreen" ? theme.space.md : theme.space.lg,
        paddingVertical: theme.space.xl
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.color.background }}
      testID="card-detail-scroll"
    >
      <View
        style={{ gap: theme.space.xl, maxWidth: mode === "fullscreen" ? "100%" : theme.size.readableContentMax, width: "100%" }}
        testID="card-detail-content"
      >
        <View style={{ gap: theme.space.sm }}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
            {metadata.title}
          </Text>
          <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            {`${metadata.dateLabel} · ${metadata.statusLabel}`}
          </Text>
          {mode === "fullscreen" ? (
            <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.label, color: theme.color.brandSoft }}>
              全屏展示模式
            </Text>
          ) : null}
        </View>

        <View
          accessibilityLabel="沟通草稿卡纸"
          collapsable={false}
          style={{
            backgroundColor: paperTheme.color.canvas,
            borderCurve: "continuous",
            borderRadius: theme.radius.lg,
            gap: theme.space.lg,
            padding: theme.space.xl,
            width: "100%"
          }}
          testID="communication-draft-paper"
        >
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: paperTheme.color.text }}>
            我的沟通草稿
          </Text>
          {sections.length > 0 ? sections.map((section) => (
            <View key={section.id} style={{ gap: theme.space.xs }}>
              <Text accessibilityRole="header" selectable style={{ ...theme.typography.cardTitle, color: paperTheme.color.text }}>
                {section.title}
              </Text>
              <Text selectable style={{ ...theme.typography.body, color: paperTheme.color.text, flexShrink: 1 }}>
                {section.text}
              </Text>
            </View>
          )) : (
            <Text selectable style={{ ...theme.typography.body, color: paperTheme.color.secondary }}>
              这次没有保留沟通草稿。
            </Text>
          )}
        </View>

        {actionState === "edit-error" ? (
          <StatusBanner
            actionLabel="重试编辑"
            message="暂时无法打开编辑，请重试。"
            onAction={() => { void openEdit(); }}
            variant="error"
          />
        ) : null}
        <View style={{ gap: theme.space.md }}>
          <Button
            disabled={busy && actionState !== "editing"}
            label={actionState === "editing" ? "正在打开编辑…" : "编辑这份草稿"}
            loading={actionState === "editing"}
            onPress={() => { void openEdit(); }}
          />
          {onSaveToJournal ? <SecondaryButton disabled={busy} label="保存到内界手记" onPress={onSaveToJournal} /> : null}
          {onFullscreen ? <SecondaryButton
            disabled={busy}
            label={mode === "fullscreen" ? "退出全屏展示" : "全屏展示"}
            onPress={onFullscreen}
          /> : null}
          <SecondaryButton disabled={busy} label="返回我的卡片" onPress={onBack} />
        </View>
      </View>
    </ScrollView>
  );
}
