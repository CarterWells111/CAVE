import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { AssistantRequest, AssistantResponse } from "@cave/contracts";
import { useState } from "react";
import { View } from "react-native";

import AssistantHistoryRoute from "../../../app/assistant-history";

import { AssistantHub } from "./AssistantHub";
import { AssistantChat } from "./assistant-chat";
import { AssistantComposerInput } from "./AssistantComposerInput";
import { AssistantHistoryProvider } from "./AssistantHistoryProvider";
import type { AssistantConversation } from "./history/assistant-history-repository";
import { InMemoryAssistantHistoryRepository } from "./history/in-memory-assistant-history-repository";

let mockAccountId = "account-one";
let mockHistoryRepository: InMemoryAssistantHistoryRepository;
let mockConversationId = 0;
let mockSetHistoryOpen: (visible: boolean) => void = () => undefined;
const mockPush = jest.fn((destination: unknown) => {
  if (destination === "/assistant-history") mockSetHistoryOpen(true);
});
const mockBack = jest.fn(() => mockSetHistoryOpen(false));
const mockReplace = jest.fn(() => mockSetHistoryOpen(false));
jest.mock("expo-crypto", () => ({ randomUUID: () => `conversation-${++mockConversationId}` }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: mockBack, canGoBack: () => true, replace: mockReplace }) }));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => ({ accountId: mockAccountId }) }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useAdultDeclaration: () => ({ status: "authorized" }),
  useOptionalJourneyRuntime: () => ({ assistantHistory: mockHistoryRepository }),
}));

const reply = (message: string): AssistantResponse => ({ status: "ok", providerMode: "mock", message, observations: [], sources: [] });
const conversation = (id: string, question: string, message: string, journeyId = "first-overnight"): AssistantConversation => ({
  id,
  title: question,
  journeyId,
  createdAt: "2026-10-14T10:00:00.000Z",
  updatedAt: "2026-10-14T10:00:00.000Z",
  turns: [{ question, response: reply(message) }],
  draft: "",
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountId = "account-one";
  mockConversationId = 0;
  mockSetHistoryOpen = () => undefined;
  mockHistoryRepository = new InMemoryAssistantHistoryRepository();
  delete process.env.EXPO_PUBLIC_ASSISTANT_MODE;
});

async function seed(items: AssistantConversation[], owner = mockAccountId) {
  // Saving inserts at the beginning, so reverse to preserve the requested order.
  for (const item of [...items].reverse()) await mockHistoryRepository.save(owner, item);
}

function HistoryHarness({ request, hub = false }: {
  request?: (payload: AssistantRequest, signal: AbortSignal) => Promise<AssistantResponse>;
  hub?: boolean;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  mockSetHistoryOpen = setHistoryOpen;
  return <AssistantHistoryProvider>
    <View accessibilityElementsHidden={historyOpen} importantForAccessibility={historyOpen ? "no-hide-descendants" : "auto"}>
      {hub ? <AssistantHub /> : <AssistantChat authorized journeyId="first-overnight" {...(request ? { request } : {})} />}
    </View>
    {historyOpen ? <AssistantHistoryRoute /> : null}
  </AssistantHistoryProvider>;
}

function openHistory() {
  fireEvent.press(screen.getByRole("button", { name: "对话历史" }));
  expect(mockPush).toHaveBeenLastCalledWith("/assistant-history");
  expect(screen.getByRole("header", { name: "对话历史" })).toBeTruthy();
  expect(screen.queryByLabelText("聊天消息")).toBeNull();
}

async function sendMessage(question: string, expectedReply: string) {
  fireEvent.changeText(screen.getByLabelText("聊天消息"), question);
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(expectedReply);
}

function historyTitles() {
  return screen.getAllByRole("button", { name: /^打开对话：/ }).map(item => item.props.accessibilityLabel);
}

test("clearing account history aborts a waiting reply and cannot restore deleted content", async () => {
  let resolve!: (value: AssistantResponse) => void;
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(() => new Promise(value => { resolve = value; }));
  await seed([conversation("old", "先前的问题", "先前的回复")]);
  render(<HistoryHarness request={request} />);
  openHistory();
  fireEvent.press(await screen.findByRole("button", { name: "打开对话：先前的问题" }));
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "接着说说");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await act(async () => { await mockHistoryRepository.clearOwner(mockAccountId); });
  expect(request.mock.calls[0]?.[1].aborted).toBe(true);
  expect(composerDraft()).toBe("");
  expect(screen.queryByText("先前的回复")).toBeNull();
  await act(async () => { resolve(reply("迟到的回复")); });
  expect(screen.queryByText("迟到的回复")).toBeNull();
  expect(await mockHistoryRepository.list(mockAccountId)).toEqual([]);
});

test("account cleanup also removes a save that was already waiting to complete", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const save = mockHistoryRepository.save.bind(mockHistoryRepository);
  const pendingSave = jest.spyOn(mockHistoryRepository, "save").mockImplementationOnce(async (owner, item) => {
    await gate;
    await save(owner, item);
  });
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => reply("刚收到的回复"));
  render(<HistoryHarness request={request} />);
  await sendMessage("正在保存的对话", "刚收到的回复");
  await waitFor(() => expect(pendingSave).toHaveBeenCalledTimes(1));
  await act(async () => { await mockHistoryRepository.clearOwner(mockAccountId); });
  await act(async () => { release(); });
  await waitFor(async () => expect(await mockHistoryRepository.list(mockAccountId)).toEqual([]));
  expect(screen.queryByText("刚收到的回复")).toBeNull();
});

test("clock opens the empty history and a new conversation does not send anything", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => reply("空态不应请求"));
  render(<HistoryHarness request={request} />);
  openHistory();
  expect(await screen.findByText("还没有对话历史")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "新对话" }));
  expect(composerDraft()).toBe("");
  expect(screen.queryByText("还没有对话历史")).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

test("new conversations omit earlier context and remain separate in history", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async payload => reply(`${payload.question}的回复`));
  render(<HistoryHarness request={request} />);
  await sendMessage("第一段对话", "第一段对话的回复");
  openHistory();
  fireEvent.press(screen.getByRole("button", { name: "新对话" }));
  expect(screen.queryByText("第一段对话的回复")).toBeNull();
  await sendMessage("第二段对话", "第二段对话的回复");
  expect(request.mock.calls[1]?.[0]).toMatchObject({ question: "第二段对话", history: [] });
  openHistory();
  expect(historyTitles()).toEqual(["打开对话：第二段对话", "打开对话：第一段对话"]);
  await waitFor(async () => expect(await mockHistoryRepository.list(mockAccountId)).toHaveLength(2));
});

test("opening an old conversation restores its turns without granting journey access", async () => {
  await seed([conversation("old", "旧旅程的问题", "旧旅程的回答", "pause")]);
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => reply("接着旧旅程聊"));
  render(<HistoryHarness request={request} />);
  openHistory();
  fireEvent.press(await screen.findByRole("button", { name: "打开对话：旧旅程的问题" }));
  expect(screen.getByText("旧旅程的问题")).toBeTruthy();
  expect(screen.getByText("旧旅程的回答")).toBeTruthy();
  await sendMessage("继续之前的话题", "接着旧旅程聊");
  expect(request.mock.calls[0]?.[0]).not.toHaveProperty("journeyId");
  expect(request.mock.calls[0]?.[0]).toMatchObject({
    question: "继续之前的话题",
    history: [{ role: "user", content: "旧旅程的问题" }, { role: "assistant", content: "旧旅程的回答" }],
  });
});

test("long press moves a conversation and its order survives remounting", async () => {
  await seed([conversation("first", "排在前面的对话", "前面的回复"), conversation("second", "排在后面的对话", "后面的回复")]);
  const view = render(<HistoryHarness />);
  openHistory();
  fireEvent(await screen.findByRole("button", { name: "打开对话：排在后面的对话" }), "longPress");
  expect(screen.getByText("当前位置：2 / 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "下移一位" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "上移一位" }));
  await waitFor(() => expect(screen.getByText("当前位置：1 / 2")).toBeTruthy());
  fireEvent.press(screen.getAllByRole("button", { name: "返回对话历史" })[0]!);
  expect(historyTitles()).toEqual(["打开对话：排在后面的对话", "打开对话：排在前面的对话"]);
  view.unmount();
  render(<HistoryHarness />);
  openHistory();
  await screen.findByRole("button", { name: "打开对话：排在后面的对话" });
  expect(historyTitles()).toEqual(["打开对话：排在后面的对话", "打开对话：排在前面的对话"]);
});

test("deleting requires confirmation, can be cancelled, and stays deleted after remount", async () => {
  await seed([conversation("keep", "保留的对话", "保留的回答"), conversation("remove", "要删除的对话", "要删除的回答")]);
  const view = render(<HistoryHarness />);
  openHistory();
  fireEvent(await screen.findByRole("button", { name: "打开对话：要删除的对话" }), "longPress");
  fireEvent.press(screen.getByRole("button", { name: "删除这段对话" }));
  expect(await mockHistoryRepository.list(mockAccountId)).toHaveLength(2);
  fireEvent.press(screen.getByRole("button", { name: "取消删除" }));
  expect(screen.queryByRole("button", { name: "确认删除对话" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "删除这段对话" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除对话" }));
  await screen.findByRole("button", { name: "打开对话：保留的对话" });
  expect(screen.queryByRole("button", { name: "打开对话：要删除的对话" })).toBeNull();
  view.unmount();
  render(<HistoryHarness />);
  openHistory();
  await screen.findByRole("button", { name: "打开对话：保留的对话" });
  expect(screen.queryByRole("button", { name: "打开对话：要删除的对话" })).toBeNull();
});

test("switching conversations aborts an in-flight request and ignores its late response", async () => {
  await seed([conversation("old", "先前的问题", "先前的回答")]);
  let resolve!: (value: AssistantResponse) => void;
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(() => new Promise(value => { resolve = value; }));
  render(<HistoryHarness request={request} />);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "正在等待的问题");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  openHistory();
  fireEvent.press(await screen.findByRole("button", { name: "打开对话：先前的问题" }));
  expect(request.mock.calls[0]?.[1].aborted).toBe(true);
  await act(async () => resolve(reply("已经迟到的回答")));
  expect(screen.getByText("先前的回答")).toBeTruthy();
  expect(screen.queryByText("已经迟到的回答")).toBeNull();
  expect(screen.queryByText("内界 AI · 正在思考…")).toBeNull();
  expect((await mockHistoryRepository.list(mockAccountId))[0]?.turns).toHaveLength(1);
});

test("hub account changes expose only that account's history and clear active content", async () => {
  await seed([conversation("one", "账号一的问题", "账号一的回答")]);
  await seed([conversation("two", "账号二的问题", "账号二的回答")], "account-two");
  const view = render(<HistoryHarness hub />);
  openHistory();
  fireEvent.press(await screen.findByRole("button", { name: "打开对话：账号一的问题" }));
  expect(screen.getByText("账号一的回答")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "账号一的未发送内容");
  mockAccountId = "account-two";
  view.rerender(<HistoryHarness hub />);
  expect(composerDraft()).toBe("");
  expect(screen.queryByText("账号一的回答")).toBeNull();
  openHistory();
  await screen.findByRole("button", { name: "打开对话：账号二的问题" });
  expect(screen.queryByRole("button", { name: "打开对话：账号一的问题" })).toBeNull();
});

test("switching away saves an existing conversation's draft and restores it after remount", async () => {
  await seed([conversation("old", "原来的问题", "原来的回答")]);
  const view = render(<HistoryHarness />);
  openHistory();
  fireEvent.press(await screen.findByRole("button", { name: "打开对话：原来的问题" }));
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "下次接着聊的草稿");
  openHistory();
  fireEvent.press(screen.getByRole("button", { name: "新对话" }));
  expect(composerDraft()).toBe("");
  await waitFor(async () => expect((await mockHistoryRepository.list(mockAccountId))[0]?.draft).toBe("下次接着聊的草稿"));
  view.unmount();
  render(<HistoryHarness />);
  openHistory();
  fireEvent.press(await screen.findByRole("button", { name: "打开对话：原来的问题" }));
  expect(composerDraft()).toBe("下次接着聊的草稿");
});

test("history opens its own route with usage help and returns to the current draft", async () => {
  render(<HistoryHarness />);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "返回后继续编辑");
  openHistory();
  await screen.findByText("还没有对话历史");
  expect(screen.queryByText(/长按可以删除/)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "对话历史，帮助" }));
  expect(screen.getByText(/点击一段对话继续聊天；长按可以删除/)).toBeTruthy();
  expect(screen.getByText(/历史和排序按账号保存在本机/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "关闭对话历史 · 帮助" }));
  fireEvent.press(screen.getByRole("button", { name: "返回聊天" }));
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("header", { name: "对话历史" })).toBeNull();
  expect(composerDraft()).toBe("返回后继续编辑");
});

function composerDraft() { return screen.UNSAFE_getByType(AssistantComposerInput).props.initialValue as string; }

test("a newly completed AI turn persists its own timestamp", async () => {
  const request = jest.fn(async () => reply("已记录这次交流"));
  const before = Date.now();
  render(<HistoryHarness request={request} />);
  await waitFor(() => expect(screen.getByLabelText("聊天消息")).toBeTruthy());
  await sendMessage("今天想慢一点", "已记录这次交流");
  await waitFor(async () => {
    const saved = await mockHistoryRepository.list(mockAccountId);
    expect(saved[0]?.turns[0]?.createdAt).toBeDefined();
  });
  const saved = await mockHistoryRepository.list(mockAccountId);
  const createdAt = saved[0]!.turns[0]!.createdAt!;
  expect(Date.parse(createdAt)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(createdAt)).toBeLessThanOrEqual(Date.now());
});
