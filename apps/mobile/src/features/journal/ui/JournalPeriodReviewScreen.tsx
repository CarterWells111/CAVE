import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { EmptyState } from "../../../core/ui/EmptyState";
import { Screen } from "../../../core/ui/Screen";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import type { JournalService } from "../application/journal-service";
import type { JournalRecordSummary } from "../infrastructure/journal-repository";
import { isJournalDateInRange, journalDateFromDate } from "../domain/journal-date";

const prompts = ["遇到了什么困难？", "你采取了什么做法？", "什么有帮助，什么没有帮助？", "你怎样理解这些变化？", "下次想提醒自己什么？"];
const systemNow = () => new Date();

export function JournalPeriodReviewScreen({ service, onSaved, now = systemNow }: Readonly<{ service: JournalService; onSaved(): void; now?(): Date }>) {
  const theme = useTheme(); const [records, setRecords] = useState<readonly JournalRecordSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]); const [title, setTitle] = useState("最近 30 天的回顾"); const [body, setBody] = useState(""); const [error, setError] = useState<string | null>(null);
  const end = useMemo(now, [now]); const start = useMemo(() => new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000), [end]);
  const endDate = useMemo(() => journalDateFromDate(end), [end]); const startDate = useMemo(() => journalDateFromDate(start), [start]);
  useEffect(() => { void service.listRecords().then((items) => setRecords(items.filter((record) => isJournalDateInRange(record.occurredAt, startDate, endDate)))); }, [endDate, service, startDate]);
  const field = { backgroundColor: theme.color.surface, borderColor: theme.color.border, borderRadius: theme.radius.md, borderWidth: 1, color: theme.color.text, padding: theme.space.md } as const;
  if (records.length === 0) return <Screen><EmptyState title="最近 30 天还没有记录" message="有了关键事件后，你可以主动选择其中几条进行复盘。" /></Screen>;
  const save = async () => { try { await service.savePeriodReview({ periodStart: start.toISOString(), periodEnd: end.toISOString(), title, body, sourceRecordIds: selected }); onSaved(); } catch { setError("请选择记录并写下由你确认的小结。"); } };
  return <Screen testID="journal-period-review-screen">
    <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>回顾最近 30 天</Text>
    <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>只勾选你愿意引用的记录。系统提供问题，不替你判断关系或给成长打分。</Text>
    <View style={{ gap: theme.space.sm }}>{records.map((record) => <SecondaryButton key={record.id} label={`${selected.includes(record.id) ? "✓ " : ""}${record.title} · ${record.highlight.text}`} onPress={() => setSelected((items) => items.includes(record.id) ? items.filter((id) => id !== record.id) : [...items, record.id])} />)}</View>
    <Card variant="muted">{prompts.map((prompt) => <Text key={prompt} style={{ ...theme.typography.body, color: theme.color.text }}>{prompt}</Text>)}</Card>
    <TextInput accessibilityLabel="阶段回顾标题" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={title} onChangeText={setTitle} style={field} />
    <TextInput accessibilityLabel="由我确认的阶段小结" multiline placeholder="用自己的话写下想保留的经验和提醒" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={body} onChangeText={setBody} style={[field, { minHeight: 180, textAlignVertical: "top" }]} />
    {error ? <Text accessibilityRole="alert" style={{ color: theme.color.danger }}>{error}</Text> : null}
    <Button disabled={selected.length === 0} label="保存我的阶段回顾" onPress={() => { void save(); }} />
  </Screen>;
}
