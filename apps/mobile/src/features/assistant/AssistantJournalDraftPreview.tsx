import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTheme } from "../../core/design/theme-provider";
import { Button } from "../../core/ui/Button";
import { JournalDateField } from "../journal/ui/JournalDateField";
import type { AssistantJournal } from "./use-assistant-journal";
import { journalAssistantError } from "./AssistantJournalPicker";

export function AssistantJournalDraftPreview({ journal, onSaved, onCancel }: Readonly<{
  journal: AssistantJournal; onSaved?(): void; onCancel?(): void;
}>) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const draft = journal.draft;
  useEffect(() => { setError(null); }, [draft?.requestId]);
  if (!draft) return null;
  const disabled = journal.busy || !journal.available;
  const inputStyle = { ...theme.typography.body, color: theme.color.text, borderColor: theme.color.border, borderWidth: 1, borderRadius: theme.radius.md, padding: theme.space.md };
  return <View style={{ gap: theme.space.md }}>
    <Text style={{ ...theme.typography.heading, color: theme.color.text }}>{draft.mode === "period-review" ? "阶段回顾预览" : draft.mode === "new" ? "新手记预览" : draft.mode === "review" ? "手记回顾后续预览" : "手记修改预览"}</Text>
    <Text style={{ color: theme.color.textMuted }}>{draft.mode === "period-review" ? "可以先编辑，确认后保存为阶段回顾，并保留所选原记录的引用。" : draft.mode === "review" ? "可以先编辑，确认后作为所选手记的后续补充保存。" : "可以先编辑。确认保存后才会写入我的手记。"}</Text>
    {draft.original ? <View style={{ gap: theme.space.sm }}>
      <Text selectable style={{ color: theme.color.textMuted }}>原文：{draft.original.record.body}</Text>
      {draft.original.entries.map(entry => <Text selectable key={entry.id} style={{ color: theme.color.textMuted }}>补充（{entry.occurredAt}）：{entry.body}{entry.highlight ? `\n${entry.highlight.text}` : ""}</Text>)}
      <Text style={{ color: theme.color.textMuted }}>补充记录将保留。</Text>
    </View> : null}
    <TextInput accessibilityLabel="手记标题" editable={!disabled && draft.mode !== "review"} value={draft.title} maxLength={200} onChangeText={title => journal.controller.editDraft({ title })} style={inputStyle} />
    {draft.mode === "period-review" && draft.period ? <Text style={{ color: theme.color.textMuted }}>{draft.period.startDate} — {draft.period.endDate} · 引用 {journal.selectedIds.length} 篇手记</Text> : <JournalDateField label={draft.mode === "review" ? "后续日期" : "手记日期"} value={draft.occurredAt} disabled={disabled || draft.mode === "review"} onChange={occurredAt => journal.controller.editDraft({ occurredAt })} />}
    <TextInput accessibilityLabel="手记正文" multiline editable={!disabled} value={draft.body} maxLength={12000} onChangeText={body => journal.controller.editDraft({ body })} style={{ ...inputStyle, minHeight: 160, textAlignVertical: "top" }} />
    {journalAssistantError(error ?? journal.error) ? <Text accessibilityRole="alert" style={{ color: theme.color.text }}>{journalAssistantError(error ?? journal.error)}</Text> : null}
    <Button label={draft.mode === "period-review" ? "确认保存阶段回顾" : draft.mode === "review" ? "确认保存为后续" : "确认保存至我的手记"} disabled={disabled || !draft.title.trim() || !draft.body.trim()} onPress={() => {
      setError(null);
      void journal.controller.confirmSave().then(() => onSaved?.(), cause => setError(cause instanceof Error ? cause.message : "journal-request-failed"));
    }} />
    <Button label="取消草稿" disabled={journal.busy} onPress={() => { journal.controller.cancelDraft(); onCancel?.(); }} />
  </View>;
}
