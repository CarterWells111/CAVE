import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Screen } from "../../../core/ui/Screen";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import type { JournalService } from "../application/journal-service";
import type { JournalEntry, JournalEntryKind } from "../domain/journal-record";
import { localJournalToday, normalizeJournalDate } from "../domain/journal-date";
import { JournalDateField } from "./JournalDateField";

const directions: Array<{ kind: JournalEntryKind; label: string; prompt: string }> = [
  { kind: "event-change", label: "事情有了变化", prompt: "发生了什么变化？" },
  { kind: "feeling-change", label: "感受有了变化", prompt: "现在的感受与当时有什么不同？" },
  { kind: "action", label: "我采取了行动", prompt: "你做了什么？什么对你有帮助？" },
  { kind: "insight", label: "我有了新理解", prompt: "这件事让你更了解自己的什么？" },
  { kind: "correction", label: "更正或澄清", prompt: "请说明需要更正的内容，原记录不会被覆盖。" }
];

export function JournalEntryEditorScreen({ recordId, service, onSaved, initial }: Readonly<{ recordId: string; service: JournalService; onSaved(): void; initial?: JournalEntry }>) {
  const theme = useTheme(); const [direction, setDirection] = useState(directions.find((item) => item.kind === initial?.kind) ?? directions[0]!); const [body, setBody] = useState(initial?.body ?? "");
  const [occurredAt, setOccurredAt] = useState(initial?.occurredAt ? normalizeJournalDate(initial.occurredAt) : localJournalToday());
  const [error, setError] = useState<string | null>(null); const field = { backgroundColor: theme.color.surface, borderColor: theme.color.border, borderRadius: theme.radius.md, borderWidth: 1, color: theme.color.text, minHeight: 140, padding: theme.space.md, textAlignVertical: "top" as const };
  const save = async () => { try { if (initial) await service.updateEntry(initial.id, { kind: direction.kind, occurredAt, body }); else await service.addEntry(recordId, { kind: direction.kind, occurredAt, body }); onSaved(); } catch (cause) { setError(cause instanceof Error && cause.message === "journal-item-locked" ? "修改时间已结束。请返回并增加一条更正或补充，原文不会被覆盖。" : "请先写下一点内容。"); } };
  return <Screen testID="journal-entry-editor-screen">
    <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>{initial ? "修改这个后来" : "增加一个后来"}</Text>
    <View style={{ gap: theme.space.sm }}>{directions.map((item) => <SecondaryButton key={item.kind} label={`${direction.kind === item.kind ? "✓ " : ""}${item.label}`} onPress={() => setDirection(item)} />)}</View>
    <JournalDateField label="变化日期" onChange={setOccurredAt} value={occurredAt} />
    <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>{direction.prompt}</Text>
    <TextInput accessibilityLabel="后续补充内容" multiline placeholder="记录发生了什么变化" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={body} onChangeText={setBody} style={field} />
    {error ? <Text accessibilityRole="alert" style={{ color: theme.color.danger }}>{error}</Text> : null}
    <Button label="保存这个后来" onPress={() => { void save(); }} />
  </Screen>;
}
