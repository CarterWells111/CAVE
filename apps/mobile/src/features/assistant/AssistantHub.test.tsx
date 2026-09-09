import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { AssistantRequest, AssistantResponse } from "@cave/contracts";
import { AssistantChat } from "./assistant-chat";
import { AssistantHub } from "./AssistantHub";
const mockPush = jest.fn();
let mockAdult = "authorized";
let mockAccountId: string | undefined = "one";
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({ useAdultDeclaration: () => ({ status: mockAdult }) }));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => ({ accountId: mockAccountId }) }));
const response: AssistantResponse = { status: "ok", providerMode: "mock", message: "我们可以从今天的一件小事开始。", observations: [], sources: [] };
beforeEach(() => { jest.clearAllMocks(); mockAdult = "authorized"; mockAccountId = "one"; delete process.env.EXPO_PUBLIC_ASSISTANT_MODE; });
function prepare() {
  fireEvent.press(screen.getByRole("button", { name: "带我写一次日记" }));
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
}
test("starter fills editable draft, cancellation preserves it, only explicit consent sends", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  prepare();
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByText("允许将这些内容发送云端吗？")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "取消，继续编辑" }));
  expect(screen.getByLabelText("聊天消息").props.value).toContain("我想写一篇今天的日记");
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "今天去散步了");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "允许并发送" }));
  expect(await screen.findByText(response.message)).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith({ mode: "chat", consent: true, records: [], question: "今天去散步了", history: [], journeyId: "first-overnight" }, expect.anything());
  expect(screen.getByLabelText("聊天消息").props.value).toBe("");
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "第二条消息");
  expect(screen.getByText(response.message)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(request).toHaveBeenCalledTimes(1);
});
test("journey starter previews exact journey resource without journal records", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  fireEvent.press(screen.getByRole("button", { name: "为我讲解一个旅程内容" }));
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.getByText(/旅程资源：第一次过夜/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "允许并发送" }));
  await screen.findByText(response.message);
  expect(request.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ mode: "chat", journeyId: "first-overnight", records: [] }));
});
test("failure preserves draft and retry needs fresh consent", async () => {
  const request = jest.fn(async () => { throw new Error("private failure"); });
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  prepare(); fireEvent.press(screen.getByRole("button", { name: "允许并发送" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("聊天消息").props.value).not.toBe("");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByText("允许将这些内容发送云端吗？")).toBeTruthy();
});
test("stop aborts request and ignores late response", async () => {
  let resolve!: (value: AssistantResponse) => void;
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(() => new Promise<AssistantResponse>(r => { resolve = r; }));
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  prepare(); fireEvent.press(screen.getByRole("button", { name: "允许并发送" }));
  fireEvent.press(screen.getByRole("button", { name: "停止等待" }));
  expect(request.mock.calls[0]?.[1].aborted).toBe(true);
  await act(async () => resolve(response));
  expect(screen.queryByText(response.message)).toBeNull();
  expect(screen.getByLabelText("聊天消息").props.value).not.toBe("");
});
test("adult gate and login gate prevent cloud consent", () => {
  mockAdult = "public";
  const view = render(<AssistantHub />);
  prepare();
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/journey/adult-gate", params: { entry: "ai" } });
  mockAdult = "authorized"; mockAccountId = undefined;
  view.rerender(<AssistantHub />); prepare();
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/auth/email", params: { returnTo: "/(tabs)/ai" } });
  expect(screen.queryByText("允许将这些内容发送云端吗？")).toBeNull();
});
test("account changes clear draft and pending consent", () => {
  const view = render(<AssistantHub />); prepare();
  mockAccountId = "two"; view.rerender(<AssistantHub />);
  expect(screen.getByLabelText("聊天消息").props.value).toBe("");
  expect(screen.queryByText("允许将这些内容发送云端吗？")).toBeNull();
});

test("editing a preview revokes consent and blank messages cannot send", () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "   ");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.queryByText("允许将这些内容发送云端吗？")).toBeNull();
  prepare();
  fireEvent.changeText(screen.getByLabelText("聊天消息", { includeHiddenElements: true }), "改过的文字");
  expect(screen.queryByText("允许将这些内容发送云端吗？")).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

test("mock mode names the local simulation explicitly", async () => {
  process.env.EXPO_PUBLIC_ASSISTANT_MODE = "mock";
  render(<AssistantChat authorized journeyId="first-overnight" />);
  prepare();
  expect(screen.queryByText("允许将这些内容发送云端吗？")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "确认运行本机模拟" }));
  expect(await screen.findByText("内界 AI · 模拟回复")).toBeTruthy();
});

test("conversation context is previewed and can be omitted before sending", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  prepare(); fireEvent.press(screen.getByRole("button", { name: "允许并发送" }));
  await screen.findByText(response.message);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "然后呢？");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.getByText("最近对话：2 条")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "这次仅发送本条消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许并发送" }));
  await act(async () => undefined);
  expect(request.mock.calls[1]?.[0]).toMatchObject({ mode: "chat", question: "然后呢？", history: [] });
});

test("help me approve is opt-in and still pauses for personal content", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "你好");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "帮我批准" }));
  await screen.findByText(response.message);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "谢谢");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await act(async () => undefined);
  expect(request).toHaveBeenCalledTimes(2);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "我的邮箱是 test@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByText("这次内容可能涉及个人信息，需要你亲自确认后再发送。")).toBeTruthy();
});

test("composer approval switch toggles without sending and restores confirmation", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "你好");
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: false }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
  expect(screen.queryByText("普通聊天已自动批准 · 点击关闭")).toBeNull();
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准" }));
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "允许并发送" })).toBeTruthy();
});

test("enabling automatic approval never sends the current private draft", async () => {
  const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
  render(<AssistantChat authorized journeyId="first-overnight" request={request} />);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "我的邮箱是 test@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "帮我批准" }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "允许并发送" })).toBeTruthy();
});
