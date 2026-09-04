import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Screen } from "../../../core/ui/Screen";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import type { JournalService } from "../application/journal-service";
import type { JournalHighlight, JournalRecord, JournalSource, JournalTopic } from "../domain/journal-record";
import { localJournalToday, normalizeJournalDate } from "../domain/journal-date";
import { JournalDateField } from "./JournalDateField";

const topicOptions: Array<{ value: JournalTopic; label: string }> = [
  { value: "intimate-relationship", label: "亲密关系" }, { value: "self-boundaries", label: "自我边界" }, { value: "sexual-health", label: "健康性生活" }
];

export function JournalEditorScreen({ service, onSaved, initial, onBack }: Readonly<{
  service: JournalService; onSaved(id: string): void; onBack?(): void;
  initial?: Readonly<{ id?: string; title?: string; occurredAt?: string; highlight?: JournalHighlight; body?: string; topics?: readonly JournalTopic[]; source?: JournalSource; cardSnapshot?: JournalRecord["cardSnapshot"] }>;
}>) {
  const theme = useTheme();
  const [title, setTitle] = useState(initial?.title ?? ""); const [occurredAt, setOccurredAt] = useState(initial?.occurredAt ? normalizeJournalDate(initial.occurredAt) : localJournalToday());
  const [kind, setKind] = useState<JournalHighlight["kind"]>(initial?.highlight?.kind ?? "feeling"); const [highlight, setHighlight] = useState(initial?.highlight?.text ?? "");
  const [body, setBody] = useState(initial?.body ?? ""); const [topics, setTopics] = useState<JournalTopic[]>([...(initial?.topics ?? [])]);
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const field = { backgroundColor: theme.color.surface, borderColor: theme.color.border, borderRadius: theme.radius.md, borderWidth: 1, color: theme.color.text, padding: theme.space.md } as const;
  const save = async () => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const record = initial?.id
        ? await service.updateRecord(initial.id, { title, occurredAt, highlight: { kind, text: highlight }, body, topics })
        : await service.createRecord({
            title, occurredAt, highlight: { kind, text: highlight }, body, topics,
            ...(initial?.source ? { source: initial.source } : {}),
            ...(initial?.cardSnapshot !== undefined ? { cardSnapshot: initial.cardSnapshot } : {})
          });
      onSaved(record.id);
    }
    catch { setError("请填写标题、有效时间和重点提要。"); setSaving(false); }
  };
  return <Screen testID="journal-editor-screen">
    {onBack ? <SecondaryButton disabled={saving} label="返回手记列表" onPress={onBack} /> : null}
    <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>{initial?.id ? "修改这条记录" : "记下一件事"}</Text>
    <TextInput accessibilityLabel="关键事件标题" placeholder="例如：第一次说出我想暂停" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={title} onChangeText={setTitle} style={field} />
    <JournalDateField label="事件日期" onChange={setOccurredAt} value={occurredAt} />
    <View style={{ flexDirection: "row", gap: theme.space.sm }}><SecondaryButton label="最大的感受" onPress={() => setKind("feeling")} /><SecondaryButton label="最深刻的印象" onPress={() => setKind("impression")} /></View>
    <TextInput accessibilityLabel="重点提要" placeholder={kind === "feeling" ? "当时最大的感受" : "最深刻的印象"} placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={highlight} onChangeText={setHighlight} style={field} />
    <TextInput accessibilityLabel="事件正文" multiline placeholder="想多写一点也可以（选填）" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={body} onChangeText={setBody} style={[field, { minHeight: 120, textAlignVertical: "top" }]} />
    <Text style={{ ...theme.typography.heading, color: theme.color.text }}>专题（选填，由你决定）</Text>
    <View style={{ gap: theme.space.sm }}>{topicOptions.map((option) => <SecondaryButton key={option.value} label={`${topics.includes(option.value) ? "✓ " : ""}${option.label}`} onPress={() => setTopics((items) => items.includes(option.value) ? items.filter((item) => item !== option.value) : [...items, option.value])} />)}</View>
    {error ? <Text accessibilityRole="alert" style={{ color: theme.color.danger }}>{error}</Text> : null}
    <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>创建后的 24 小时内可修改；之后请用“增加一个后来”保留变化。</Text>
    <Button disabled={saving} label={saving ? "正在保存…" : "保存到本机"} onPress={() => { void save(); }} />
  </Screen>;
}
