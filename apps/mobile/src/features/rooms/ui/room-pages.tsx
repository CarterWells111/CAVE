import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Screen } from "../../../core/ui/Screen";
import { ActionRow } from "../../../core/ui/action-row";
import { BottomSheet } from "../../../core/ui/bottom-sheet";
import { HelpText, PageHeader } from "../../../core/ui/page-header";
import { SelectionField } from "../../../core/ui/selection-field";
import { TextAction } from "../../../core/ui/text-action";
import { ROOM_QUESTIONS, ROOM_SCENARIOS, ROOM_QUESTION_IDS, mayGenerateReport, normalizeInviteToken, type Room, type RoomApi, type RoomQuestionId, type RoomReport, type RoomScenarioId } from "../domain/room";
import { formatRoomReport, REPORT_ROLE_NOTE, roomReportAiDraft } from "../domain/report-text";
import { RoomApiError } from "../infrastructure/room-api-client";

function Feedback({ message }: { message: string | null }) {
  const theme = useTheme();
  return message ? <Text accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.text }}>{message}</Text> : null;
}

function RoomHeader({ title, help }: { title: string; help: ReactNode }) {
  const router = useRouter();
  return <PageHeader title={title} help={help} onBack={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/rooms")} />;
}

function useOperation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (error) {
      setError(error instanceof RoomApiError && error.code === "HTTP_404"
        ? "双人房间内测尚未开启，请稍后再试。"
        : "操作失败，请检查网络后重试。");
    }
    finally { inFlight.current = false; setBusy(false); }
  };
  return { busy, error, run, setError };
}

export function RoomListPage() {
  const router = useRouter();
  const theme = useTheme();
  return <Screen contentSafeAreaTop>
    <View style={{ gap: theme.space.md }}>
      <PageHeader title="房间" help={<HelpText>从一个情景开始。双人模式中，你们分别作答；原文只给本人查看，共同报告在两人完成并同意后才可生成。</HelpText>} />
      {ROOM_SCENARIOS.map((scenario) => <ActionRow key={scenario.id} title={scenario.title} subtitle={scenario.introduction} onPress={() => router.push({ pathname: "/rooms/choose", params: { scenario: scenario.id } })} />)}
      <Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: theme.color.text }}>房间工具</Text>
      <View testID="room-primary-actions" style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm }}>
        <TextAction label="加入房间" onPress={() => router.push("/join")} />
        <TextAction label="我的房间" onPress={() => router.push("/rooms/mine")} />
      </View>
    </View>
  </Screen>;
}

export function MyRoomsPage({ api }: { api: RoomApi }) {
  const router = useRouter();
  const theme = useTheme();
  const [rooms, setRooms] = useState<readonly Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRooms(await api.list()); }
    catch (error) {
      setError(error instanceof RoomApiError && error.status === 404
        ? "双人房间内测尚未开启。你可以先查看情景，选择单人模式体验。"
        : "房间状态暂时无法读取，请重试。");
    }
    finally { setLoading(false); }
  }, [api]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <Screen contentSafeAreaTop>
    <View style={{ gap: theme.space.md }}>
      <RoomHeader title="我的房间" help={<HelpText>这里保留已加入的房间。打开房间可继续作答、等待对方或查看共同报告；刷新可读取最新状态。</HelpText>} />
      <Button label="新建房间" onPress={() => router.push("/rooms/new")} />
      <Feedback message={error} />
      {!loading && !error && rooms.length === 0 ? <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>还没有房间。可以新建一个，先独立作答，再邀请伴侣加入。</Text> : null}
      {rooms.map((room) => <ActionRow key={room.id} title={ROOM_SCENARIOS.find((scenario) => scenario.id === room.scenarioId)?.title ?? "房间"} subtitle={room.status === "ended" ? "已终止" : room.status === "reported" ? "查看报告" : room.status === "ready" ? "待生成报告" : room.participantCount < 2 ? "待加入" : room.myCompleted ? "等待对方完成" : "继续作答"} onPress={() => router.push({ pathname: "/rooms/[roomId]", params: { roomId: room.id } })} />)}
      <Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: theme.color.text }}>房间工具</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm }}>
        <TextAction label="加入房间" onPress={() => router.push("/join")} />
        <TextAction label="刷新房间状态" loading={loading} onPress={() => { void load(); }} />
      </View>
    </View>
  </Screen>;
}

export function RoomNewPage({ api }: { api: RoomApi }) {
  const router = useRouter();
  const theme = useTheme();
  const operation = useOperation();
  const [scenarioId, setScenarioId] = useState<RoomScenarioId>("first-overnight");
  const scenario = ROOM_SCENARIOS.find((item) => item.id === scenarioId)!;
  return <Screen contentSafeAreaTop>
    <View style={{ gap: theme.space.md }}>
      <RoomHeader title="新建房间" help={<HelpText>选择一个情景创建双人房间。创建后可先独立作答，再邀请伴侣。</HelpText>} />
      <SelectionField label="情景" value={scenarioId} options={ROOM_SCENARIOS.map((item) => ({ value: item.id, label: item.title, detail: item.introduction }))} onChange={setScenarioId} disabled={operation.busy} />
      <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{scenario.introduction}</Text>
      <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>你的回答会逐题加密保存到云端，原文仅你能查看；双方完成并分别同意后，才能生成共同报告。不要填写不希望上传的内容。</Text>
      <Button label="同意云端保存，创建房间" loading={operation.busy} onPress={() => { void operation.run(async () => {
        const room = await api.create(scenarioId);
        router.replace({ pathname: "/rooms/[roomId]", params: { roomId: room.id } });
      }); }} />
      <Feedback message={operation.error} />
    </View>
  </Screen>;
}

export function RoomChoicePage({ scenarioId, onSingle, onDuo }: { scenarioId: RoomScenarioId; onSingle(): void | Promise<void>; onDuo(): void }) {
  const theme = useTheme();
  const operation = useOperation();
  const scenario = ROOM_SCENARIOS.find((item) => item.id === scenarioId)!;
  return <Screen contentSafeAreaTop>
    <View style={{ gap: theme.space.md }}>
      <RoomHeader title={scenario.title} help={<HelpText>{scenario.introduction} 可以独立探索，也可以邀请伴侣分别作答。</HelpText>} />
      <Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: theme.color.text }}>单人探索</Text>
      <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>先从自己的感受与边界开始。</Text>
      <Button label="一个人探索" loading={operation.busy} onPress={() => { void operation.run(async () => { await onSingle(); }); }} />
      <Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: theme.color.text }}>双人探索</Text>
      <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>双人模式会创建云端房间。你的回答会逐题保存到云端，仅你能查看原文；两人完成并明确同意后，可生成双方可见的共同报告。不要在答案中填写不希望上传的内容。</Text>
      <TextAction disabled={operation.busy} label="双人一起探索" onPress={onDuo} />
      <Feedback message={operation.error} />
    </View>
  </Screen>;
}

export function RoomStartPage({ api, scenarioId }: { api: RoomApi; scenarioId: RoomScenarioId }) {
  const router = useRouter();
  const theme = useTheme();
  const operation = useOperation();
  const scenario = ROOM_SCENARIOS.find((item) => item.id === scenarioId)!;
  return <Screen contentSafeAreaTop><View style={{ gap: theme.space.md }}>
    <RoomHeader title={`${scenario.title} · 双人房间`} help={<HelpText>创建后可以先独立作答，再邀请对方。</HelpText>} />
    <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{scenario.introduction}</Text>
    <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>你的回答逐题上传并保存在云端，原文只给你查看。完成时还需另行同意生成双方可见的共同报告。</Text>
    <Button label="同意云端保存，创建房间" loading={operation.busy} onPress={() => { void operation.run(async () => {
      const room = await api.create(scenarioId);
      router.replace({ pathname: "/rooms/[roomId]", params: { roomId: room.id } });
    }); }} />
    <Feedback message={operation.error} />
  </View></Screen>;
}

export function RoomJoinPage({ api, initialToken }: { api: RoomApi; initialToken?: string }) {
  const router = useRouter();
  const theme = useTheme();
  const [token, setToken] = useState(initialToken ?? "");
  const operation = useOperation();
  useEffect(() => { if (initialToken) setToken(initialToken); }, [initialToken]);
  const normalized = normalizeInviteToken(token);
  return <Screen contentSafeAreaTop>
    <View style={{ gap: theme.space.md }}>
      <RoomHeader title="加入双人房间" help={<HelpText>请用自己的账号加入，输入对方发来的邀请令牌。</HelpText>} />
      <Text style={{ ...theme.typography.cardTitle, color: theme.color.text }}>邀请令牌</Text>
      <TextInput accessibilityLabel="邀请令牌" autoCapitalize="none" autoCorrect={false} maxLength={256} onChangeText={setToken} placeholder="输入邀请令牌" style={{ borderColor: theme.color.border, borderWidth: 1, borderRadius: theme.radius.control, color: theme.color.text, padding: theme.space.md }} value={token} />
      <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>加入后，你的回答会逐题保存到云端，原文只给你查看。共同报告需要双方完成并同意。</Text>
      <Button disabled={normalized === null} label="同意云端保存，加入房间" loading={operation.busy} onPress={() => { if (normalized) void operation.run(async () => {
        const room = await api.join(normalized);
        router.replace({ pathname: "/rooms/[roomId]", params: { roomId: room.id } });
      }); }} />
      <Feedback message={operation.error} />
    </View>
  </Screen>;
}

function Question({ api, question, room, onUpdate }: { api: RoomApi; question: { id: RoomQuestionId; title: string; prompt: string }; room: Room; onUpdate(room: Room): void }) {
  const theme = useTheme();
  const [draft, setDraft] = useState(room.myAnswers[question.id] ?? "");
  const operation = useOperation();
  const canEdit = !room.myCompleted || room.report?.status === "insufficient";
  useEffect(() => { setDraft(room.myAnswers[question.id] ?? ""); }, [question.id, room.myAnswers[question.id]]);
  return <View style={{ gap: theme.space.sm, padding: theme.space.md, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.feature }}>
    <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>{question.title}</Text>
    <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{question.prompt}（可跳过）</Text>
    <TextInput accessibilityLabel={`${question.title}的回答`} editable={canEdit && room.status !== "ended"} maxLength={2000} multiline onChangeText={setDraft} placeholder="写下你的想法" style={{ borderColor: theme.color.border, borderWidth: 1, borderRadius: theme.radius.control, color: theme.color.text, minHeight: 100, padding: theme.space.md, textAlignVertical: "top" }} value={draft} />
    {canEdit && room.status !== "ended" ? <TextAction disabled={draft === (room.myAnswers[question.id] ?? "")} label={draft.trim() ? "保存这题到云端" : "清空这题"} loading={operation.busy} onPress={() => { void operation.run(async () => onUpdate(await api.saveAnswer(room.id, question.id, draft.trim()))); }} /> : null}
    <Feedback message={operation.error} />
  </View>;
}

function ReportContent({ report }: { report: RoomReport }) {
  const theme = useTheme();
  const section = (title: string, body: string) => <View style={{ gap: theme.space.xs }}>
    <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>{title}</Text>
    <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{body}</Text>
  </View>;
  return <View style={{ gap: theme.space.md }}>
    <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>共同报告</Text>
    {report.status === "ready" ? <>
      <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{REPORT_ROLE_NOTE}</Text>
      {section("共同点与差异", report.sections.commonAndDifferences)}
      {section("给你们的建议", report.sections.adviceForBoth)}
      {section("接下来的建议", report.sections.nextSteps)}
    </> : <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{report.message}</Text>}
  </View>;
}

export function RoomDetailPage({ api, roomId, onExport, onDiscuss, onRecord }: { api: RoomApi; roomId: string; onExport?: (view: View) => Promise<void>; onDiscuss?: (draft: string, scenarioId: RoomScenarioId) => void; onRecord?: (text: string, roomId: string) => void }) {
  const theme = useTheme();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportConsent, setReportConsent] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [reportToolsOpen, setReportToolsOpen] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);
  const reportView = useRef<View>(null);
  const reportToolsTrigger = useRef<View>(null);
  const operation = useOperation();
  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try { setRoom(await api.get(roomId)); } catch { setLoadError("房间暂时无法读取，请重试。"); }
    finally { setLoading(false); }
  }, [api, roomId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const scenario = ROOM_SCENARIOS.find((item) => item.id === room?.scenarioId);
  return <Screen contentSafeAreaTop>
    <View style={{ gap: theme.space.md }}>
      <RoomHeader title={scenario?.title ?? "双人房间"} help={<>
        <HelpText>你们分别作答，原文只给本人查看。每题可跳过，双方完成并分别同意后才可生成共同报告。</HelpText>
        <HelpText>房间工具可刷新状态、邀请对方或终止房间。报告下方的工具可导出图片、带入 AI 草稿或手记草稿。</HelpText>
      </>} />
      <Feedback message={loadError} />
      {!room ? <TextAction label="刷新状态" loading={loading} onPress={() => { void load(); }} /> : null}
      {room ? <>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>我的进度：{room.myCompleted ? "已完成" : `${ROOM_QUESTION_IDS.filter((id) => room.myAnswers[id]?.trim()).length}/4 题已保存`} · 对方：{room.participantCount < 2 ? "未加入" : room.partnerCompleted ? "已完成" : "进行中"}</Text>
        {room.status === "ended" ? <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>房间已终止，不能继续作答或生成报告。</Text> : <>
          <Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: theme.color.text }}>下一步</Text>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{
            room.report?.status === "ready" ? "共同报告已生成，可以阅读下方报告。"
              : room.report?.status === "insufficient" ? "信息不足时可以补充自己的回答；保存后需再次确认生成共同报告。"
                : room.report?.status === "paused" ? "请先阅读下方报告中的暂停提示。"
                  : !room.myCompleted ? "逐题保存你的回答，再确认是否生成共同报告。"
                    : mayGenerateReport(room) ? "双方已完成并同意，可以生成共同报告。"
                      : "你的回答已完成。等待对方完成后刷新状态。"
          }</Text>
          {room.myCompleted && !room.report && !mayGenerateReport(room) ? <Button label="刷新状态" loading={loading} onPress={() => { void load(); }} /> : null}
          {mayGenerateReport(room) ? <Button label="生成共同报告" loading={operation.busy} onPress={() => { void operation.run(async () => setRoom(await api.generateReport(room.id))); }} /> : null}
          {room.report ? <>
            <View collapsable={false} ref={reportView} style={{ backgroundColor: theme.color.surface, gap: theme.space.md, padding: theme.space.lg }}>
              <ReportContent report={room.report} />
            </View>
            {room.report.status === "ready" ? <>
              <TextAction ref={reportToolsTrigger} label="报告工具" onPress={() => setReportToolsOpen(true)} />
              <BottomSheet title="报告工具" visible={reportToolsOpen} onClose={() => setReportToolsOpen(false)} returnFocusRef={reportToolsTrigger}>
                {onExport ? <>
                  <HelpText>导出图片仅保存到本机相册。相册权限、系统云照片或设备备份可能同步这张图片；房间不会自动替你备份导出文件。</HelpText>
                  <TextAction label="导出报告（图片）" onPress={() => { const view = reportView.current; if (!view) return; setExportMessage(null); void onExport(view).then(() => setExportMessage("已保存到本机相册。"), () => setExportMessage("保存失败，请检查相册权限后重试。")); }} />
                  <Feedback message={exportMessage} />
                </> : null}
                {onDiscuss || onRecord ? <HelpText>AI 只会预填可编辑草稿，发送前需再次确认。手记会预填主文本框并在本机保留草稿；只有你点击保存才成为记录。</HelpText> : null}
                {onDiscuss ? <TextAction label="和内界AI详细聊聊" onPress={() => { try { onDiscuss(roomReportAiDraft(room.report!), room.scenarioId); setReportToolsOpen(false); } catch { operation.setError("报告暂时无法完整带入 AI，请稍后重试。"); } }} /> : null}
                {onRecord ? <TextAction label="记录此次沟通" onPress={() => { onRecord(formatRoomReport(room.report!), room.id); setReportToolsOpen(false); }} /> : null}
                <Feedback message={operation.error} />
              </BottomSheet>
            </> : null}
          </> : null}
          {room.myCompleted && room.report?.status !== "insufficient" ? <TextAction label={answersOpen ? "收起我的回答" : "查看我的回答"} onPress={() => setAnswersOpen((value) => !value)} /> : null}
          {!room.myCompleted || room.report?.status === "insufficient" || answersOpen ? <>
            <Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: theme.color.text }}>我的回答</Text>
            <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>每题需点击保存才会上传到云端，原文只给你查看。不要填写不希望上传的内容。</Text>
            {ROOM_QUESTIONS[room.scenarioId].map((question) => <Question api={api} key={question.id} onUpdate={setRoom} question={question} room={room} />)}
          </> : null}
          {!room.myCompleted ? <>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: reportConsent }} onPress={() => setReportConsent((value) => !value)} style={{ flexDirection: "row", gap: theme.space.sm, paddingVertical: theme.space.sm }}>
              <Text style={{ color: theme.color.text }}>{reportConsent ? "☑" : "☐"}</Text>
              <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flex: 1 }}>我同意在双方完成后，从各自已上传的回答生成双方可见的共同报告；我的原文仍只给我查看。</Text>
            </Pressable>
            <Button disabled={!reportConsent} label="完成我的回答" loading={operation.busy} onPress={() => { void operation.run(async () => setRoom(await api.complete(room.id, true))); }} />
          </> : null}
        </>}
        <Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: theme.color.text }}>房间工具</Text>
        {!(room.myCompleted && !room.report && !mayGenerateReport(room) && room.status !== "ended") ? <TextAction label="刷新状态" loading={loading} onPress={() => { void load(); }} /> : null}
        {room.participantCount < 2 && room.status !== "ended" ? <>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>每次复制都会签发新邀请，并使之前的链接失效。</Text>
          <TextAction label="签发并复制加入链接" loading={operation.busy} onPress={() => { void operation.run(async () => {
            const token = await api.issueInvite(room.id);
            await Clipboard.setStringAsync(`https://neijiecave.com/join#invite=${encodeURIComponent(token)}`);
            setInviteMessage("加入链接已复制。请只发给想邀请的人。");
          }); }} />
          <Feedback message={inviteMessage} />
        </> : null}
        {room.status !== "ended" ? <>
          <TextAction label="终止房间" onPress={() => Alert.alert("终止房间？", "终止后双方都不能继续作答或生成报告。", [
            { text: "取消", style: "cancel" },
            { text: "终止", style: "destructive", onPress: () => { void operation.run(async () => setRoom(await api.end(room.id))); } },
          ])} />
        </> : null}
        {!reportToolsOpen ? <Feedback message={operation.error} /> : null}
      </> : null}
    </View>
  </Screen>;
}
