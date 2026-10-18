import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { EmptyState } from "../../../core/ui/EmptyState";
import { Screen } from "../../../core/ui/Screen";
import { ActionRow } from "../../../core/ui/action-row";
import { HelpText } from "../../../core/ui/page-header";
import { SelectionField } from "../../../core/ui/selection-field";
import { TextAction } from "../../../core/ui/text-action";
import type { JournalService } from "../application/journal-service";
import type { JournalRecordSummary } from "../infrastructure/journal-repository";
import { isJournalDateInRange, journalDateFromDate } from "../domain/journal-date";
import { JOURNAL_REVIEW_QUESTIONS } from "../domain/journal-review-prompts";

import type { JournalPeriodReviewContext } from "../../assistant/assistant-journal";

import { JournalDateField } from "./JournalDateField";
import { JournalEditorHeader } from "./JournalEditorHeader";

const systemNow = () => new Date();

export function JournalPeriodReviewScreen({ service, onSaved, now = systemNow, onStartAiReview, onOpen, onBack }: Readonly<{ service: JournalService; onSaved(): void; now?(): Date; onOpen?(id: string): void; onBack?(): void; onStartAiReview?(context: JournalPeriodReviewContext): void }>) {
  const theme = useTheme(); const [records, setRecords] = useState<readonly JournalRecordSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]); const [title, setTitle] = useState("最近 30 天的回顾"); const [body, setBody] = useState(""); const [error, setError] = useState<string | null>(null);
  const today = useMemo(now, [now]);
  const [days, setDays] = useState<7 | 30 | null>(30);
  const [startDate, setStartDate] = useState(journalDateFromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)));
  const [endDate, setEndDate] = useState(journalDateFromDate(today));
  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const choosePeriod = (value: 7 | 30) => {
    setDays(value); setStartDate(journalDateFromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - value + 1)));
    setEndDate(journalDateFromDate(today)); setTitle(value === 7 ? "最近一周的回顾" : "最近一个月的回顾"); setSelected([]);
  };
  useEffect(() => {
    let active = true;
    setLoaded(false);
    void service.listRecords().then((items) => { if (active) { setRecords(items); setLoaded(true); } }, () => { if (active) setError("记录读取失败，请返回后重试。"); });
    return () => { active = false; };
  }, [service]);
  const visible = records.filter((record) => isJournalDateInRange(record.occurredAt, startDate, endDate));
  const field = { backgroundColor: theme.color.surface, borderColor: theme.color.border, borderRadius: theme.radius.md, borderWidth: 1, color: theme.color.text, padding: theme.space.md } as const;
  const save = async () => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      if (startDate > endDate || selected.length === 0) throw new Error("journal-period-invalid");
      await service.savePeriodReview({ periodStart: `${startDate}T00:00:00.000Z`, periodEnd: `${endDate}T00:00:00.000Z`, title, body, sourceRecordIds: selected }); onSaved();
    } catch { setError("请选择有效日期范围和记录，并写下自己的小结。"); setSaving(false); }
  };
  return <Screen testID="journal-period-review-screen">
    <JournalEditorHeader title="回顾一段时间" onBack={onBack} saving={saving}
      help={<HelpText>选择日期范围与想引用的记录，用自己的话保留经验和提醒。系统提供问题，不替你判断关系或给成长打分。AI 仅在你主动使用并确认后发送所选内容。</HelpText>} />
    {onStartAiReview ? <Button label="AI陪我回顾" disabled={saving || startDate > endDate} onPress={() => onStartAiReview({ startDate, endDate, title, body, sourceRecordIds: selected })} /> : null}
    <View style={{ gap: theme.space.sm }}>
      <SelectionField<"7" | "30" | "custom"> label="回顾范围" value={days === null ? "custom" : days === 7 ? "7" : "30"}
        options={[{ value: "7", label: "最近一周" }, { value: "30", label: "最近一个月" }, { value: "custom", label: "自选日期" }]}
        onChange={(value) => value === "custom" ? setDays(null) : choosePeriod(value === "7" ? 7 : 30)} />
      {days === null ? <><JournalDateField label="开始日期" value={startDate} onChange={(value) => { setStartDate(value); setSelected([]); }} /><JournalDateField label="结束日期" value={endDate} onChange={(value) => { setEndDate(value); setSelected([]); }} /></> : null}
      <Text style={{ color: theme.color.textMuted }}>{startDate} — {endDate}</Text>
    </View>
    {loaded && visible.length === 0 ? <EmptyState title="这段时间还没有记录" message="可以更换日期范围，或先写下一句话。" /> : null}
    <View style={{ gap: theme.space.sm }}>
      <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>只勾选你愿意引用的记录。</Text>
      {visible.map((record) => <ReviewRecordChoice key={record.id} record={record} checked={selected.includes(record.id)}
        onPress={() => setSelected((items) => items.includes(record.id) ? items.filter((id) => id !== record.id) : [...items, record.id])} />)}
    </View>
    {onOpen && selected.length ? <View style={{ gap: theme.space.sm }}>
      <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>已引用的原记录</Text>
      {selected.map((id) => <ActionRow key={id} title={records.find((record) => record.id === id)?.title ?? "记录"} subtitle="查看原记录"
        accessibilityLabel={`查看原记录：${records.find((record) => record.id === id)?.title ?? "记录"}`} onPress={() => onOpen(id)} />)}
    </View> : null}
    <Card accessible={false}>
      <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>我的阶段小结</Text>
      <View style={{ gap: theme.space.xs }}>
        <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>{JOURNAL_REVIEW_QUESTIONS[question]}</Text>
        <TextAction label="换一个引导" onPress={() => setQuestion((current) => (current + 1) % JOURNAL_REVIEW_QUESTIONS.length)} />
      </View>
      <TextInput accessibilityLabel="阶段回顾标题" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={title} onChangeText={setTitle} style={field} />
      <TextInput accessibilityLabel="由我确认的阶段小结" multiline placeholder="用自己的话写下想保留的经验和提醒" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={body} onChangeText={setBody} style={[field, { minHeight: 180, textAlignVertical: "top" }]} />
    </Card>
    {error ? <Text accessibilityRole="alert" style={{ color: theme.color.danger }}>{error}</Text> : null}
    <Button disabled={saving || selected.length === 0 || startDate > endDate} label="保存我的阶段回顾" onPress={() => { void save(); }} />
  </Screen>;
}

function ReviewRecordChoice({ record, checked, onPress }: { record: JournalRecordSummary; checked: boolean; onPress(): void }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={`${record.title} · ${record.highlight.text}`} accessibilityState={{ checked }}
    onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ backgroundColor: pressed ? theme.color.surfacePressed : checked ? theme.color.surfaceAccent : theme.color.surface,
      borderRadius: theme.radius.md, minHeight: theme.size.minimumTouchTarget, padding: theme.space.md, gap: theme.space.xs,
      outlineColor: theme.color.focus, outlineOffset: theme.border.focusOffset, outlineWidth: focused ? theme.border.focusWidth : 0 })}>
    <Text style={{ ...theme.typography.body, color: theme.color.text }}>{checked ? "✓ " : ""}{record.title}</Text>
    <Text numberOfLines={2} style={{ ...theme.typography.caption, color: theme.color.textMuted }}>{record.highlight.text}</Text>
  </Pressable>;
}
