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
  const [hasDraft, setHasDraft] = useState(false);
  const [records, setRecords] = useState<readonly JournalRecordSummary[]>([]);
  const [reviews, setReviews] = useState<readonly JournalPeriodReview[]>([]);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<JournalTopic | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(() => {
    setState("loading");
    void service.loadDraft?.("new:freeform").then((draft) => setHasDraft(Boolean(draft && (draft.body.trim() || draft.title.trim() || draft.highlight.text.trim()))), () => setHasDraft(false));
    void Promise.all([service.listRecords(), service.listPeriodReviews()]).then(([items, periodReviews]) => { setRecords(items); setReviews(periodReviews); setState("ready"); }, () => setState("error"));
  }, [service, focusRevision]);
  useEffect(load, [load]);
  const visible = useMemo(() => records.filter((record) =>
    record.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    && (topic === null || record.topics.includes(topic))), [query, records, topic]);
  return <Screen testID="journal-list-screen">
    <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>内界手记</Text>
    <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>记下一句话和后来发生的变化。内容默认只在本机；主动使用 AI 并确认后，才发送所选内容。</Text>
    {hasDraft ? <Button label="继续上次的草稿" onPress={onCreate} /> : null}
    <Button label="记下一件事" onPress={onCreate} />
    <SecondaryButton label="回顾一段时间" onPress={onReview} />
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
        {review.sourceRecordIds.map((id) => {
          const source = records.find((record) => record.id === id);
          return source ? <SecondaryButton key={id} label={`回到原记录，写一个后来：${source.title}`} onPress={() => onOpen(id)} /> : <Text key={id} style={{ color: theme.color.textMuted }}>原记录已删除</Text>;
        })}
      </Card>)}
    </View> : null}
  </Screen>;
}
