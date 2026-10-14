import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import type { AssistantRequest, AssistantResponse } from "@cave/contracts";

import { AssistantChat } from "./assistant-chat";
import { AssistantComposerInput } from "./AssistantComposerInput";
import { AssistantHub } from "./AssistantHub";
import { collectAssistantQuestionContext, type AssistantQuestionContext } from "./assistant-question-context";

const mockPush = jest.fn();
let mockAdult = "authorized";
let mockAccountId: string | undefined = "one";
let mockConversationId = 0;
const mockJournalService = { listRecords: jest.fn(), loadRecord: jest.fn() };
let mockJournalAccess: { status: string; service?: typeof mockJournalService } | null = null;
jest.mock("expo-crypto", () => ({ randomUUID: () => `conversation-${++mockConversationId}` }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({ useAdultDeclaration: () => ({ status: mockAdult }), useOptionalJourneyRuntime: () => null }));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => ({ accountId: mockAccountId }) }));
jest.mock("../journal/runtime/JournalAccessProvider", () => ({ useOptionalJournalAccess: () => mockJournalAccess }));
jest.mock("./assistant-question-context", () => ({ collectAssistantQuestionContext: jest.fn(async () => ({ records: [] })) }));

const response: AssistantResponse = { status: "ok", providerMode: "mock", message: "我们可以从今天的一件小事开始。", observations: [], sources: [] };
const accessPrompt = "允许在本次使用期间访问问题涉及的日记和旅程内容吗？";
const mockCollect = jest.mocked(collectAssistantQuestionContext);

beforeEach(() => {
  jest.clearAllMocks();
  mockAdult = "authorized";
  mockAccountId = "one";
  mockConversationId = 0;
  mockJournalAccess = null;
  mockJournalService.listRecords.mockReset();
  mockJournalService.loadRecord.mockReset();
  mockCollect.mockReset().mockResolvedValue({ records: [] });
  delete process.env.EXPO_PUBLIC_ASSISTANT_MODE;
});

function expectTwoChoiceDialog(prompt: string) {
  let dialog = screen.getByText(prompt);
  while (dialog.parent && !dialog.props.accessibilityViewIsModal) dialog = dialog.parent;
  expect(within(dialog).getAllByRole("button").map(button => button.props.accessibilityLabel).sort()).toEqual(["允许", "取消"]);
}

function sendStarter() {
  fireEvent.press(screen.getByRole("button", { name: "帮我理清此刻的感受" }));
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
}

function enableContextAccess() {
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: false }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
}

test("report handoff remains editable and sends only after pressing send", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="pause" initialDraft="共同报告。还有哪些不确定的地方？" request={request} />);
  expect(composerDraft()).toBe("共同报告。还有哪些不确定的地方？");
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(await screen.findByText(response.message)).toBeTruthy();
  expect(request).toHaveBeenCalledWith({ mode: "chat", consent: true, records: [], question: "共同报告。还有哪些不确定的地方？", history: [] }, expect.anything());
  expect(mockCollect).not.toHaveBeenCalled();
});

test("ordinary chat sends immediately with recent turns, without diary or journey access", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  fireEvent.press(screen.getByRole("button", { name: "帮我理清此刻的感受" }));
  expect(composerDraft()).toContain("我想整理一下此刻的感受");
  expect(request).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "今天去散步了");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  expect(screen.queryByRole("button", { name: "允许" })).toBeNull();
  expect(request).toHaveBeenCalledWith({ mode: "chat", consent: true, records: [], question: "今天去散步了", history: [] }, expect.anything());
  expect(composerDraft()).toBe("");
  expect(screen.queryByRole("button", { name: "帮我理清此刻的感受" })).toBeNull();
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "然后呢？");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await act(async () => undefined);
  expect(request.mock.calls[1]?.[0]).toEqual({ mode: "chat", consent: true, records: [], question: "然后呢？", history: [{ role: "user", content: "今天去散步了" }, { role: "assistant", content: response.message }] });
  expect(mockCollect).not.toHaveBeenCalled();
});

test("journey suggestion cannot attach journey content before context access is allowed", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  fireEvent.press(screen.getByRole("button", { name: "为我讲解一个旅程内容" }));
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  expect(request.mock.calls[0]?.[0]).not.toHaveProperty("journeyId");
  expect(request.mock.calls[0]?.[0]).toMatchObject({ mode: "chat", records: [] });
  expect(mockCollect).not.toHaveBeenCalled();
});

test("failure preserves the draft and pressing send retries without another confirmation", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>()
    .mockRejectedValueOnce(new Error("private failure"))
    .mockResolvedValueOnce(response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  sendStarter();
  await screen.findByRole("alert");
  const question = composerDraft();
  expect(question).not.toBe("");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1]?.[0].question).toBe(question);
  expect(screen.queryByRole("button", { name: "允许" })).toBeNull();
});

test("stop aborts the request and ignores its late response", async () => {
  let resolve!: (value: AssistantResponse) => void;
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(() => new Promise(r => { resolve = r; }));
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  sendStarter();
  fireEvent.press(screen.getByRole("button", { name: "停止等待" }));
  expect(request.mock.calls[0]?.[1].aborted).toBe(true);
  await act(async () => resolve(response));
  expect(screen.queryByText(response.message)).toBeNull();
  expect(composerDraft()).not.toBe("");
});

test("adult and login gates prevent sending", () => {
  mockAdult = "public";
  const view = render(<AssistantHub />);
  sendStarter();
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/journey/adult-gate", params: { entry: "ai" } });
  mockAdult = "authorized"; mockAccountId = undefined;
  view.rerender(<AssistantHub />);
  sendStarter();
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/auth/email", params: { returnTo: "/(tabs)/ai" } });
  expect(mockCollect).not.toHaveBeenCalled();
});

test("account changes clear the old draft and pending access confirmation", () => {
  const view = render(<AssistantHub />);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "账号一的草稿");
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准" }));
  expectTwoChoiceDialog(accessPrompt);
  mockAccountId = "two";
  view.rerender(<AssistantHub />);
  expect(composerDraft()).toBe("");
  expect(screen.queryByText(accessPrompt)).toBeNull();
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
});

test("blank messages cannot send", () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "   ");
  expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(request).not.toHaveBeenCalled();
  expect(mockCollect).not.toHaveBeenCalled();
});

test("preview mode immediately simulates a reply without a confirmation", async () => {
  process.env.EXPO_PUBLIC_ASSISTANT_MODE = "mock";
  render(<AssistantChat authorized journeyId="first-overnight" />);
  sendStarter();
  expect(await screen.findByText("内界 AI · 模拟回复")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "允许" })).toBeNull();
  expect(screen.queryByRole("switch", { name: "帮我批准" })).toBeNull();
  expect(mockCollect).not.toHaveBeenCalled();
});

test("context access uses one sentence and cancel leaves both access and draft unchanged", () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" initialDraft="你好" request={request} />);
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: false }));
  expectTwoChoiceDialog(accessPrompt);
  fireEvent.press(screen.getByRole("button", { name: "取消" }));
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
  expect(composerDraft()).toBe("你好");
  expect(request).not.toHaveBeenCalled();
  expect(mockCollect).not.toHaveBeenCalled();
});

test("allowing context access does not send the current draft or create another send dialog", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" initialDraft="我的邮箱是 test@example.com" request={request} />);
  enableContextAccess();
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  expect(mockCollect).not.toHaveBeenCalled();
  expect(composerDraft()).toBe("我的邮箱是 test@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  expect(request).toHaveBeenCalledTimes(1);
  expect(mockCollect).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "允许" })).toBeNull();
});

test("turning context access off is immediate and ordinary chat still sends directly", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" initialDraft="你好" request={request} />);
  enableContextAccess();
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: true }));
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
  expect(screen.queryByText(accessPrompt)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  expect(request).toHaveBeenCalledTimes(1);
  expect(mockCollect).not.toHaveBeenCalled();
});

test("header new conversation appears before history and starts fresh without sending", () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="pause" initialDraft="旧草稿" request={request} />);
  const buttons = screen.getAllByRole("button").map(button => button.props.accessibilityLabel);
  expect(buttons.indexOf("新对话")).toBeLessThan(buttons.indexOf("对话历史"));
  expect(buttons.indexOf("对话历史")).toBeLessThan(buttons.indexOf("内界 AI，帮助"));
  const newConversation = screen.getByRole("button", { name: "新对话" });
  expect(within(newConversation).queryByText("新对话")).toBeNull();
  fireEvent.press(newConversation);
  expect(composerDraft()).toBe("");
  expect(mockPush).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});

test("help explains question-related access and preserves the editable draft", () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" initialDraft="留下这句话" request={request} />);
  fireEvent.press(screen.getByRole("button", { name: "内界 AI，帮助" }));
  expect(screen.getByText(/点选建议后会填入输入框/)).toBeTruthy();
  expect(screen.getByText(/开启「帮我批准」后.*日记和旅程/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "关闭内界 AI · 帮助" }));
  expect(composerDraft()).toBe("留下这句话");
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});

test("allowed access attaches only the helper's selected diary and journey context with explicit context consent", async () => {
  const records = [{ id: "synthetic-diary", text: "合成日记正文和补充" }];
  mockJournalAccess = { status: "ready", service: mockJournalService };
  mockCollect.mockResolvedValue({ records, journeyId: "pause" });
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="pause" initialDraft="请解释旅程和今天的日记" request={request} />);
  enableContextAccess();
  expect(mockCollect).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  expect(mockCollect).toHaveBeenCalledWith({ question: "请解释旅程和今天的日记", journeyId: "pause", journal: mockJournalService, signal: expect.anything() });
  expect(request).toHaveBeenCalledWith({ mode: "chat", consent: true, contextConsent: true, records, journeyId: "pause", question: "请解释旅程和今天的日记", history: [] }, expect.anything());
});

test("a context read failure preserves the draft and never uploads the question", async () => {
  mockCollect.mockRejectedValueOnce(new Error("synthetic read failure"));
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="pause" initialDraft="回顾今天的日记" request={request} />);
  enableContextAccess();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(await screen.findByText("暂时无法读取相关资料，消息未发送，草稿已保留。")).toBeTruthy();
  expect(composerDraft()).toBe("回顾今天的日记");
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: true }));
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  expect(mockCollect).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]?.[0]).toMatchObject({ records: [], question: "回顾今天的日记" });
});

test("revoking access aborts retrieval and blocks late private context even after sending an ordinary message", async () => {
  let resolve!: (context: AssistantQuestionContext) => void;
  mockCollect.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="pause" initialDraft="回顾我的日记" request={request} />);
  enableContextAccess();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(mockCollect).toHaveBeenCalledTimes(1);
  expect(request).not.toHaveBeenCalled();
  const contextSignal = mockCollect.mock.calls[0]?.[0].signal;
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: true }));
  expect(contextSignal?.aborted).toBe(true);
  expect(composerDraft()).toBe("回顾我的日记");
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "现在只聊一句普通消息");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  await act(async () => resolve({ records: [{ id: "late-synthetic-diary", text: "不应被发送的迟到资料" }], journeyId: "pause" }));
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]?.[0]).toEqual({ mode: "chat", consent: true, records: [], question: "现在只聊一句普通消息", history: [] });
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
  expect(screen.queryByText("不应被发送的迟到资料")).toBeNull();
});

test("starting another conversation aborts pending retrieval while retaining the session access choice", async () => {
  let resolve!: (context: AssistantQuestionContext) => void;
  mockCollect.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="pause" initialDraft="回顾我的日记" request={request} />);
  enableContextAccess();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  const contextSignal = mockCollect.mock.calls[0]?.[0].signal;
  fireEvent.press(screen.getByRole("button", { name: "新对话" }));
  expect(contextSignal?.aborted).toBe(true);
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
  expect(composerDraft()).toBe("");
  await act(async () => resolve({ records: [{ id: "late-synthetic-diary", text: "迟到资料" }] }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.queryByText("内界 AI · 正在思考…")).toBeNull();
});

test.each(["loading", "error"] as const)("unavailable real journal (%s) preserves a diary question without uploading and can retry after ready", async status => {
  const realCollect = jest.requireActual<typeof import("./assistant-question-context")>("./assistant-question-context").collectAssistantQuestionContext;
  mockCollect.mockImplementationOnce(realCollect);
  mockJournalAccess = { status };
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  const view = render(<AssistantChat authorized journeyId="pause" initialDraft="回顾今天的日记" request={request} />);
  enableContextAccess();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(await screen.findByText("暂时无法读取相关资料，消息未发送，草稿已保留。")).toBeTruthy();
  expect(composerDraft()).toBe("回顾今天的日记");
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  mockJournalService.listRecords.mockResolvedValue([]);
  mockJournalAccess = { status: "ready", service: mockJournalService };
  mockCollect.mockImplementationOnce(realCollect);
  view.rerender(<AssistantChat authorized journeyId="pause" initialDraft="回顾今天的日记" request={request} />);
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  expect(mockJournalService.listRecords).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]?.[0].question).toBe("回顾今天的日记");
});

test.each(["loading", "error"] as const)("a new-journal writing question still sends while the real journal is %s because it does not read existing records", async status => {
  const realCollect = jest.requireActual<typeof import("./assistant-question-context")>("./assistant-question-context").collectAssistantQuestionContext;
  mockCollect.mockImplementationOnce(realCollect);
  mockJournalAccess = { status };
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="pause" initialDraft="我想写一篇今天的日记，请从一个简单的问题开始，带我慢慢记录。" request={request} />);
  enableContextAccess();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await screen.findByText(response.message);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]?.[0]).toMatchObject({ records: [], question: "我想写一篇今天的日记，请从一个简单的问题开始，带我慢慢记录。" });
  expect(request.mock.calls[0]?.[0]).not.toHaveProperty("contextConsent");
  expect(screen.queryByRole("alert")).toBeNull();
});

function composerDraft() { return screen.UNSAFE_getByType(AssistantComposerInput).props.initialValue as string; }
