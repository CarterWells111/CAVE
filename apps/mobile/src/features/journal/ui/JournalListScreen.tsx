import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { EmptyState } from "../../../core/ui/EmptyState";
import { ErrorState } from "../../../core/ui/ErrorState";
import { Screen } from "../../../core/ui/Screen";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import type { JournalService } from "../application/journal-service";
import type { JournalTopic } from "../domain/journal-record";
import { formatJournalDate } from "../domain/journal-date";
import type { JournalPeriodReview, JournalRecordSummary } from "../infrastructure/journal-repository";

const topicLabels: Record<JournalTopic, string> = {
  "intimate-relationship": "亲密关系", "self-boundaries": "自我边界", "sexual-health": "健康性生活"
};

export function JournalListScreen({ service, focusRevision = 0, onCreate, onOpen, onReview }: Readonly<{
  service: JournalService; focusRevision?: number; onCreate(): void; onOpen(id: string): void; onReview(): void;
}>) {
  const theme = useTheme();
  const [records, setRecords] = useState<readonly JournalRecordSummary[]>([]);
  const [reviews, setReviews] = useState<readonly JournalPeriodReview[]>([]);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<JournalTopic | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(() => {
    setState("loading");
    void Promise.all([service.listRecords(), service.listPeriodReviews()]).then(([items, periodReviews]) => { setRecords(items); setReviews(periodReviews); setState("ready"); }, () => setState("error"));
  }, [service, focusRevision]);
  useEffect(load, [load]);
  const visible = useMemo(() => records.filter((record) =>
    record.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    && (topic === null || record.topics.includes(topic))), [query, records, topic]);
  return <Screen testID="journal-list-screen">
    <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>内界手记</Text>
    <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>记录关键事件和后来发生的变化。正文只保存在本机。</Text>
    <Button label="记下一件事" onPress={onCreate} />
    <SecondaryButton label="回顾最近 30 天" onPress={onReview} />
    <TextInput accessibilityLabel="搜索事件标题" onChangeText={setQuery} placeholder="搜索事件标题" value={query}
      placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary}
      style={{ backgroundColor: theme.color.surface, borderColor: theme.color.border, borderRadius: theme.radius.md, borderWidth: 1, color: theme.color.text, padding: theme.space.md }} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.space.sm }}>
      <SecondaryButton label="全部" onPress={() => setTopic(null)} />
      {(Object.keys(topicLabels) as JournalTopic[]).map((key) => <SecondaryButton key={key} label={topicLabels[key]} onPress={() => setTopic(key)} />)}
    </ScrollView>
    {state === "error" ? <ErrorState title="手记读取失败" message="本机内容没有因此被删除。" actionLabel="重试" onAction={load} /> : null}
    {state === "ready" && visible.length === 0 ? <EmptyState title="还没有符合条件的记录" message="可以从一件对你重要的事开始。" /> : null}
    {visible.map((record) => <Card key={record.id} testID={`journal-record-${record.id}`}>
      <Text style={{ ...theme.typography.heading, color: theme.color.text }}>{record.title}</Text>
      <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>{formatJournalDate(record.occurredAt)}</Text>
      <Text style={{ ...theme.typography.body, color: theme.color.text }}>{record.highlight.text}</Text>
      {record.topics.length ? <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>{record.topics.map((item) => topicLabels[item]).join(" · ")}</Text> : null}
      <SecondaryButton label={`打开${record.title}`} onPress={() => onOpen(record.id)} />
    </Card>)}
    {reviews.length ? <View style={{ gap: theme.space.md }}>
      <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>阶段回顾</Text>
      {reviews.map((review) => <Card key={review.id} variant="muted">
        <Text style={{ ...theme.typography.heading, color: theme.color.text }}>{review.title}</Text>
        <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>{review.periodStart.slice(0, 10)} — {review.periodEnd.slice(0, 10)}</Text>
        <Text style={{ ...theme.typography.body, color: theme.color.text }}>{review.body}</Text>
      </Card>)}
    </View> : null}
  </Screen>;
}
