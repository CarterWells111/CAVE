import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { paperTheme } from "../../../core/design/theme";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";
import type { CommunicationCardExportModel } from "../../journey/domain/communication-card-export";

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
  onBack(): void;
  onEdit(): Promise<void>;
  exportEligible?: boolean;
  onReconfirm?(): Promise<void>;
  exportModel?: CommunicationCardExportModel;
  onCopy?(model: CommunicationCardExportModel): Promise<void>;
  onSaveImage?(model: CommunicationCardExportModel, imageUri: string): Promise<void>;
};

type ActionState = "idle" | "editing" | "edit-error" | "reconfirming" | "reconfirm-error" | "copying" | "copy-error" | "saving-image" | "save-image-error";

export function CardDetailScreen({ exportModel, metadata, onBack, onCopy, onEdit, onReconfirm, onSaveImage, exportEligible = false, sections }: CardDetailScreenProps) {
  const theme = useTheme();
  const [actionState, setActionState] = useState<ActionState>("idle");
  const editing = useRef(false);
  const exportPaperRef = useRef<View>(null);

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
  const reconfirm = async () => {
    if (editing.current || onReconfirm === undefined) return;
    editing.current = true;
    setActionState("reconfirming");
    try {
      await onReconfirm();
      setActionState("idle");
    } catch {
      setActionState("reconfirm-error");
    } finally {
      editing.current = false;
    }
  };
  const copy = async () => {
    if (editing.current || onCopy === undefined || exportModel === undefined) return;
    editing.current = true;
    setActionState("copying");
    try { await onCopy(exportModel); setActionState("idle"); } catch { setActionState("copy-error"); } finally { editing.current = false; }
  };
  const saveImage = async () => {
    if (editing.current || onSaveImage === undefined || exportPaperRef.current === null || exportModel === undefined) return;
    editing.current = true;
    setActionState("saving-image");
    try {
      const imageUri = await captureRef(exportPaperRef, { format: "png", quality: 1, result: "tmpfile" });
      await onSaveImage(exportModel, imageUri);
      setActionState("idle");
    } catch { setActionState("save-image-error"); } finally { editing.current = false; }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: "center",
        gap: theme.space.xl,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.xl
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.color.background }}
      testID="card-detail-scroll"
    >
      <View style={{ gap: theme.space.xl, maxWidth: theme.size.readableContentMax, width: "100%" }} testID="card-detail-content">
        <View style={{ gap: theme.space.sm }}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
            {metadata.title}
          </Text>
          <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            {`${metadata.dateLabel} · ${metadata.statusLabel}`}
          </Text>
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
        {!exportEligible ? (
          <View style={{ gap: theme.space.sm }}>
            <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>旧版本沟通草稿需要先重新确认，才可以复制或保存图片。</Text>
            {actionState === "reconfirm-error" ? <StatusBanner actionLabel="重试确认" message="重新确认失败，请重试。" onAction={() => { void reconfirm(); }} variant="error" /> : null}
            <Button disabled={actionState === "reconfirming" || onReconfirm === undefined} label={actionState === "reconfirming" ? "正在重新确认…" : "重新确认分享内容"} loading={actionState === "reconfirming"} onPress={() => { void reconfirm(); }} />
          </View>
        ) : null}
        {exportEligible ? (
          <View style={{ gap: theme.space.sm }}>
            {exportModel === undefined ? null : (
              <View ref={exportPaperRef} collapsable={false} style={{ backgroundColor: paperTheme.color.canvas, borderRadius: theme.radius.lg, gap: theme.space.md, padding: theme.space.lg }} testID="confirmed-card-export-paper">
                <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: paperTheme.color.text }}>{exportModel.title}</Text>
                {exportModel.sections.map((section) => <View key={section.id}><Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: paperTheme.color.text }}>{section.title}</Text><Text selectable style={{ ...theme.typography.body, color: paperTheme.color.text }}>{section.text}</Text></View>)}
                <Text selectable style={{ ...theme.typography.caption, color: paperTheme.color.secondary }}>{exportModel.consentFooter}</Text>
              </View>
            )}
            <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>复制会写入系统剪贴板；保存图片会写入系统相册，并可能依设备设置同步到 iCloud。</Text>
            {actionState === "copy-error" || actionState === "save-image-error" ? <StatusBanner actionLabel="重试" message="本机导出没有完成，请重试。" onAction={() => { void (actionState === "copy-error" ? copy() : saveImage()); }} variant="error" /> : null}
            <Button disabled={onCopy === undefined || actionState === "saving-image"} label={actionState === "copying" ? "正在复制…" : "复制文字"} loading={actionState === "copying"} onPress={() => { void copy(); }} />
            <SecondaryButton disabled={onSaveImage === undefined || actionState === "copying"} label={actionState === "saving-image" ? "正在保存图片…" : "保存图片"} onPress={() => { void saveImage(); }} />
          </View>
        ) : null}

        <View style={{ gap: theme.space.md }}>
          <Button
            label={actionState === "editing" ? "正在打开编辑…" : "编辑这份草稿"}
            loading={actionState === "editing"}
            onPress={() => { void openEdit(); }}
          />
          <SecondaryButton disabled={actionState === "editing"} label="返回我的卡片" onPress={onBack} />
        </View>
      </View>
    </ScrollView>
  );
}
