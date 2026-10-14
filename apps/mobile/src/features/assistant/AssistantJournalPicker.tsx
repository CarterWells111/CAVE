import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../core/design/theme-provider";
import { Button } from "../../core/ui/Button";
import type { AssistantJournal } from "./use-assistant-journal";

export const journalAssistantError = (code: string | null) => {
  switch (code) {
    case null: return null;
    case "journal-record-conflict": return "原手记已有新修改。草稿仍保留，请重新打开原手记核对后再整理。";
    case "journal-item-locked": return "这篇手记已过编辑期限，可以选择回顾记忆追加后续，或新建手记保留整理。";
    case "journal-record-not-found": return "手记已删除或无法访问，请重新选择。";
    case "journal-session-changed": return "手记访问状态已改变，请重新登录或打开手记。";
    case "journal-context-too-large": return "所选手记内容过长，请减少附件；原文不会被截断。";
    case "journal-selection-limit": return "每次只能选择1篇手记。";
    case "journal-draft-invalid": return "这次草稿未通过检查，请重新生成或手动编辑。";
    default: return "操作暂未完成，草稿仍在，可以编辑后重试。";
  }
};

export function AssistantJournalPicker({ journal, onDone }: Readonly<{ journal: AssistantJournal; onDone?(mode: "new" | "edit" | "review"): void }>) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const perform = async (action: () => unknown) => {
    setError(null);
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "journal-request-failed"); }
  };
  useEffect(() => { if (journal.available) void journal.controller.refreshChoices().catch(() => {}); }, [journal.available, journal.controller]);
  useEffect(() => { setError(null); }, [journal.controller]);
  const selectedId = journal.selectedIds[0];
  return <View style={{ gap: theme.space.md }}>
    <Text style={{ ...theme.typography.heading, color: theme.color.text }}>选择内界手记</Text>
    <Text style={{ ...theme.typography.body, color: theme.color.textMuted }}>选择一篇手记，再选择优化内容或回顾记忆。发送前仍需确认分享权限。</Text>
    {!journal.available ? <Text style={{ color: theme.color.text }}>登录并解锁手记后可选择附件。</Text> : null}
    <Button label="新建手记草稿" disabled={!journal.available || journal.busy} onPress={() => void perform(() => { journal.controller.beginNew(); onDone?.("new"); })} />
    <ScrollView style={{ maxHeight: 320 }}>
      {journal.choices.map(item => <View key={item.id}><Pressable accessibilityRole="checkbox"
        accessibilityLabel={`选择手记：${item.title}`} accessibilityState={{ checked: journal.selectedIds.includes(item.id), disabled: journal.busy || !journal.available }}
        disabled={journal.busy || !journal.available} onPress={() => void perform(() => journal.controller.toggleSelection(item.id))}
        style={{ padding: theme.space.md, minHeight: theme.size.minimumTouchTarget }}>
        <Text style={{ ...theme.typography.body, color: theme.color.text }}>{journal.selectedIds.includes(item.id) ? "✓ " : "○ "}{item.title}</Text>
        <Text style={{ color: theme.color.textMuted }}>{item.occurredAt}</Text>
      </Pressable>
      </View>)}
    </ScrollView>
    {selectedId ? <View style={{ flexDirection: "row", gap: theme.space.sm }}>
      <View style={{ flex: 1 }}><Button label="优化内容" disabled={journal.busy || !journal.available} onPress={() => void perform(async () => { await journal.controller.beginEdit(selectedId); onDone?.("edit"); })} /></View>
      <View style={{ flex: 1 }}><Button label="回顾记忆" disabled={journal.busy || !journal.available} onPress={() => void perform(async () => { await journal.controller.beginReview(selectedId); onDone?.("review"); })} /></View>
    </View> : null}
    {journal.available && !journal.busy && journal.choices.length === 0 ? <Text style={{ color: theme.color.textMuted }}>还没有手记，可以先新建一篇。</Text> : null}
    {journalAssistantError(error ?? journal.error) ? <Text accessibilityRole="alert" style={{ color: theme.color.text }}>{journalAssistantError(error ?? journal.error)}</Text> : null}
  </View>;
}
