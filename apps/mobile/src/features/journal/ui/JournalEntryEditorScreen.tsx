import { useState } from "react";
import { Text, TextInput } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Screen } from "../../../core/ui/Screen";
import { HelpText } from "../../../core/ui/page-header";
import { SelectionField } from "../../../core/ui/selection-field";
import type { JournalService } from "../application/journal-service";
import type { JournalEntry, JournalEntryKind } from "../domain/journal-record";
import { localJournalToday, normalizeJournalDate } from "../domain/journal-date";
import { JournalDateField } from "./JournalDateField";
import { JournalEditorHeader } from "./JournalEditorHeader";

const directions: Array<{ kind: JournalEntryKind; label: string; prompt: string }> = [
  { kind: "event-change", label: "事情有了变化", prompt: "发生了什么变化？" },
  { kind: "feeling-change", label: "感受有了变化", prompt: "现在的感受与当时有什么不同？" },
  { kind: "action", label: "我采取了行动", prompt: "你做了什么？什么对你有帮助？" },
  { kind: "insight", label: "我有了新理解", prompt: "这件事让你更了解自己的什么？" },
  { kind: "correction", label: "更正或澄清", prompt: "请说明需要更正的内容，原记录不会被覆盖。" }
];

export function JournalEntryEditorScreen({ recordId, service, onSaved, initial, onBack }: Readonly<{ recordId: string; service: JournalService; onSaved(): void; onBack?(): void; initial?: JournalEntry }>) {
  const [saving, setSaving] = useState(false);
  const theme = useTheme(); const [direction, setDirection] = useState(directions.find((item) => item.kind === initial?.kind) ?? directions[0]!); const [body, setBody] = useState(initial?.body ?? "");
  const [occurredAt, setOccurredAt] = useState(initial?.occurredAt ? normalizeJournalDate(initial.occurredAt) : localJournalToday());
  const [error, setError] = useState<string | null>(null); const field = { backgroundColor: theme.color.surface, borderColor: theme.color.border, borderRadius: theme.radius.md, borderWidth: 1, color: theme.color.text, minHeight: 140, padding: theme.space.md, textAlignVertical: "top" as const };
  const save = async () => { if (saving) return; setSaving(true); setError(null); try { if (initial) await service.updateEntry(initial.id, { kind: direction.kind, occurredAt, body }); else await service.addEntry(recordId, { kind: direction.kind, occurredAt, body }); onSaved(); } catch (cause) { setSaving(false); setError(cause instanceof Error && cause.message === "journal-item-locked" ? "修改时间已结束。请返回并增加一条更正或补充，原文不会被覆盖。" : "请先写下一点内容。"); } };
  return <Screen testID="journal-entry-editor-screen">
    <JournalEditorHeader title={initial ? "修改这个后来" : "增加一个后来"} onBack={onBack} saving={saving}
      help={<HelpText>记下事情、感受、行动或理解的变化。修改时间结束后，可以增加一条更正或补充，原记录不会被覆盖。</HelpText>} />
    <SelectionField<JournalEntryKind> label="后来的类型" value={direction.kind} disabled={saving}
      options={directions.map((item) => ({ value: item.kind, label: item.label }))}
      onChange={(kind) => setDirection(directions.find((item) => item.kind === kind)!)} />
    <JournalDateField label="变化日期" onChange={setOccurredAt} value={occurredAt} />
    <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>{direction.prompt}</Text>
    <TextInput accessibilityLabel="后续补充内容" multiline placeholder="记录发生了什么变化" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={body} onChangeText={setBody} style={field} />
    {error ? <Text accessibilityRole="alert" style={{ color: theme.color.danger }}>{error}</Text> : null}
    <Button disabled={saving} label={saving ? "正在保存…" : "保存这个后来"} onPress={() => { void save(); }} />
  </Screen>;
}
