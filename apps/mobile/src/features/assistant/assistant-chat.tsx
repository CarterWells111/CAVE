import Feather from "@expo/vector-icons/Feather";
import { AssistantUsageMeter } from "./assistant-usage-meter";
import { getGatewayUrl, isAssistantPreview } from "../../config/gateway";
import { AssistantRequestSchema, type AssistantRequest } from "@cave/contracts";
import { useRouter } from "expo-router";
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { useTheme } from "../../core/design/theme-provider";
import { TextAction } from "../../core/ui/text-action";
import { HelpText, PageHelp, PageTitle } from "../../core/ui/page-header";
import { IconTextAction } from "../../core/ui/icon-text-action";
import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { AssistantClientError, createAssistantClient, previewAssistant, type AssistantRequester } from "./assistant-client";
import { useOptionalAssistantContextAccess, useOptionalAssistantHistory, type AssistantContextAccess } from "./AssistantHistoryProvider";
import { AssistantPermissionDialog } from "./assistant-permission-dialog";
import type { AssistantHistoryRepository } from "./history/assistant-history-repository";
import { useAssistantHistory, type AssistantHistoryState } from "./use-assistant-history";
import { useOptionalJournalAccess } from "../journal/runtime/JournalAccessProvider";
import { collectAssistantQuestionContext } from "./assistant-question-context";
import { createAttachmentChatRequest } from "./assistant-attachment-request";
import { useChatAttachments } from "./use-chat-attachments";
import { AssistantAttachmentTray } from "./AssistantAttachmentTray";
import { journalAssistantError } from "./AssistantJournalPicker";
import { Button } from "../../core/ui/Button";
import { AssistantComposerInput, type AssistantComposerInputHandle } from "./AssistantComposerInput";

type AssistantChatProps = { journeyId: string; authorized: boolean; request?: AssistantRequester; initialDraft?: string; historyRepository?: AssistantHistoryRepository };

export function AssistantChat(props: AssistantChatProps) {
  const sharedHistory = useOptionalAssistantHistory();
  const sharedAccess = useOptionalAssistantContextAccess();
  const [allowed, setAllowed] = useState(false);
  const contextAccess = sharedAccess ?? { allowed, setAllowed };
  return sharedHistory
    ? <AssistantChatView {...props} history={sharedHistory} contextAccess={contextAccess} shared />
    : <LocalAssistantChat {...props} contextAccess={contextAccess} />;
}

function LocalAssistantChat(props: AssistantChatProps & { contextAccess: AssistantContextAccess }) {
  const auth = useOptionalAuth();
  const history = useAssistantHistory({
    journeyId: props.journeyId, initialDraft: props.initialDraft ?? "",
    ...(auth?.accountId ? { ownerAccountId: auth.accountId } : {}),
    ...(props.historyRepository ? { repository: props.historyRepository } : {}),
  });
  return <AssistantChatView {...props} history={history} />;
}

function AssistantChatView({ journeyId, authorized, request, initialDraft = "", history, contextAccess, shared = false }: AssistantChatProps & { history: AssistantHistoryState; contextAccess: AssistantContextAccess; shared?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const auth = useOptionalAuth();
  const journalAccess = useOptionalJournalAccess();
  const insets = useContext(SafeAreaInsetsContext);
  const [sending, setSending] = useState<string | null>(null);
  const [autoApprovalPrompt, setAutoApprovalPrompt] = useState(false);
  const [attachmentPermission, setAttachmentPermission] = useState<"journal" | null>(null);
  const pendingAttachment = useRef<AssistantRequest | null>(null);
  const [usageRevision, setUsageRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const contextAllowed = useRef(contextAccess.allowed);
  contextAllowed.current = contextAccess.allowed;
  const { draft, setDraft, turns } = history;
  const attachments = useChatAttachments(`${auth?.accountId ?? "local"}:${history.conversationRevision}`, turns);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const input = useRef<AssistantComposerInputHandle>(null);
  const inputRevisionCounter = useRef(0);
  const inputRevision = useMemo(() => ++inputRevisionCounter.current,
    [auth?.accountId, authorized, history.conversationRevision, history.subscribeToClear]);
  const scroll = useRef<ScrollView>(null);
  const preview = isAssistantPreview();
  useEffect(() => () => { epoch.current += 1; controller.current?.abort(); }, []);
  const entryApplied = useRef(false);
  useEffect(() => {
    if (entryApplied.current) return;
    entryApplied.current = true;
    if (shared && (initialDraft || (!history.activeId && !history.draft && history.journeyId !== journeyId))) {
      history.newConversation(journeyId, initialDraft);
    }
  }, [shared, history, initialDraft, journeyId]);
  const title = history.journeyId === "first-overnight" ? "第一次过夜" : history.journeyId;
  const textStyle = { ...theme.typography.body, color: theme.color.text };
  const caption = { ...theme.typography.caption, color: theme.color.textSecondary };
  const suggestions: { label: string; text: string }[] = [
    { label: "带我写一次日记", text: "我想写一篇今天的日记，请从一个简单的问题开始，带我慢慢记录。" },
    { label: "为我讲解一个旅程内容", text: `请为我讲解「${title}」旅程的主要内容，以及我可以怎样开始。` },
    { label: "帮我理清此刻的感受", text: "我想整理一下此刻的感受，请先问我一个温和、容易回答的问题。" },
  ];
  const begin = () => {
    const question = (input.current?.getText() ?? draft).trim();
    if (!question || sending !== null) return;
    if (!authorized) { router.push({ pathname: "/journey/adult-gate", params: { entry: "ai" } }); return; }
    if (!preview && !request && !auth?.accountId) { router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/ai" } }); return; }
    let payload: AssistantRequest;
    try { payload = createAttachmentChatRequest({ question, turns }); }
    catch { setError("请输入 1–1000 字的消息。"); return; }
    Keyboard.dismiss(); setError(null);
    if (!preview && attachments.privateKind === "journal" && !contextAccess.allowed) {
      pendingAttachment.current = payload;
      setAttachmentPermission(attachments.privateKind);
      return;
    }
    void send(payload);
  };
  const stop = () => {
    epoch.current += 1; controller.current?.abort(); controller.current = null; setSending(null); setUsageRevision(value => value + 1);
    setError("已停止等待，草稿已保留。已经发送的内容无法撤回。");
  };
  const send = async (approved: AssistantRequest, allowJournal = false) => {
    if (controller.current) return;
    if (attachments.privateKind === "journal" && !contextAccess.allowed && !allowJournal) return;
    let payload = approved;
    const current = ++epoch.current;
    const abort = new AbortController(); controller.current = abort;
    const withContext = contextAccess.allowed && !preview && !attachments.kind;
    let loadingContext = withContext || !!attachments.kind;
    setSending(payload.question!); setError(null);
    try {
      if (attachments.kind) {
        payload = await attachments.prepare(payload.question!);
        if (epoch.current !== current || abort.signal.aborted) return;
        if (attachments.privateKind === "journal" && !contextAllowed.current) return;
      } else if (withContext) {
        const rejectJournalAccess = async () => { throw new Error("assistant-journal-unavailable"); };
        // The collector decides whether this question needs existing journal records.
        const journal = journalAccess?.status === "ready" && journalAccess.service
          ? journalAccess.service
          : journalAccess ? { listRecords: rejectJournalAccess, loadRecord: rejectJournalAccess } : undefined;
        const context = await collectAssistantQuestionContext({
          question: payload.question!, journeyId: history.journeyId, signal: abort.signal,
          ...(journal ? { journal } : {}),
        });
        if (epoch.current !== current || !contextAllowed.current || abort.signal.aborted) return;
        payload = AssistantRequestSchema.parse({
          ...payload, ...context,
          ...(context.records.length ? { contextConsent: true } : {}),
        });
      }
      loadingContext = false;
      const requester = request ?? (preview ? previewAssistant : createAssistantClient({
        baseUrl: getGatewayUrl(),
        getAccessToken: async () => {
          if (!auth?.accountId || !auth.getAssistantAccessToken) throw new AssistantClientError("unauthorized");
          return auth.getAssistantAccessToken(auth.accountId);
        },
      }));
      const response = await requester(payload, abort.signal);
      if (epoch.current !== current) return;
      const displayed = attachments.accept(payload, response);
      history.appendTurn(approved.question!, displayed);
      input.current?.clear({ emitChange: false });
    } catch (caught) {
      if (epoch.current !== current) return;
      setError(loadingContext ? attachments.kind === "journal" && caught instanceof Error ? journalAssistantError(caught.message) : "暂时无法读取相关资料，消息未发送，草稿已保留。" : caught instanceof AssistantClientError && caught.code === "quota-exceeded" ? "这段时间的聊天额度用完啦。点开仪表看看重置时间，我们稍后接着聊。" : caught instanceof AssistantClientError && caught.code === "unauthorized" ? "登录已失效，请重新登录后发送。草稿已保留。" : payload.mode === "journal-draft" || payload.mode === "review" ? "这次未能生成可用的手记草稿，原文和草稿均已保留，请重试。" : "这次未能取得回复，草稿已保留，请稍后重试。");
    } finally { if (epoch.current === current) { controller.current = null; setSending(null); setUsageRevision(value => value + 1); } }
  };
  const cancelPending = useCallback(() => {
    epoch.current += 1; controller.current?.abort(); controller.current = null;
    pendingAttachment.current = null;
    setSending(null); setAutoApprovalPrompt(false); setAttachmentPermission(null); setError(null);
  }, []);
  const leaveConversation = useCallback(() => { cancelPending(); attachmentsRef.current.clear(); }, [cancelPending]);
  const previousConversation = useRef(history.conversationRevision);
  useLayoutEffect(() => {
    if (previousConversation.current === history.conversationRevision) return;
    previousConversation.current = history.conversationRevision;
    cancelPending();
  }, [history.conversationRevision, cancelPending]);
  useEffect(() => history.subscribeToClear(leaveConversation), [history.subscribeToClear, leaveConversation]);
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: theme.color.background, paddingTop: insets?.top ?? 0 }}>
    <View style={{ flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" }}>
      <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <PageTitle>内界 AI</PageTitle>
        <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 0, gap: theme.space.sm }}>
          {preview ? <Text style={caption}>本机模拟</Text> : null}
          <IconTextAction icon="add-outline" iconOnly label="新对话" onPress={() => { Keyboard.dismiss(); leaveConversation(); history.newConversation(); }} />
          <IconTextAction icon="time-outline" iconOnly label="对话历史" onPress={() => { Keyboard.dismiss(); leaveConversation(); router.push("/assistant-history"); }} />
          <PageHelp title="内界 AI">
            <HelpText>一句感受、一段记录，或旅程中的一个疑问，不必想好怎么说。</HelpText>
            <HelpText>点选建议后会填入输入框，修改好再发送。额度仪表在输入框旁，可以查看重置时间。</HelpText>
            <HelpText>普通聊天点击发送后直接取得回复，会将本条消息和当前会话最近的聊天发送至内界服务端，可能由 DeepSeek 生成回复。</HelpText>
            <HelpText>开启「帮我批准」后，AI 可以读取并使用问题涉及的本账号日记和旅程内容；只发送与本次问题相关的资料，不读取照片或隐藏卡片。开启本身不会发送内容。</HelpText>
            <HelpText>选择会在新对话和页面切换时保留，退出 App 后恢复关闭；可随时在输入框旁关闭资料访问。</HelpText>
            <HelpText>点右上角加号直接开始新对话，点时钟查看历史，点击继续聊天，长按删除或调整顺序。</HelpText>
            <HelpText>输入框旁的加号可以选择一篇手记，或新建草稿；「带我写一次日记」会同时选中新建手记。AI 先通过提问了解事情，再整理和优化表达；你也可以随时说「现在生成」。</HelpText>
            <HelpText>选好手记后可点「重新选择」调整。生成后点击回答下方的「预览/保存手记」，只有确认保存才写入我的手记。</HelpText>
            <HelpText>「优化内容」修改手记正文；「回顾记忆」沿用「回顾一段时间」的问题，整理后来的变化，确认后追加为所选手记的后续。新对话会清空附件。</HelpText>
          </PageHelp>
        </View>
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (turns.length || sending) scroll.current?.scrollToEnd({ animated: true }); }} contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 24 }}>
        {turns.length === 0 && sending === null ? <View style={{ flex: 1, justifyContent: "center", gap: 20, paddingVertical: 24 }}>
          <Text style={{ color: theme.color.primary, fontSize: 14, letterSpacing: 3 }}>CAVE · 留一点时间给自己</Text>
          <Text accessibilityRole="header" style={{ ...theme.typography.display, color: theme.color.text }}>今天，想从哪里聊起？</Text>
          <View style={{ gap: 10, marginTop: 8 }}>{suggestions.map(suggestion => <Pressable key={suggestion.label} accessibilityRole="button" accessibilityLabel={suggestion.label} onPress={() => {
            if (suggestion.label === "带我写一次日记") attachments.startNewJournal();
            input.current?.replaceText(suggestion.text, { focus: true }); setError(null);
          }} style={({ pressed }) => ({ minHeight: 52, padding: 16, borderRadius: 18, backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface, flexDirection: "row", justifyContent: "space-between", gap: 12 })}>
            <Text style={{ ...textStyle, flex: 1 }}>{suggestion.label}</Text><Text style={{ color: theme.color.primary, fontSize: 20 }}>↗</Text>
          </Pressable>)}</View>
        </View> : null}
        {turns.map((turn, index) => <View key={index} style={{ gap: 20 }}>
          <View style={{ alignSelf: "flex-end", maxWidth: "90%", padding: 16, borderRadius: 20, backgroundColor: theme.color.surfaceAccent }}><Text selectable style={textStyle}>{turn.question}</Text></View>
          <View style={{ gap: 10 }}><Text style={{ ...caption, color: theme.color.primary }}>{turn.response.providerMode === "mock" ? "内界 AI · 模拟回复" : "内界 AI"}</Text>
            <Text selectable style={textStyle}>{[turn.response.message, turn.response.question, turn.response.summary, ...turn.response.observations.map(item => item.text)].filter(Boolean).join("\n\n")}</Text>
            {turn.response.journalDraft ? <View style={{ alignSelf: "flex-start", width: 240, maxWidth: "100%" }}>
              <Button label="预览/保存手记" disabled={sending !== null} onPress={() => attachments.openDraft(turn.response.journalDraft!)} />
            </View> : null}
            {turn.response.sources.map(source => <Text key={source.id} selectable style={caption}>依据：{source.title}{source.url ? `\n${source.url}` : ""}</Text>)}
          </View>
        </View>)}
        {sending !== null ? <View style={{ gap: 16 }}><View style={{ alignSelf: "flex-end", padding: 16, borderRadius: 20, backgroundColor: theme.color.surfaceAccent }}><Text selectable style={textStyle}>{sending}</Text></View><Text accessibilityLiveRegion="polite" style={caption}>内界 AI · 正在思考…</Text><TextAction label="停止等待" onPress={stop} /></View> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 10 }}>
        {error ? <Text accessibilityRole="alert" selectable style={{ ...caption, color: theme.color.danger }}>{error}</Text> : null}
        {history.error ? <View style={{ gap: 4 }}><Text accessibilityRole="alert" selectable style={{ ...caption, color: theme.color.danger }}>{history.error}</Text><TextAction label="重试保存对话" onPress={() => { void history.retry(); }} /></View> : null}
        {!authorized ? <TextAction label="成年声明后开始聊天" onPress={() => router.push({ pathname: "/journey/adult-gate", params: { entry: "ai" } })} /> : !preview && !auth?.accountId ? <TextAction label="登录以使用在线 AI" onPress={() => router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/ai" } })} /> : null}
        <View style={{ backgroundColor: theme.color.surface, borderColor: theme.color.border, borderWidth: 1, borderRadius: 24, padding: 14, gap: 12 }}>
          <AssistantAttachmentTray attachments={attachments} disabled={sending !== null} onReview={() => {
            if (!input.current?.getText().trim()) input.current?.replaceText("我想回顾这篇手记之后的变化，请先问我一个简单的问题，帮我整理一条后续补充。", { focus: true });
            else input.current?.focus();
          }} />
          <AssistantComposerInput ref={input} accessibilityLabel="聊天消息" initialValue={draft} replacement={{ revision: inputRevision, text: draft }} onChangeText={value => { setDraft(value); setError(null); }} editable={sending === null} multiline maxLength={1000} placeholder="说说你想聊的事…" placeholderTextColor={theme.color.textSecondary} style={{ ...textStyle, minHeight: 56, maxHeight: 160, textAlignVertical: "top", padding: 4 }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <IconTextAction icon="add-outline" iconOnly label="添加聊天附件" disabled={sending !== null} onPress={() => { Keyboard.dismiss(); attachments.setSheet("menu"); }} />
            {!preview ? <Pressable accessibilityRole="switch" accessibilityLabel="帮我批准" accessibilityState={{ checked: contextAccess.allowed }} accessibilityHint="允许访问问题涉及的日记和旅程内容；选择保留到退出 App，可随时关闭。" onPress={() => { if (contextAccess.allowed) { contextAccess.setAllowed(false); cancelPending(); } else { Keyboard.dismiss(); setAutoApprovalPrompt(true); } }} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: pressed ? theme.color.surfacePressed : contextAccess.allowed ? theme.color.surfaceAccent : theme.color.surface, borderWidth: 1, borderColor: contextAccess.allowed ? theme.color.primary : theme.color.border })}>
              <Feather name={contextAccess.allowed ? "check-circle" : "book-open"} size={16} color={contextAccess.allowed ? theme.color.primary : theme.color.textSecondary} />
              <Text style={{ ...caption, color: contextAccess.allowed ? theme.color.primary : theme.color.textSecondary }}>帮我批准</Text>
            </Pressable> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginLeft: "auto" }}><AssistantUsageMeter revision={usageRevision} preview={preview} /><Pressable accessibilityRole="button" accessibilityLabel="发送消息" accessibilityState={{ disabled: !draft.trim() || sending !== null }} disabled={!draft.trim() || sending !== null} onPress={begin} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: draft.trim() && sending === null ? theme.color.primary : theme.color.disabled }}><Text style={{ fontSize: 24, color: theme.color.onPrimary }}>↑</Text></Pressable></View>
          </View>
        </View>
      </View>
    </View>
    <AssistantPermissionDialog
      visible={autoApprovalPrompt}
      message="允许在本次使用期间访问问题涉及的日记和旅程内容吗？"
      onAllow={() => { contextAccess.setAllowed(true); setAutoApprovalPrompt(false); }}
      onCancel={() => setAutoApprovalPrompt(false)}
    />
    <AssistantPermissionDialog
      visible={attachmentPermission !== null}
      message="允许 AI 使用所选手记和草稿整理本次内容吗？"
      onAllow={() => {
        const approved = pendingAttachment.current;
        const kind = attachmentPermission;
        pendingAttachment.current = null; setAttachmentPermission(null);
        if (kind === "journal") { contextAllowed.current = true; contextAccess.setAllowed(true); }
        if (approved) void send(approved, kind === "journal");
      }}
      onCancel={() => { pendingAttachment.current = null; setAttachmentPermission(null); }}
    />
  </KeyboardAvoidingView>;
}
