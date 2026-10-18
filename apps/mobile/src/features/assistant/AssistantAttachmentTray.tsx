import { Text, View } from "react-native";
import { useTheme } from "../../core/design/theme-provider";
import { BottomSheet } from "../../core/ui/bottom-sheet";
import { TextAction } from "../../core/ui/text-action";
import { ActionRow } from "../../core/ui/action-row";
import { Button } from "../../core/ui/Button";
import { AssistantJournalPicker } from "./AssistantJournalPicker";
import { AssistantJournalDraftPreview } from "./AssistantJournalDraftPreview";
import type { ChatAttachments } from "./use-chat-attachments";

export function AssistantAttachmentTray({ attachments, disabled, onReview }: { attachments: ChatAttachments; disabled: boolean; onReview?(): void }) {
  const theme = useTheme();
  const journal = { ...attachments.journal, busy: attachments.journal.busy || disabled };
  const close = () => attachments.setSheet(null);
  return <>
    {attachments.kind ? <View style={{ gap: 6 }}>
      {journal.draft?.mode === "period-review" && journal.draft.period ? <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>阶段回顾 · {journal.draft.period.startDate} — {journal.draft.period.endDate} · 已选 {journal.selectedIds.length} 篇</Text> : null}
      <TextAction label="重新选择" disabled={disabled} onPress={() => attachments.setSheet("journal")} />
    </View> : null}
    <BottomSheet visible={attachments.sheet !== null} title={attachments.sheet === "journal" ? "内界手记附件" : attachments.sheet === "draft" ? "手记预览" : "添加附件"} onClose={close}>
      {attachments.sheet === "menu" ? <>
        <ActionRow title="内界手记" subtitle="选择一篇手记优化或回顾，也可以新建" onPress={() => attachments.choose("journal")} />
      </> : null}
      {attachments.sheet === "journal" ? <AssistantJournalPicker journal={journal} onDone={mode => { close(); if (mode === "review") onReview?.(); }} /> : null}
      {attachments.sheet === "draft" ? attachments.historicalDraft ? <>
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>{attachments.historicalDraft.title}</Text>
        <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{attachments.historicalDraft.occurredAt}</Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{attachments.historicalDraft.body}</Text>
        {attachments.historicalDraft.requestId.startsWith("period-review-")
          ? <Text style={{ color: theme.color.textMuted }}>这份阶段回顾的引用范围已结束。可以回到「回顾一段时间」，重新选择手记继续整理。</Text>
          : <Button label="另存为新手记" disabled={disabled || !journal.available} onPress={attachments.copyHistoricalDraft} />}
      </> : <AssistantJournalDraftPreview journal={journal} onCancel={close} onSaved={close} /> : null}
    </BottomSheet>
  </>;
}
