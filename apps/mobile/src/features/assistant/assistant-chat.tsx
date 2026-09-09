import { needsPrivateConfirmation } from "./assistant-privacy";
import Feather from "@expo/vector-icons/Feather";
import { AssistantUsageMeter } from "./assistant-usage-meter";
import { getGatewayUrl, isAssistantPreview } from "../../config/gateway";
import { AssistantRequestSchema, type AssistantRequest, type AssistantResponse } from "@cave/contracts";
import { useRouter } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { useTheme } from "../../core/design/theme-provider";
import { Button } from "../../core/ui/Button";
import { SecondaryButton } from "../../core/ui/secondary-button";
import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { AssistantClientError, createAssistantClient, previewAssistant, type AssistantRequester } from "./assistant-client";

type Turn = { question: string; response: AssistantResponse };
export function AssistantChat({ journeyId, authorized, request }: { journeyId: string; authorized: boolean; request?: AssistantRequester }) {
  const theme = useTheme();
  const router = useRouter();
  const auth = useOptionalAuth();
  const insets = useContext(SafeAreaInsetsContext);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<AssistantRequest | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [usageRevision, setUsageRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const preview = isAssistantPreview();
  useEffect(() => () => { epoch.current += 1; controller.current?.abort(); }, []);
  const title = journeyId === "first-overnight" ? "第一次过夜" : journeyId;
  const textStyle = { ...theme.typography.body, color: theme.color.text };
  const caption = { ...theme.typography.caption, color: theme.color.textSecondary };
  const suggestions: { label: string; text: string }[] = [
    { label: "带我写一次日记", text: "我想写一篇今天的日记，请从一个简单的问题开始，带我慢慢记录。" },
    { label: "为我讲解一个旅程内容", text: `请为我讲解「${title}」旅程的主要内容，以及我可以怎样开始。` },
    { label: "帮我理清此刻的感受", text: "我想整理一下此刻的感受，请先问我一个温和、容易回答的问题。" },
  ];
  const begin = () => {
    if (!draft.trim() || sending !== null) return;
    if (!authorized) { router.push({ pathname: "/journey/adult-gate", params: { entry: "ai" } }); return; }
    if (!preview && !request && !auth?.accountId) { router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/ai" } }); return; }
    const recentHistory = turns.slice(-6).flatMap(turn => [{ role: "user" as const, content: turn.question }, { role: "assistant" as const, content: turn.response.message }]);
    while (recentHistory.reduce((total, item) => total + item.content.length, 0) > 12000) recentHistory.splice(0, 2);
    const parsed = AssistantRequestSchema.safeParse({ mode: "chat", consent: true, records: [], question: draft.trim(), history: recentHistory, journeyId });
    if (!parsed.success) { setError("请输入 1–1000 字的消息。"); return; }
    Keyboard.dismiss(); setError(null);
    if (autoApprove && !needsPrivateConfirmation(parsed.data)) { void send(parsed.data); return; }
    setPending(parsed.data);
  };
  const stop = () => {
    epoch.current += 1; controller.current?.abort(); controller.current = null; setSending(null); setUsageRevision(value => value + 1);
    setError("已停止等待，草稿已保留。已经发送的内容无法撤回。");
  };
  const send = async (approved: AssistantRequest | null = pending) => {
    if (!approved || controller.current) return;
    const payload = approved;
    const current = ++epoch.current;
    const abort = new AbortController(); controller.current = abort;
    setPending(null); setSending(payload.question!); setError(null);
    try {
      const requester = request ?? (preview ? previewAssistant : createAssistantClient({
        baseUrl: getGatewayUrl(),
        getAccessToken: async () => {
          if (!auth?.accountId || !auth.getAssistantAccessToken) throw new AssistantClientError("unauthorized");
          return auth.getAssistantAccessToken(auth.accountId);
        },
      }));
      const response = await requester(payload, abort.signal);
      if (epoch.current !== current) return;
      setTurns(previous => [...previous, { question: payload.question!, response }]); setDraft("");
    } catch (caught) {
      if (epoch.current !== current) return;
      setError(caught instanceof AssistantClientError && caught.code === "quota-exceeded" ? "这段时间的聊天额度用完啦。点开仪表看看重置时间，我们稍后接着聊。" : caught instanceof AssistantClientError && caught.code === "unauthorized" ? "登录已失效，请重新登录后发送。草稿已保留。" : "这次未能取得回复，草稿已保留，请稍后重试。");
    } finally { if (epoch.current === current) { controller.current = null; setSending(null); setUsageRevision(value => value + 1); } }
  };
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: theme.color.background, paddingTop: insets?.top ?? 0 }}>
    <View style={{ flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" }}>
      <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>内界 AI</Text>
        <Text style={caption}>{preview ? "本机模拟" : "由你决定分享什么"}</Text>
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (turns.length || sending) scroll.current?.scrollToEnd({ animated: true }); }} contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 24 }}>
        {turns.length === 0 && sending === null ? <View style={{ flex: 1, justifyContent: "center", gap: 20, paddingVertical: 24 }}>
          <Text style={{ color: theme.color.primary, fontSize: 14, letterSpacing: 3 }}>CAVE · 留一点时间给自己</Text>
          <Text accessibilityRole="header" style={{ ...theme.typography.display, color: theme.color.text }}>今天，想从哪里聊起？</Text>
          <Text style={caption}>一句感受，一段记录，或旅程中的一个疑问。{"\n"}不必想好怎么说，我们慢慢来。</Text>
          <View style={{ gap: 10, marginTop: 8 }}>{suggestions.map(suggestion => <Pressable key={suggestion.label} accessibilityRole="button" accessibilityLabel={suggestion.label} onPress={() => { setDraft(suggestion.text); setError(null); input.current?.focus(); }} style={({ pressed }) => ({ minHeight: 52, padding: 16, borderRadius: 18, backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface, flexDirection: "row", justifyContent: "space-between", gap: 12 })}>
            <Text style={{ ...textStyle, flex: 1 }}>{suggestion.label}</Text><Text style={{ color: theme.color.primary, fontSize: 20 }}>↗</Text>
          </Pressable>)}</View>
          <Text style={caption}>点选后填入输入框，修改好再发送。</Text>
        </View> : null}
        {turns.map((turn, index) => <View key={index} style={{ gap: 20 }}>
          <View style={{ alignSelf: "flex-end", maxWidth: "90%", padding: 16, borderRadius: 20, backgroundColor: theme.color.surfaceAccent }}><Text selectable style={textStyle}>{turn.question}</Text></View>
          <View style={{ gap: 10 }}><Text style={{ ...caption, color: theme.color.primary }}>{turn.response.providerMode === "mock" ? "内界 AI · 模拟回复" : "内界 AI"}</Text>
            <Text selectable style={textStyle}>{[turn.response.message, turn.response.question, turn.response.summary, ...turn.response.observations.map(item => item.text)].filter(Boolean).join("\n\n")}</Text>
            {turn.response.sources.map(source => <Text key={source.id} selectable style={caption}>依据：{source.title}{source.url ? `\n${source.url}` : ""}</Text>)}
          </View>
        </View>)}
        {sending !== null ? <View style={{ gap: 16 }}><View style={{ alignSelf: "flex-end", padding: 16, borderRadius: 20, backgroundColor: theme.color.surfaceAccent }}><Text selectable style={textStyle}>{sending}</Text></View><Text accessibilityLiveRegion="polite" style={caption}>内界 AI · 正在思考…</Text><SecondaryButton label="停止等待" onPress={stop} /></View> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 10 }}>
        {error ? <Text accessibilityRole="alert" selectable style={{ ...caption, color: theme.color.danger }}>{error}</Text> : null}
        {!authorized ? <SecondaryButton label="成年声明后开始聊天" onPress={() => router.push({ pathname: "/journey/adult-gate", params: { entry: "ai" } })} /> : !preview && !auth?.accountId ? <SecondaryButton label="登录以使用在线 AI" onPress={() => router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/ai" } })} /> : null}
        <View style={{ backgroundColor: theme.color.surface, borderColor: theme.color.border, borderWidth: 1, borderRadius: 24, padding: 14, gap: 12 }}>
          <TextInput ref={input} accessibilityLabel="聊天消息" value={draft} onChangeText={value => { setDraft(value); setPending(null); setError(null); }} editable={sending === null} multiline maxLength={1000} placeholder="说说你想聊的事…" placeholderTextColor={theme.color.textSecondary} style={{ ...textStyle, minHeight: 56, maxHeight: 160, textAlignVertical: "top", padding: 4 }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            {!preview ? <Pressable accessibilityRole="switch" accessibilityLabel="帮我批准" accessibilityState={{ checked: autoApprove }} accessibilityHint="普通公开聊天自动批准，可能私密的内容仍需确认。仅在本次会话生效。" onPress={() => setAutoApprove(value => !value)} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: pressed ? theme.color.surfacePressed : autoApprove ? theme.color.surfaceAccent : theme.color.surface, borderWidth: 1, borderColor: autoApprove ? theme.color.primary : theme.color.border })}>
              <Feather name={autoApprove ? "check-circle" : "shield"} size={16} color={autoApprove ? theme.color.primary : theme.color.textSecondary} />
              <Text style={{ ...caption, color: autoApprove ? theme.color.primary : theme.color.textSecondary }}>帮我批准</Text>
            </Pressable> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginLeft: "auto" }}><AssistantUsageMeter revision={usageRevision} preview={preview} /><Pressable accessibilityRole="button" accessibilityLabel="发送消息" accessibilityState={{ disabled: !draft.trim() || sending !== null }} disabled={!draft.trim() || sending !== null} onPress={begin} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: draft.trim() && sending === null ? theme.color.primary : theme.color.disabled }}><Text style={{ fontSize: 24, color: theme.color.onPrimary }}>↑</Text></Pressable></View>
          </View>
        </View>
        <Text style={{ ...caption, fontSize: 12, textAlign: "center" }}>{preview ? "本机模拟，不发送云端" : autoApprove ? "可能私密的内容，仍会先问你" : "发送前会与你确认 · 带上最近的聊天，让我们接着聊"}</Text>
      </View>
    </View>
    <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={() => setPending(null)}>
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#00000099", padding: 24, paddingTop: Math.max(insets?.top ?? 0, 24), paddingBottom: Math.max(insets?.bottom ?? 0, 24) }}>
        <View accessibilityViewIsModal style={{ maxHeight: "90%", width: "100%", maxWidth: 560, alignSelf: "center", backgroundColor: theme.color.surface, borderRadius: 24, padding: 24, gap: 16 }}>
          <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>{preview ? "确认本次模拟内容" : "允许将这些内容发送云端吗？"}</Text>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <Text style={caption}>{preview ? "以下内容仅用于本机模拟。" : "接收方：内界服务端及 DeepSeek。用途：AI 思考并生成本次回复。"}</Text>
            <Text style={textStyle}>资源：本条消息</Text><Text selectable style={{ ...textStyle, backgroundColor: theme.color.surfaceAccent, padding: 12, borderRadius: 12 }}>{pending?.question}</Text>
            {pending?.history?.length ? <View style={{ gap: 8 }}><Text style={textStyle}>最近对话：{pending.history.length} 条</Text>{pending.history.map((item, index) => <Text selectable key={index} style={caption}>{item.role === "user" ? "你" : "内界 AI"}：{item.content}</Text>)}<SecondaryButton label="这次仅发送本条消息" onPress={() => setPending(current => current ? { ...current, history: [] } : null)} /></View> : null}
            <Text style={caption}>用途：{"日常聊天、记录与旅程问答"}</Text>
            {pending?.journeyId ? <Text selectable style={caption}>旅程资源：{title}（标识：{pending.journeyId}）。服务端会依据已审核的旅程知识回答。</Text> : null}
            <Text style={caption}>仅发送上方列出的消息，不读取私人手记、照片或隐藏卡片。本次授权仅对这些内容有效。</Text>
          </ScrollView>
          <Button label={preview ? "确认运行本机模拟" : "允许并发送"} onPress={() => { void send(); }} />
          {pending && needsPrivateConfirmation(pending) ? <Text style={caption}>这次内容可能涉及个人信息，需要你亲自确认后再发送。</Text> : null}
          {!autoApprove && !preview ? <><SecondaryButton label="帮我批准" onPress={() => { setAutoApprove(true); if (pending && !needsPrivateConfirmation(pending)) { void send(pending); } }} /><Text style={caption}>仅本次会话：普通公开聊天自动批准；可能私密或不确定的内容仍会先问你。可随时关闭。</Text></> : null}
          <SecondaryButton label="取消，继续编辑" onPress={() => setPending(null)} />
        </View>
      </View>
    </Modal>
  </KeyboardAvoidingView>;
}
