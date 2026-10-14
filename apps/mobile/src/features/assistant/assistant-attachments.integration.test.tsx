import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { AssistantRequest, AssistantResponse } from "@cave/contracts";

import { JournalService } from "../journal/application/journal-service";
import { InMemoryJournalRepository } from "../journal/infrastructure/in-memory-journal-repository";
import { AssistantChat } from "./assistant-chat";
import { AssistantComposerInput } from "./AssistantComposerInput";
import { AssistantHistoryProvider } from "./AssistantHistoryProvider";
import type { AssistantJournalAccess } from "./assistant-journal";
import { InMemoryAssistantHistoryRepository } from "./history/in-memory-assistant-history-repository";

const owner = "synthetic-attachment-owner";
let mockSequence = 0;
let mockAccess: AssistantJournalAccess;
let mockHistory: InMemoryAssistantHistoryRepository;
const mockPush = jest.fn();
const mockAuth = { accountId: owner, status: "signedIn", getAssistantAccessToken: jest.fn(async () => "synthetic-token-never-used") };
jest.mock("expo-crypto", () => ({ randomUUID: () => `synthetic-chat-${++mockSequence}` }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => mockAuth }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({ useAdultDeclaration: () => ({ status: "authorized" }), useOptionalJourneyRuntime: () => ({ assistantHistory: mockHistory }) }));
jest.mock("../journal/runtime/JournalAccessProvider", () => ({ useOptionalJournalAccess: () => mockAccess }));
jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");

const reply: AssistantResponse = { status: "ok", providerMode: "mock", message: "合成附件回答", observations: [], sources: [] };
const journalPermission = "允许 AI 使用所选手记和草稿整理本次内容吗？";

function generated(payload: AssistantRequest, body = "合成生成的手记正文"): AssistantResponse {
  if (!payload.journalDraft) throw new Error("expected structured journal-draft request");
  return { ...reply, journalStage: "ready", journalDraft: { protocol: "cave-journal-draft-v1", requestId: payload.journalDraft.requestId, title: payload.journalDraft.operation === "edit" ? payload.journalDraft.title : "合成新手记标题", occurredAt: payload.journalDraft.occurredAt, body } };
}
const composerDraft = () => screen.UNSAFE_getByType(AssistantComposerInput).props.initialValue;

function setupJournal() {
  const repository = new InMemoryJournalRepository();
  const service = new JournalService(repository, { now: () => new Date().toISOString(), createId: () => `synthetic-record-${++mockSequence}` }, owner);
  mockAccess = { status: "ready", accountId: owner, service };
  return service;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSequence = 0;
  mockHistory = new InMemoryAssistantHistoryRepository();
  setupJournal();
  delete process.env.EXPO_PUBLIC_ASSISTANT_MODE;
});

async function mountChat(request: (payload: AssistantRequest, signal: AbortSignal) => Promise<AssistantResponse>) {
  const view = render(<AssistantHistoryProvider><AssistantChat authorized journeyId="pause" request={request} /></AssistantHistoryProvider>);
  await act(async () => undefined);
  return view;
}
function openMenu() { fireEvent.press(screen.getByRole("button", { name: "添加聊天附件" })); }
async function openJournal() {
  openMenu();
  fireEvent.press(screen.getByRole("button", { name: /^内界手记，/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: "新建手记草稿" })).not.toBeDisabled());
}
async function newJournalDraft() {
  await openJournal();
  fireEvent.press(screen.getByRole("button", { name: "新建手记草稿" }));
  await screen.findByRole("button", { name: "重新选择" });
}
async function optimizeJournal(title: string) {
  await openJournal();
  fireEvent.press(await screen.findByRole("checkbox", { name: `选择手记：${title}` }));
  fireEvent.press(screen.getByRole("button", { name: "优化内容" }));
  await screen.findByRole("button", { name: "重新选择" });
}
function send(question: string) {
  fireEvent.changeText(screen.getByLabelText("聊天消息"), question);
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
}
function allowContext() {
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: false }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
}
test("attachment plus appears beside permission control and offers only journal without the removed footer captions", async () => {
  const request = jest.fn(async () => reply);
  await mountChat(request);
  const plus = screen.getByRole("button", { name: "添加聊天附件" });
  let controls = plus.parent!;
  while (controls.parent && !within(controls).queryByRole("switch", { name: "帮我批准" })) controls = controls.parent;
  expect(within(controls).getAllByRole("button")[0]?.props.accessibilityLabel).toBe("添加聊天附件");
  openMenu();
  expect(screen.getByRole("button", { name: /^内界手记，/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^房间，/ })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "关闭添加附件" }));
  expect(screen.queryByText("普通聊天直接发送 · 日记和旅程访问已关闭")).toBeNull();
  expect(screen.queryByText("普通聊天直接发送 · 可使用问题涉及的日记和旅程")).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

test("structured new journal generation and preview do not write until the user confirms saving", async () => {
  const service = mockAccess.service!;
  const create = jest.spyOn(service, "createRecord");
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async payload => generated(payload));
  await mountChat(request);
  await newJournalDraft();
  send("今天在公园散步，请整理成手记");
  await screen.findByText(reply.message);
  expect(request.mock.calls[0]?.[0]).toMatchObject({ mode: "journal-draft", question: "今天在公园散步，请整理成手记", records: [], journalDraft: { protocol: "cave-journal-draft-v1", operation: "new", body: "" } });
  expect(create).not.toHaveBeenCalled();
  expect(await service.listRecords()).toEqual([]);
  fireEvent.press(screen.getByRole("button", { name: "预览/保存手记" }));
  expect(screen.getByLabelText("手记标题")).toHaveProp("value", "合成新手记标题");
  expect(screen.getByLabelText("手记正文")).toHaveProp("value", "合成生成的手记正文");
  expect(create).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "确认保存至我的手记" }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  const saved = await service.listRecords();
  expect(saved).toHaveLength(1);
  expect((await service.loadRecord(saved[0]!.id))?.record.body).toBe("合成生成的手记正文");
});

test("journal picker is single select, moves new above existing records and offers only optimize or review actions", async () => {
  const original = await mockAccess.service!.createRecord({ title: "合成选择手记", occurredAt: "2026-10-14", body: "选择时不展开的正文" });
  const other = await mockAccess.service!.createRecord({ title: "合成另一篇手记", occurredAt: "2026-10-14", body: "替换选择的正文" });
  const request = jest.fn(async () => reply);
  const view = await mountChat(request);
  await openJournal();
  const layout = JSON.stringify(view.toJSON());
  expect(layout.indexOf("新建手记草稿")).toBeLessThan(layout.indexOf(`选择手记：${original.title}`));
  expect(screen.queryByRole("button", { name: /^完成选择/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "不使用手记" })).toBeNull();
  fireEvent.press(await screen.findByRole("checkbox", { name: `选择手记：${original.title}` }));
  expect(screen.getByRole("button", { name: "优化内容" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "回顾记忆" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^优化手记：/ })).toBeNull();
  fireEvent.press(screen.getByRole("checkbox", { name: `选择手记：${other.title}` }));
  expect(screen.getByRole("checkbox", { name: `选择手记：${original.title}` }).props.accessibilityState.checked).toBe(false);
  expect(screen.getByRole("checkbox", { name: `选择手记：${other.title}` }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "优化内容" }));
  await screen.findByRole("button", { name: "重新选择" });
  expect(screen.getByRole("button", { name: "重新选择" })).toBeTruthy();
  expect(screen.queryByText(original.title)).toBeNull();
  expect(screen.queryByText(other.title)).toBeNull();
  expect(screen.queryByRole("button", { name: "预览/保存手记" })).toBeNull();
  expect(screen.queryByRole("button", { name: "移除手记附件" })).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

test("diary starter selects a new journal immediately, interviews first, and exposes a separate preview action only when ready", async () => {
  const service = mockAccess.service!;
  const create = jest.spyOn(service, "createRecord");
  const questionReply: AssistantResponse = { ...reply, message: "今天有哪件小事让你停留了一会儿？", journalStage: "collecting" };
  const readyReply = "我把这段经历整理成了手记，可以预览后再保存。";
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>()
    .mockImplementationOnce(async () => questionReply)
    .mockImplementationOnce(async payload => ({ ...generated(payload, "晚饭后，我走到河边。凉风吹来时，工作带来的紧绷慢慢松了下来。"), message: readyReply }));
  await mountChat(request);
  fireEvent.press(screen.getByRole("button", { name: "带我写一次日记" }));
  const starter = "我想写一篇今天的日记，请从一个简单的问题开始，带我慢慢记录。";
  expect(composerDraft()).toBe(starter);
  expect(screen.getByRole("button", { name: "重新选择" })).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(questionReply.message);
  expect(request.mock.calls[0]![0]).toMatchObject({ mode: "journal-draft", question: starter, journalDraft: { operation: "new", stage: "interview", body: "" } });
  expect(screen.queryByRole("button", { name: "预览/保存手记" })).toBeNull();
  expect(composerDraft()).toBe("");
  expect(create).not.toHaveBeenCalled();
  send("晚饭后我去河边散步，凉风让工作后的紧张舒缓了。可以生成了。");
  await screen.findByText(readyReply);
  expect(request.mock.calls[1]![0]).toMatchObject({ mode: "journal-draft", journalDraft: { stage: "interview", body: "" }, history: [expect.objectContaining({ role: "user", content: starter }), expect.objectContaining({ role: "assistant" })] });
  expect(screen.queryByText("晚饭后，我走到河边。凉风吹来时，工作带来的紧绷慢慢松了下来。")).toBeNull();
  const previewButton = screen.getByRole("button", { name: "预览/保存手记" });
  let responseBlock = previewButton.parent!;
  while (responseBlock.parent && !within(responseBlock).queryByText(readyReply)) responseBlock = responseBlock.parent;
  expect(within(responseBlock).getByText(readyReply)).toBeTruthy();
  expect(within(responseBlock).queryByText(questionReply.message)).toBeNull();
  expect(create).not.toHaveBeenCalled();
  fireEvent.press(previewButton);
  expect(screen.getByLabelText("手记正文")).toHaveProp("value", "晚饭后，我走到河边。凉风吹来时，工作带来的紧绷慢慢松了下来。");
  fireEvent.press(screen.getByRole("button", { name: "确认保存至我的手记" }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
});

test("each generated reply previews its own version and an earlier version can only be saved as a new journal", async () => {
  const service = mockAccess.service!;
  const original = await service.createRecord({ title: "合成版本手记", occurredAt: "2026-10-13", body: "正式原正文" });
  const update = jest.spyOn(service, "updateRecord");
  let version = 0;
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async payload => {
    version += 1;
    return { ...generated(payload, `合成第${version}版正文`), message: `已整理第${version}版，可预览后保存。` };
  });
  await mountChat(request);
  allowContext();
  await optimizeJournal(original.title);
  send("请优化表达");
  await screen.findByText("已整理第1版，可预览后保存。");
  send("再简洁一些");
  await screen.findByText("已整理第2版，可预览后保存。");
  fireEvent.press(screen.getAllByRole("button", { name: "预览/保存手记" })[0]!);
  expect(screen.getByText("合成第1版正文")).toBeTruthy();
  expect(screen.queryByText("合成第2版正文")).toBeNull();
  expect(screen.queryByLabelText("手记正文")).toBeNull();
  expect(screen.queryByRole("button", { name: "确认保存至我的手记" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "另存为新手记" }));
  expect(screen.getByLabelText("手记正文")).toHaveProp("value", "合成第1版正文");
  fireEvent.press(screen.getByRole("button", { name: "确认保存至我的手记" }));
  await waitFor(async () => expect(await service.listRecords()).toHaveLength(2));
  expect((await service.loadRecord(original.id))?.record.body).toBe("正式原正文");
  expect(update).not.toHaveBeenCalled();
});

test("journal optimization asks before sending, cancel sends nothing, and original plus additions change only on confirmed save", async () => {
  const service = mockAccess.service!;
  const original = await service.createRecord({ title: "合成原手记", occurredAt: "2026-10-13", body: "需要保留的原正文" });
  await service.addEntry(original.id, { kind: "insight", occurredAt: "2026-10-14", body: "需要保留的补充" });
  const update = jest.spyOn(service, "updateRecord");
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async payload => generated(payload, "仅优化原正文的合成结果"));
  await mountChat(request);
  await optimizeJournal(original.title);
  send("请优化这篇手记的表达");
  expect(screen.getByText(journalPermission)).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "取消" }));
  expect(request).not.toHaveBeenCalled();
  expect(composerDraft()).toBe("请优化这篇手记的表达");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  await screen.findByText(reply.message);
  expect(request.mock.calls[0]?.[0]).toMatchObject({ mode: "journal-draft", contextConsent: true, journalDraft: { operation: "edit", title: original.title, occurredAt: original.occurredAt, body: original.body } });
  expect(request.mock.calls[0]?.[0].records[0]?.text).toContain("需要保留的补充");
  expect((await service.loadRecord(original.id))?.record.body).toBe(original.body);
  expect(update).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "预览/保存手记" }));
  expect(screen.getByLabelText("手记正文")).toHaveProp("value", "仅优化原正文的合成结果");
  fireEvent.press(screen.getByRole("button", { name: "确认保存至我的手记" }));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  const saved = await service.loadRecord(original.id);
  expect(saved?.record).toMatchObject({ title: original.title, occurredAt: original.occurredAt, body: "仅优化原正文的合成结果" });
  expect(saved?.entries.map(entry => entry.body)).toEqual(["需要保留的补充"]);
});

test("a new conversation clears selected journal attachments and ignores a late generated draft", async () => {
  const service = mockAccess.service!;
  let resolve!: (response: AssistantResponse) => void;
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(() => new Promise(value => { resolve = value; }));
  await mountChat(request);
  await newJournalDraft();
  send("请生成一篇稍后才返回的合成手记");
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const payload = request.mock.calls[0]![0];
  const signal = request.mock.calls[0]![1];
  fireEvent.press(screen.getByRole("button", { name: "新对话" }));
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(generated(payload, "不应采用的迟到正文")));
  expect(screen.queryByText(reply.message)).toBeNull();
  expect(screen.queryByRole("button", { name: "预览/保存手记" })).toBeNull();
  expect(screen.queryByRole("button", { name: "重新选择" })).toBeNull();
  expect(composerDraft()).toBe("");
  expect(await service.listRecords()).toEqual([]);
});

test("revoking access aborts an edit generation and cannot adopt its late result", async () => {
  const service = mockAccess.service!;
  const original = await service.createRecord({ title: "合成待优化手记", occurredAt: "2026-10-13", body: "撤回后保留的原正文" });
  const update = jest.spyOn(service, "updateRecord");
  let resolve!: (response: AssistantResponse) => void;
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(() => new Promise(value => { resolve = value; }));
  await mountChat(request);
  allowContext();
  await optimizeJournal(original.title);
  send("优化原手记");
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const [payload, signal] = request.mock.calls[0]!;
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: true }));
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(generated(payload, "撤回后不应采用的正文")));
  expect(screen.queryByRole("button", { name: "预览/保存手记" })).toBeNull();
  expect((await service.loadRecord(original.id))?.record.body).toBe(original.body);
  expect(update).not.toHaveBeenCalled();
  expect(screen.queryByText(reply.message)).toBeNull();
});

test("review memory reuses period review and only appends a confirmed follow-up to the selected journal", async () => {
  const service = mockAccess.service!;
  const original = await service.createRecord({ title: "合成回顾手记", occurredAt: "2026-09-01", body: "当时我遇到困难，尝试先停下来。" });
  const oldEntry = await service.addEntry(original.id, { kind: "insight", occurredAt: "2026-09-02", body: "之前已记录的后续" });
  const other = await service.createRecord({ title: "不选的合成手记", occurredAt: "2026-10-01", body: "未选择不得发送的正文" });
  const create = jest.spyOn(service, "createRecord"), update = jest.spyOn(service, "updateRecord"), add = jest.spyOn(service, "addEntry");
  const summary = "后来，我开始先说出自己需要暂停。这样做让我更容易整理思绪，下次也想继续留意自己的节奏。";
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => ({ ...reply, summary }));
  await mountChat(request);
  const userQuestion = "后来我开始先说需要暂停，更容易整理思绪，下次还想留意自己的节奏。请记录这个后续。";
  fireEvent.changeText(screen.getByLabelText("聊天消息"), userQuestion);
  await openJournal();
  fireEvent.press(screen.getByRole("checkbox", { name: `选择手记：${original.title}` }));
  fireEvent.press(screen.getByRole("button", { name: "回顾记忆" }));
  await screen.findByRole("button", { name: "重新选择" });
  expect(composerDraft()).toBe(userQuestion);
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.getByText(journalPermission)).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "取消" }));
  expect(add).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  const preview = await screen.findByRole("button", { name: "预览/保存手记" });
  const payload = request.mock.calls[0]![0];
  expect(payload.mode).toBe("review");
  expect(payload.records[0]).toMatchObject({ id: original.id });
  expect(payload.records[0]!.text).toContain(oldEntry.body);
  expect(JSON.stringify(payload)).not.toContain(other.body);
  expect(JSON.stringify(payload)).toContain("什么有帮助，什么没有帮助？");
  expect(screen.queryByText(summary)).toBeNull();
  expect(add).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
  fireEvent.press(preview);
  expect(screen.getByText("手记回顾后续预览")).toBeTruthy();
  expect(screen.getByLabelText("手记正文")).toHaveProp("value", summary);
  fireEvent.press(screen.getByRole("button", { name: "确认保存为后续" }));
  await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  const saved = await service.loadRecord(original.id);
  expect(saved?.record).toEqual(original);
  expect(saved?.entries.map(entry => entry.body)).toEqual([oldEntry.body, summary]);
  expect(saved?.entries[1]).toMatchObject({ kind: "insight", recordId: original.id });
  expect(create).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test("review questions cannot be saved as follow-ups and recent answers remain available to the next review request", async () => {
  const service = mockAccess.service!;
  const original = await service.createRecord({ title: "合成待回顾", occurredAt: "2026-09-01", body: "当时的合成经历" });
  const followQuestion = "后来有什么做法帮助了你？";
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>()
    .mockResolvedValueOnce(reply)
    .mockResolvedValueOnce({ ...reply, message: followQuestion })
    .mockResolvedValueOnce({ ...reply, summary: "后来，我试着放慢脚步，更容易察觉自己的感受。" });
  await mountChat(request);
  send("与本次回顾无关的上一段聊天合成文字");
  await screen.findByText(reply.message);
  allowContext();
  await openJournal();
  fireEvent.press(screen.getByRole("checkbox", { name: `选择手记：${original.title}` }));
  fireEvent.press(screen.getByRole("button", { name: "回顾记忆" }));
  await screen.findByRole("button", { name: "重新选择" });
  expect(composerDraft()).toBe("我想回顾这篇手记之后的变化，请先问我一个简单的问题，帮我整理一条后续补充。");
  send("我想回顾这篇手记以来的变化，请先问我一个问题。");
  await screen.findByText(followQuestion);
  expect(screen.queryByRole("button", { name: "预览/保存手记" })).toBeNull();
  send("我试着放慢脚步，更容易觉察自己的感受，请整理后续。");
  await screen.findByRole("button", { name: "预览/保存手记" });
  expect(JSON.stringify(request.mock.calls[2]![0])).toContain(followQuestion);
  expect(JSON.stringify(request.mock.calls[2]![0])).not.toContain("与本次回顾无关的上一段聊天合成文字");
  expect((await service.loadRecord(original.id))?.entries).toEqual([]);
});

test("changing conversation aborts review and cannot attach a late follow-up to either conversation", async () => {
  const service = mockAccess.service!;
  const original = await service.createRecord({ title: "合成迟到回顾", occurredAt: "2026-09-01", body: "原手记保留" });
  let resolve!: (value: AssistantResponse) => void;
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(() => new Promise(value => { resolve = value; }));
  await mountChat(request);
  allowContext();
  await openJournal();
  fireEvent.press(screen.getByRole("checkbox", { name: `选择手记：${original.title}` }));
  fireEvent.press(screen.getByRole("button", { name: "回顾记忆" }));
  await screen.findByRole("button", { name: "重新选择" });
  send("后来有了新的理解，请整理这段后续");
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const signal = request.mock.calls[0]![1];
  fireEvent.press(screen.getByRole("button", { name: "新对话" }));
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ...reply, summary: "迟到的合成后续不得采用" }));
  expect(screen.queryByRole("button", { name: "预览/保存手记" })).toBeNull();
  expect(screen.queryByRole("button", { name: "重新选择" })).toBeNull();
  expect(composerDraft()).toBe("");
  expect((await service.loadRecord(original.id))?.entries).toEqual([]);
});
