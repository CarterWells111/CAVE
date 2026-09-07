import { useEffect, useRef, useState, type ReactNode } from "react";
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

export function JournalEditorScreen({ service, onSaved, initial, onBack, renderAssistant }: Readonly<{
  service: JournalService; onSaved(id: string): void; onBack?(): void;
  renderAssistant?(context: { records: Array<{ id: string; text: string }>; onAdopt(text: string): void }): ReactNode;
  initial?: Readonly<{ id?: string; title?: string; occurredAt?: string; highlight?: JournalHighlight; body?: string; topics?: readonly JournalTopic[]; source?: JournalSource; cardSnapshot?: JournalRecord["cardSnapshot"] }>;
}>) {
  const theme = useTheme();
  const [title, setTitle] = useState(initial?.title ?? ""); const [occurredAt, setOccurredAt] = useState(initial?.occurredAt ? normalizeJournalDate(initial.occurredAt) : localJournalToday());
  const [kind, setKind] = useState<JournalHighlight["kind"]>(initial?.highlight?.kind ?? "feeling"); const [highlight, setHighlight] = useState(initial?.highlight?.text ?? "");
  const [body, setBody] = useState(initial?.body ?? ""); const [topics, setTopics] = useState<JournalTopic[]>([...(initial?.topics ?? [])]);
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const draftKey = initial?.id ? `record:${initial.id}` : `new:${initial?.source?.kind === "journey" ? `${initial.source.journeyId}:${initial.source.cardId ?? ""}:${initial.source.reviewId ?? ""}` : "freeform"}`;
  const [ready, setReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [guided, setGuided] = useState(false);
  const [question, setQuestion] = useState(0);
  const prompts = ["今天有什么想记下的？", "当时你注意到了什么感受？", "有没有一个让你松口气或不舒服的瞬间？", "当时有什么没说出口的希望？", "哪个细节让你觉得被尊重？", "现在想法和当时有什么不同？", "现在有什么想留给自己的话？"];
  const writeQueue = useRef(Promise.resolve());
  const savingRef = useRef(false);
  const sourceRef = useRef(initial?.source);
  const snapshotRef = useRef(initial?.cardSnapshot);
  const savedRecordId = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    setReady(false);
    void service.loadDraft(draftKey).then((draft) => {
      if (!active) return;
      if (draft) {
        sourceRef.current = draft.source; snapshotRef.current = draft.cardSnapshot;
        setTitle(draft.title); setOccurredAt(draft.occurredAt); setKind(draft.highlight.kind);
        setHighlight(draft.highlight.text); setBody(draft.body); setTopics([...draft.topics]);
        setDraftStatus("已恢复本机草稿");
      }
      setReady(true);
    }).catch(() => { if (active) setError("草稿暂时无法读取，请返回后重试。"); });
    return () => { active = false; };
  }, [service, draftKey]);
  useEffect(() => {
    if (!ready || savingRef.current) return;
    const draft = { title, occurredAt, highlight: { kind, text: highlight }, body, topics,
      ...(sourceRef.current ? { source: sourceRef.current } : {}), ...(snapshotRef.current !== undefined ? { cardSnapshot: snapshotRef.current } : {}) };
    writeQueue.current = writeQueue.current.catch(() => undefined).then(() => service.saveDraft(draftKey, draft));
    void writeQueue.current.then(() => setDraftStatus("草稿已保存在本机"), () => setDraftStatus("草稿保存失败，请保持此页并重试保存。"));
  }, [ready, title, occurredAt, kind, highlight, body, topics, service, draftKey]);
  const field = { backgroundColor: theme.color.surface, borderColor: theme.color.border, borderRadius: theme.radius.md, borderWidth: 1, color: theme.color.text, padding: theme.space.md } as const;
  const save = async () => {
    if (saving || !ready) return;
    savingRef.current = true;
    setSaving(true); setError(null);
    try {
      // A previous attempt may have saved the record but failed to clear its draft.
      // Retry against that record so edits made after the failure are retained.
      const existingId = savedRecordId.current ?? initial?.id;
      const record = existingId
        ? await service.updateRecord(existingId, { title, occurredAt, highlight: { kind, text: highlight }, body, topics })
        : await service.createRecord({
            title, occurredAt, highlight: { kind, text: highlight }, body, topics,
            ...(sourceRef.current ? { source: sourceRef.current } : {}),
            ...(snapshotRef.current !== undefined ? { cardSnapshot: snapshotRef.current } : {})
          });
      savedRecordId.current = record.id;
      await writeQueue.current.catch(() => undefined);
      await service.clearDraft(draftKey);
      onSaved(record.id);
    }
    catch { setError("未能完成保存。请确认有一句内容和有效日期，再重试；草稿仍保留在本机。"); savingRef.current = false; setSaving(false); }
  };
  return <Screen testID="journal-editor-screen">
    {onBack ? <SecondaryButton disabled={saving} label="返回手记列表" onPress={onBack} /> : null}
    <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>{initial?.id ? "修改这条记录" : "记下一件事"}</Text>
    <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>一句话也可以，不需要先想好标题或重点。</Text>
    <SecondaryButton label={guided ? "自由写" : "试试引导写作（可跳过）"} onPress={() => setGuided(!guided)} />
    {guided ? <View style={{ gap: theme.space.sm }}>
      <Text style={{ ...theme.typography.body, color: theme.color.text }}>{prompts[question]}</Text>
      <SecondaryButton label={question < prompts.length - 1 ? "下一题 / 跳过这题" : "结束引导"} onPress={() => question < prompts.length - 1 ? setQuestion(question + 1) : setGuided(false)} />
    </View> : null}
    <TextInput editable={ready && !saving} accessibilityLabel="事件正文" multiline placeholder="此刻想记下什么？" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={body} onChangeText={setBody} style={[field, { minHeight: 180, textAlignVertical: "top" }]} />
    <Text accessibilityLiveRegion="polite" style={{ ...theme.typography.caption, color: theme.color.textMuted }}>{draftStatus || "正在读取本机草稿…"}</Text>
    <JournalDateField label="事件日期" onChange={setOccurredAt} value={occurredAt} />
    <TextInput editable={ready && !saving} accessibilityLabel="关键事件标题" placeholder="标题（选填）" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={title} onChangeText={setTitle} style={field} />
    <TextInput editable={ready && !saving} accessibilityLabel="重点提要" placeholder="想单独保留的重点（选填）" placeholderTextColor={theme.color.textMuted} selectionColor={theme.color.primary} value={highlight} onChangeText={setHighlight} style={field} />
    {renderAssistant?.({ records: [{ id: initial?.id ?? "current-draft", text: [title, occurredAt, highlight, body].filter(Boolean).join("\n") }], onAdopt: (text) => setBody((current) => current ? `${current}\n\n${text}` : text) })}
    <Text style={{ ...theme.typography.heading, color: theme.color.text }}>专题（选填，由你决定）</Text>
    <View style={{ gap: theme.space.sm }}>{topicOptions.map((option) => <SecondaryButton key={option.value} label={`${topics.includes(option.value) ? "✓ " : ""}${option.label}`} onPress={() => setTopics((items) => items.includes(option.value) ? items.filter((item) => item !== option.value) : [...items, option.value])} />)}</View>
    {error ? <Text accessibilityRole="alert" style={{ color: theme.color.danger }}>{error}</Text> : null}
    <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>随时可以修改，旧版本会保留在修改历史中。也可以为这件事增加一个“后来”。</Text>
    <Button disabled={saving || !ready} label={saving ? "正在保存…" : "保存到本机"} onPress={() => { void save(); }} />
  </Screen>;
}
