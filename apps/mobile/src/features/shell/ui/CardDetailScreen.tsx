import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { InfoCard } from "../../../core/ui/info-card";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";

export type ConfirmedCardSection = Readonly<{
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
  confirmedSections: readonly ConfirmedCardSection[];
  mode?: "normal" | "fullscreen";
  onBack(): void;
  onEdit(): Promise<void>;
  onCopy(sections: readonly ConfirmedCardSection[]): Promise<void>;
  onFullscreen(): void;
};

type ActionState = "idle" | "copying" | "copy-success" | "copy-error" | "editing" | "edit-error";

export function CardDetailScreen({
  confirmedSections,
  metadata,
  mode = "normal",
  onBack,
  onCopy,
  onEdit,
  onFullscreen
}: CardDetailScreenProps) {
  const theme = useTheme();
  const [actionState, setActionState] = useState<ActionState>("idle");
  const activeAction = useRef<"copy" | "edit" | null>(null);
  const busy = actionState === "copying" || actionState === "editing";

  const run = async (action: "copy" | "edit") => {
    if (activeAction.current !== null) return;
    activeAction.current = action;
    setActionState(action === "copy" ? "copying" : "editing");
    try {
      if (action === "copy") {
        await onCopy(confirmedSections);
        setActionState("copy-success");
      } else {
        await onEdit();
        setActionState("idle");
      }
    } catch {
      setActionState(action === "copy" ? "copy-error" : "edit-error");
    } finally {
      activeAction.current = null;
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

        <View style={{ gap: theme.space.md }}>
          {confirmedSections.length > 0 ? confirmedSections.map((section) => (
            <Card
              accessibilityLabel={`${section.title}。${section.text}`}
              accessibilityRole="summary"
              key={section.id}
              style={{ minWidth: 0, width: "100%" }}
            >
              <Text accessibilityRole="header" selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>
                {section.title}
              </Text>
              <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flexShrink: 1 }}>
                {section.text}
              </Text>
            </Card>
          )) : (
            <InfoCard title="没有已确认展示的内容">
              <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
                返回编辑后，可以明确选择要展示的部分。
              </Text>
            </InfoCard>
          )}
        </View>

        {actionState === "copy-success" ? <StatusBanner message="已复制确认内容。" variant="success" /> : null}
        {actionState === "copy-error" ? (
          <StatusBanner
            actionLabel="重试复制"
            message="复制失败，请重试。"
            onAction={() => { void run("copy"); }}
            variant="error"
          />
        ) : null}
        {actionState === "edit-error" ? (
          <StatusBanner
            actionLabel="重试编辑"
            message="暂时无法打开编辑，请重试。"
            onAction={() => { void run("edit"); }}
            variant="error"
          />
        ) : null}

        <View style={{ gap: theme.space.md }}>
          <Button
            disabled={busy && actionState !== "editing"}
            label={actionState === "editing" ? "正在打开编辑…" : "编辑这张卡"}
            loading={actionState === "editing"}
            onPress={() => { void run("edit"); }}
          />
          <SecondaryButton
            disabled={busy && actionState !== "copying"}
            label={actionState === "copying" ? "正在复制确认内容…" : "复制确认内容"}
            loading={actionState === "copying"}
            onPress={() => { void run("copy"); }}
          />
          <SecondaryButton
            disabled={busy}
            label={mode === "fullscreen" ? "退出全屏展示" : "全屏展示"}
            onPress={onFullscreen}
          />
          <SecondaryButton disabled={busy} label="返回卡片列表" onPress={onBack} />
        </View>
      </View>
    </ScrollView>
  );
}
