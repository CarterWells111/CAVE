import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../core/design/theme-provider";
import { Button } from "../../core/ui/Button";
import { IconTextAction } from "../../core/ui/icon-text-action";
import { HelpText, PageHeader } from "../../core/ui/page-header";
import { TextAction } from "../../core/ui/text-action";
import type { AssistantConversation } from "./history/assistant-history-repository";

export type AssistantHistoryPageProps = {
  conversations: AssistantConversation[];
  activeId: string | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  onBack(): void;
  onSelect(id: string): void;
  onNew(): void;
  onDelete(id: string): Promise<boolean>;
  onMove(id: string, offset: -1 | 1): Promise<boolean>;
  onRetry(): Promise<void>;
};

export function AssistantHistoryPage({ conversations, activeId, loading, busy, error, onBack, onSelect, onNew, onDelete, onMove, onRetry }: AssistantHistoryPageProps) {
  const theme = useTheme();
  const [managedId, setManagedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const managedIndex = conversations.findIndex(item => item.id === managedId);
  const managed = conversations[managedIndex];
  const textStyle = { ...theme.typography.body, color: theme.color.text };
  const caption = { ...theme.typography.caption, color: theme.color.textSecondary };
  const reset = () => { setManagedId(null); setConfirmDelete(false); };
  const back = () => { if (busy) return; if (managedId !== null) reset(); else onBack(); };

  useEffect(() => {
    if (managedId === null && !busy) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!busy) { setManagedId(null); setConfirmDelete(false); }
      return true;
    });
    return () => subscription.remove();
  }, [busy, managedId]);

  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
    <View style={{ alignItems: "center", paddingHorizontal: theme.space.lg, paddingTop: theme.space.md, paddingBottom: theme.space.lg }}>
      <View style={{ maxWidth: theme.size.readableContentMax, width: "100%" }}>
        <PageHeader
          title="对话历史"
          onBack={back}
          backLabel={managedId !== null ? "返回对话历史" : "返回聊天"}
          backDisabled={busy}
          help={<HelpText>点击一段对话继续聊天；长按可以删除，或用上移、下移调整列表顺序。选择「新对话」开始新的聊天。历史和排序按账号保存在本机，删除前会再次确认。</HelpText>}
        />
      </View>
    </View>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ alignItems: "center", paddingHorizontal: theme.space.lg, paddingBottom: theme.space.xl }}
      keyboardShouldPersistTaps="handled"
      testID="assistant-history-scroll"
    >
      <View style={{ gap: theme.space.md, maxWidth: theme.size.readableContentMax, minWidth: 0, width: "100%" }}>
        {error ? <View style={{ gap: theme.space.sm }}><Text accessibilityRole="alert" selectable style={{ ...caption, color: theme.color.danger }}>{error}</Text><TextAction label="重试对话历史" disabled={busy || loading} onPress={() => { void onRetry(); }} /></View> : null}
        {managed ? <View style={{ gap: theme.space.card }}>
          <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>{confirmDelete ? "删除对话" : "管理对话"}</Text>
          <Text selectable style={textStyle}>{managed.title}</Text>
          {confirmDelete ? <>
            <Text style={textStyle}>删除后，这段对话将从本机历史中移除，无法恢复。</Text>
            <Button label="确认删除对话" loading={busy} onPress={() => { void onDelete(managed.id).then(deleted => { if (deleted) reset(); }); }} />
            <TextAction label="取消删除" disabled={busy} onPress={() => setConfirmDelete(false)} />
          </> : <>
            <Text accessibilityLiveRegion="polite" style={caption}>当前位置：{managedIndex + 1} / {conversations.length}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.md }}>
              <IconTextAction icon="arrow-up-outline" label="上移一位" disabled={busy || managedIndex === 0} onPress={() => { void onMove(managed.id, -1); }} />
              <IconTextAction icon="arrow-down-outline" label="下移一位" disabled={busy || managedIndex === conversations.length - 1} onPress={() => { void onMove(managed.id, 1); }} />
            </View>
            <TextAction label="删除这段对话" disabled={busy} onPress={() => setConfirmDelete(true)} />
            <TextAction label="返回对话历史" disabled={busy} onPress={reset} />
          </>}
        </View> : <>
          <IconTextAction icon="add-outline" label="新对话" disabled={busy} onPress={() => { reset(); onNew(); }} />
          {loading ? <Text accessibilityLiveRegion="polite" style={caption}>正在读取对话历史…</Text> : conversations.length === 0 ? <View style={{ paddingVertical: theme.space.xl }}>
            <Text style={textStyle}>还没有对话历史</Text>
          </View> : conversations.map(conversation => <Pressable
            key={conversation.id}
            accessibilityRole="button"
            accessibilityLabel={`打开对话：${conversation.title}`}
            accessibilityHint="点击继续聊天，长按删除或调整顺序"
            accessibilityState={{ selected: conversation.id === activeId, disabled: busy }}
            accessibilityActions={[{ name: "longpress", label: "管理对话" }]}
            onAccessibilityAction={event => { if (!busy && event.nativeEvent.actionName === "longpress") { setManagedId(conversation.id); setConfirmDelete(false); } }}
            disabled={busy}
            onPress={() => { reset(); onSelect(conversation.id); }}
            onLongPress={() => { setManagedId(conversation.id); setConfirmDelete(false); }}
            style={({ pressed }) => ({ padding: theme.space.md, minHeight: 80, borderRadius: theme.radius.lg, borderCurve: "continuous", gap: theme.space.sm, backgroundColor: pressed ? theme.color.surfacePressed : conversation.id === activeId ? theme.color.surfaceAccent : theme.color.surface })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.compact }}>
              <Text numberOfLines={2} style={{ ...textStyle, flex: 1 }}>{conversation.title}</Text>
              {conversation.id === activeId ? <Text style={{ ...caption, color: theme.color.primary }}>当前</Text> : null}
            </View>
            <Text numberOfLines={2} style={caption}>{conversation.turns.at(-1)?.response.message}</Text>
            <Text style={caption}>{new Date(conversation.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {conversation.turns.length} 轮对话</Text>
          </Pressable>)}
        </>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
