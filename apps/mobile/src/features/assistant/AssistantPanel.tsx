import { AssistantRequestSchema, type AssistantRequest, type AssistantResponse } from "@cave/contracts";
import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { useTheme } from "../../core/design/theme-provider";
import { Card } from "../../core/ui/Card";
import { Button } from "../../core/ui/Button";
import { SecondaryButton } from "../../core/ui/secondary-button";
import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { AssistantClientError, createAssistantClient, previewAssistant, type AssistantRequester } from "./assistant-client";

type Mode = AssistantRequest["mode"];
const labels: Record<Mode, string> = { guide: "帮我继续写", summarize: "帮我整理", review: "帮我回顾", journey: "问问这一步" };
const errorMessages: Record<AssistantClientError["code"], string> = {
  configuration: "AI 服务地址尚未配置好，你仍可在本机保存。",
  "invalid-input": "请检查所选内容：最多 10 条，每条 4000 字，总计 12000 字；不会自动截断你的记录。",
  network: "AI 暂时无法连接，你的文字仍在这里，可以直接保存或稍后重试。",
  unauthorized: "请重新登录后使用 AI；本机记录仍保留。",
  "rate-limit": "本次请求较多，请稍后再试。你可以继续记录。",
  "invalid-response": "这次 AI 结果未通过检查，没有采用。你可以继续记录。",
  cancelled: "已取消本次等待，你可以继续记录。",
};

export type AssistantPanelProps = Readonly<{
  records: AssistantRequest["records"];
  modes?: readonly Mode[];
  journeyId?: string;
  onAdopt?(text: string): void;
  onOpenRecord?(id: string): void;
  request?: AssistantRequester;
}>;

export function AssistantPanel(props: AssistantPanelProps) {
  const auth = useOptionalAuth();
  // Account changes remount all consent/result state before anything can be shown.
  return <AssistantSession key={auth?.accountId ?? "signed-out"} {...props} accountId={auth?.accountId}
    getToken={auth?.getAssistantAccessToken} />;
}

function AssistantSession({ records, modes = ["guide", "summarize"], journeyId, onAdopt, onOpenRecord, request, accountId, getToken }: AssistantPanelProps & {
  accountId: string | undefined;
  getToken: ((accountId: string) => Promise<string>) | undefined;
}) {
  const theme = useTheme();
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<AssistantRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [resultInput, setResultInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adopted, setAdopted] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const preview = __DEV__ && process.env.EXPO_PUBLIC_ASSISTANT_MODE === "mock";
  const inputKey = JSON.stringify({ records, question, journeyId });
  const latestInput = useRef(inputKey);
  latestInput.current = inputKey;
  useEffect(() => () => { epoch.current += 1; controllerRef.current?.abort(); }, []);
  // Editing while a request is running invalidates its result and consent.
  useEffect(() => {
    epoch.current += 1;
    controllerRef.current?.abort();
    setBusy(false);
    setPending(null);
  }, [inputKey]);

  const begin = (mode: Mode) => {
    setError(null);
    const parsed = AssistantRequestSchema.safeParse({
      mode, consent: true, records: mode === "journey" ? [] : records,
      ...(question.trim() ? { question: question.trim() } : {}),
      ...(journeyId ? { journeyId } : {}),
    });
    if (!parsed.success) { setError(errorMessages["invalid-input"]); return; }
    setPending(parsed.data);
  };
  const cancel = () => {
    epoch.current += 1;
    controllerRef.current?.abort();
    setBusy(false);
    setPending(null);
    setResult(null);
    setError(null);
  };
  const send = async () => {
    if (!pending || busy) return;
    const capturedInput = inputKey;
    const current = ++epoch.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true); setResult(null); setError(null); setAdopted(false);
    try {
      const requester = request ?? (preview ? previewAssistant : createAssistantClient({
        baseUrl: process.env.EXPO_PUBLIC_GATEWAY_URL?.trim() || "https://api.neijiecave.com",
        getAccessToken: async () => {
          if (!accountId || !getToken) throw new AssistantClientError("unauthorized");
          return getToken(accountId);
        },
      }));
      const response = await requester(pending, controller.signal);
      if (epoch.current !== current || latestInput.current !== capturedInput) return;
      setResult(response); setResultInput(capturedInput); setPending(null);
    } catch (caught) {
      if (epoch.current !== current) return;
      setError(errorMessages[caught instanceof AssistantClientError ? caught.code : "network"]);
    } finally {
      if (epoch.current === current) setBusy(false);
    }
  };
  const shownResult = resultInput === inputKey ? result : null;
  return <Card variant="muted">
    <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>可选的 AI 辅助</Text>
    <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
      {preview ? "本机模拟模式 · 不调用 DeepSeek，不发送内容。" : "每次先预览并同意，才把选定内容发送至内界服务端及 DeepSeek 处理；不会读取其他手记，也不是云备份。"}
    </Text>
    {modes.includes("journey") ? <TextInput accessibilityLabel="想问的旅程问题" placeholder="例如：做到一半想暂停，可以吗？" placeholderTextColor={theme.color.textMuted}
      value={question} onChangeText={setQuestion} maxLength={1000} multiline style={{ color: theme.color.text, borderColor: theme.color.border, borderWidth: 1, borderRadius: theme.radius.md, padding: theme.space.md, minHeight: 80 }} /> : null}
    {!pending && <View style={{ gap: theme.space.sm }}>{modes.map(mode => <SecondaryButton key={mode} label={labels[mode]} disabled={busy} onPress={() => begin(mode)} />)}</View>}
    {pending && <View style={{ gap: theme.space.sm }}>
      <Text accessibilityRole="header" style={{ ...theme.typography.label, color: theme.color.text }}>{preview ? "本次模拟使用的内容" : "本次将发送的内容"}</Text>
      <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>用途：{labels[pending.mode]}。包含下列文字{pending.mode === "journey" ? "及当前旅程标识" : "及用于关联出处的记录标识"}，不包含其他历史、账号邮箱或隐藏卡片。</Text>
      {pending.records.map(record => <Text selectable key={record.id} style={{ ...theme.typography.body, color: theme.color.text }}>{record.text}</Text>)}
      {pending.question ? <Text selectable style={{ color: theme.color.text }}>{pending.question}</Text> : null}
      {pending.records.length === 0 && !pending.question ? <Text style={{ color: theme.color.text }}>未填写内容，仅请求一个开始记录的问题。</Text> : null}
      <Button label={busy ? "正在等待…" : preview ? "确认运行本机模拟" : "同意本次发送并继续"} disabled={busy} onPress={() => { void send(); }} />
      <SecondaryButton label={busy ? "取消等待" : "暂不使用"} onPress={cancel} />
      {busy && !preview ? <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>取消会停止等待，无法撤回已经发送的内容。</Text> : null}
    </View>}
    {error && <Text accessibilityRole="alert" style={{ color: theme.color.danger }}>{error}</Text>}
    {shownResult && <View style={{ gap: theme.space.sm }}>
      <Text accessibilityLiveRegion="polite" style={{ ...theme.typography.label, color: theme.color.text }}>{shownResult.providerMode === "mock" ? "模拟结果 · 未调用真实模型" : "AI 提议 · 由你确认"}</Text>
      <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{shownResult.message}</Text>
      {shownResult.status === "ok" && <>
        {shownResult.question && <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{shownResult.question}</Text>}
        {shownResult.summary && <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{shownResult.summary}</Text>}
        {shownResult.observations.map((observation, index) => <View key={index} style={{ gap: theme.space.xs }}>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{observation.text}</Text>
          {onOpenRecord && observation.sourceRecordIds.map(id => <SecondaryButton key={id} label={`查看原记录：${records.find(record => record.id === id)?.text.split("\n")[0]?.slice(0, 32) ?? "记录"}`} onPress={() => onOpenRecord(id)} />)}
        </View>)}
        {shownResult.sources.map(source => <Text selectable key={source.id} style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>依据：{source.title}{source.url ? `\n${source.url}` : ""}</Text>)}
        {shownResult.summary && onAdopt && <Button label={adopted ? "已放入编辑区，可继续修改" : "符合，放入编辑区"} disabled={adopted} onPress={() => {
          if (shownResult.summary) { onAdopt(shownResult.summary); setAdopted(true); }
        }} />}
      </>}
      <SecondaryButton label="不太对，收起结果" onPress={cancel} />
    </View>}
  </Card>;
}
