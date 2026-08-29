import { useCallback, useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { ErrorState } from "../../../core/ui/ErrorState";
import { IconTextAction } from "../../../core/ui/icon-text-action";
import { Screen } from "../../../core/ui/Screen";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import type { JournalService } from "../application/journal-service";
import type { JournalEntry, JournalRecord } from "../domain/journal-record";
import { formatJournalDate } from "../domain/journal-date";

export function JournalDetailScreen({ id, service, onAdd, onBack, onDeleted, onEdit, onEditEntry }: Readonly<{
  id: string; service: JournalService; onAdd(): void; onBack(): void; onDeleted(): void; onEdit?(): void; onEditEntry?(id: string): void;
}>) {
  const theme = useTheme();
  const [value, setValue] = useState<{ record: JournalRecord; entries: readonly JournalEntry[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => { setFailed(false); void service.loadRecord(id).then((item) => { if (item === null) setFailed(true); else setValue(item); }, () => setFailed(true)); }, [id, service]);
  useEffect(load, [load]);
  if (failed) return <Screen><ErrorState title="无法打开这条手记" message="它可能已经被删除，或本机存储暂时不可用。" actionLabel="重试" onAction={load} /></Screen>;
  if (value === null) return <Screen><Text accessibilityLiveRegion="polite" style={{ ...theme.typography.body, color: theme.color.text }}>正在读取本机手记…</Text></Screen>;
  const { record, entries } = value;
  const deleteRecord = () => Alert.alert("永久删除这条记录？", "删除后无法恢复。", [
    { text: "取消", style: "cancel" },
    { text: "永久删除", style: "destructive", onPress: () => { void service.deleteRecord(id).then(onDeleted); } }
  ]);
  const deleteEntry = (entryId: string) => Alert.alert("永久删除这条补充？", "只删除这一条，删除后无法恢复。", [
    { text: "取消", style: "cancel" },
    { text: "永久删除", style: "destructive", onPress: () => { void service.deleteEntry(entryId).then(load); } }
  ]);
  return <Screen testID="journal-detail-screen">
    <IconTextAction icon="arrow-back" label="返回手记列表" onPress={onBack} />
    <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>{record.title}</Text>
    <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>发生于 {formatJournalDate(record.occurredAt)}</Text>
    <Text style={{ ...theme.typography.heading, color: theme.color.text }}>{record.highlight.kind === "feeling" ? "最大的感受" : "最深刻的印象"}</Text>
    <Text style={{ ...theme.typography.body, color: theme.color.text }}>{record.highlight.text}</Text>
    {record.body ? <Text style={{ ...theme.typography.body, color: theme.color.text }}>{record.body}</Text> : null}
    {record.cardSnapshot ? <Card>
      <Text style={{ ...theme.typography.heading, color: theme.color.text }}>当时的沟通卡快照</Text>
      {record.cardSnapshot.sections.map((section) => <Text key={section.id} style={{ ...theme.typography.body, color: theme.color.text }}>{section.text}</Text>)}
    </Card> : null}
    <Text style={{ ...theme.typography.heading, color: theme.color.text }}>后来</Text>
    {entries.length === 0 ? <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>还没有后续补充。</Text> : entries.map((entry) => <Card key={entry.id} variant="muted">
      <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>{formatJournalDate(entry.occurredAt)}</Text>
      {entry.highlight ? <Text style={{ ...theme.typography.body, color: theme.color.text }}>{entry.highlight.text}</Text> : null}
      {entry.body ? <Text style={{ ...theme.typography.body, color: theme.color.text }}>{entry.body}</Text> : null}
      {Date.now() < Date.parse(entry.editableUntil) && onEditEntry ? <SecondaryButton label="修改这条后来" onPress={() => onEditEntry(entry.id)} /> : null}
      <SecondaryButton label="删除这条后来" onPress={() => deleteEntry(entry.id)} />
    </Card>)}
    <Button label="为这件事增加一个后来" onPress={onAdd} />
    {Date.now() < Date.parse(record.editableUntil) && onEdit ? <SecondaryButton label="修改初始记录" onPress={onEdit} /> : null}
    <SecondaryButton label="永久删除这条记录" onPress={deleteRecord} />
  </Screen>;
}
