import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { View } from "react-native";
import type { AssistantRequest, AssistantResponse } from "@cave/contracts";
import { AssistantChat } from "./assistant-chat";
import { AssistantComposerInput } from "./AssistantComposerInput";
import { collectGrowthReviewContext, GROWTH_REVIEW_INSTRUCTION } from "./growth-review-context";
import { GROWTH_REVIEW_STARTER } from "./growth-review-entry";

let mockAccountId: string | undefined = "growth-owner";
let mockId = 0;
const mockJournal = { listRecords: jest.fn(), loadRecord: jest.fn() };
const mockAiHistory = { list: jest.fn() };
const mockReviewHistory = { listMetadata: jest.fn() };
const mockRoomHistory = { list: jest.fn(), subscribeToOwnerClear: jest.fn<() => void, [string, () => void]>(() => () => undefined) };
jest.mock("expo-crypto", () => ({ randomUUID: () => `growth-conversation-${++mockId}` }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => ({ accountId: mockAccountId }) }));
jest.mock("../journal/runtime/JournalAccessProvider", () => ({
  useOptionalJournalAccess: () => ({ status: "ready", accountId: mockAccountId, service: mockJournal }),
}));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useOptionalJourneyRuntime: () => ({ assistantHistory: mockAiHistory, reviewHistory: mockReviewHistory, roomHistory: mockRoomHistory }),
}));
jest.mock("./growth-review-context", () => ({
  ...jest.requireActual<typeof import("./growth-review-context")>("./growth-review-context"),
  collectGrowthReviewContext: jest.fn(),
}));
const response: AssistantResponse = { status: "ok", providerMode: "mock", message: "这段时间的经历\n\n可能的变化\n\n接下来的建议", observations: [], sources: [] };
const mockCollect = jest.mocked(collectGrowthReviewContext);
const request = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);
const entry = { id: 1, accountId: "growth-owner" };
const permission = "允许 AI 使用所选时间范围内的本账号手记、留存 AI 对话、本机房间活动及本人回答、已可见的共同报告和已完成旅程回顾摘要吗？";

beforeEach(() => {
  jest.clearAllMocks(); mockAccountId = "growth-owner"; mockId = 0;
  delete process.env.EXPO_PUBLIC_ASSISTANT_MODE;
  mockCollect.mockResolvedValue({ records: [{ id: "growth-review-coverage", text: "房间：本次未提供房间历史；仅以下真实资料。" }, { id: "growth-journal-1", text: "合成手记" }],
    period: { startDate: "2026-10-17", endDate: "2026-10-23", label: "最近一周" } });
});
function tree(withEntry = true) {
  return <View><AssistantChat key={mockAccountId ?? "signed-out"} authorized journeyId="pause" request={request} {...(withEntry ? { growthEntry: entry } : {})} /></View>;
}
function composerDraft() { return screen.UNSAFE_getByType(AssistantComposerInput).props.initialValue as string; }

test("growth handoff only pre-fills editable text and reads or sends nothing", () => {
  render(tree());
  expect(composerDraft()).toBe(GROWTH_REVIEW_STARTER);
  expect(screen.queryByText(permission)).toBeNull();
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
  expect(mockCollect).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "查看我最近 10 天的成长，给我建议。");
  expect(composerDraft()).toBe("查看我最近 10 天的成长，给我建议。");
});

test("send asks permission, cancel preserves draft, and approval uses the final editable range", async () => {
  render(tree());
  const edited = "查看我最近 10 天的旅程、房间、手记和AI记录，回顾我的成长。";
  fireEvent.changeText(screen.getByLabelText("聊天消息"), edited);
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.getByText(permission)).toBeTruthy();
  expect(mockCollect).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "取消" }));
  expect(composerDraft()).toBe(edited);
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  await screen.findByText(response.message);
  expect(mockCollect).toHaveBeenCalledWith(expect.objectContaining({ question: edited, ownerAccountId: "growth-owner", journal: mockJournal, assistantHistory: mockAiHistory, reviewHistory: mockReviewHistory, roomHistory: mockRoomHistory }));
  expect(request.mock.calls[0]![0]).toMatchObject({ mode: "chat", question: edited, contextConsent: true, records: expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining("未提供房间历史") })]), history: [{ role: "user", content: GROWTH_REVIEW_INSTRUCTION }] });
});

test("an unrecognized edited range does not silently read a month", () => {
  render(tree());
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "回顾我的成长。");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/请在问题中写明回顾范围/u);
  expect(mockCollect).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});

test("existing journal access does not silently authorize AI history", () => {
  const view = render(tree(false));
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  view.rerender(tree());
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.getByText(permission)).toBeTruthy();
  expect(mockCollect).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});

test("revoking access cancels pending collection and ignores late private context", async () => {
  let release!: (value: Awaited<ReturnType<typeof collectGrowthReviewContext>>) => void;
  mockCollect.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  render(tree());
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  await waitFor(() => expect(mockCollect).toHaveBeenCalledTimes(1));
  const signal = mockCollect.mock.calls[0]![0].signal!;
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: true }));
  expect(signal.aborted).toBe(true);
  await act(async () => release({ records: [{ id: "old-private", text: "旧资料" }], period: { startDate: null, endDate: "2026-10-23", label: "所有" } }));
  expect(request).not.toHaveBeenCalled();
  expect(composerDraft()).toBe(GROWTH_REVIEW_STARTER);
});

test("account switch clears an approval dialog and stale collection cannot send as the new account", async () => {
  let release!: (value: Awaited<ReturnType<typeof collectGrowthReviewContext>>) => void;
  mockCollect.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const view = render(tree());
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  await waitFor(() => expect(mockCollect).toHaveBeenCalledTimes(1));
  mockAccountId = "second-owner"; view.rerender(tree());
  expect(composerDraft()).toBe("");
  expect(screen.queryByText(permission)).toBeNull();
  await act(async () => release({ records: [{ id: "old-private", text: "旧资料" }], period: { startDate: null, endDate: "2026-10-23", label: "所有" } }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
});

test("an ambiguous historical range in a follow-up cannot silently reuse old permission", async () => {
  render(tree());
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  await screen.findByText(response.message);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "查看我最近一周和过去一个月的记录。");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/请在问题中写明回顾范围/u);
  expect(mockCollect).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(1);
});

test("room history failures prevent sending and preserve the editable review question", async () => {
  mockCollect.mockRejectedValueOnce(new Error("room-history-read-failed"));
  render(tree());
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/消息未发送，草稿已保留/u);
  expect(request).not.toHaveBeenCalled();
  expect(composerDraft()).toBe(GROWTH_REVIEW_STARTER);
});

test("clearing this account's room history aborts pending review collection", async () => {
  let cleared!: () => void;
  let release!: (value: Awaited<ReturnType<typeof collectGrowthReviewContext>>) => void;
  mockRoomHistory.subscribeToOwnerClear.mockImplementationOnce((owner, listener) => {
    expect(owner).toBe("growth-owner"); cleared = listener; return () => undefined;
  });
  mockCollect.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  render(tree());
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  await waitFor(() => expect(mockCollect).toHaveBeenCalledTimes(1));
  const signal = mockCollect.mock.calls[0]![0].signal!;
  act(() => cleared());
  expect(signal.aborted).toBe(true);
  await act(async () => release({ records: [{ id: "cleared-room", text: "已清除资料" }], period: { startDate: null, endDate: "2026-10-23", label: "所有" } }));
  expect(request).not.toHaveBeenCalled();
  expect(composerDraft()).toBe(GROWTH_REVIEW_STARTER);
});

test("growth request carries the three-paragraph plain-text instruction through the real send path", async () => {
  render(tree());
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  await screen.findByText(response.message);
  const payload = request.mock.calls[0]![0];
  expect(payload.question).toBe(GROWTH_REVIEW_STARTER);
  const instruction = payload.history?.[0]?.content ?? "";
  expect(instruction).toContain("第一段简短总结这段时间实际做过的行为");
  expect(instruction).toContain("第二段总结手记、旅程、房间和对话里有依据的内容");
  expect(instruction).toContain("第三段给出少量具体、可自行选择的下一步行动");
  expect(instruction).toContain("不加标题、序号、列表、加粗、井号、代码块或其他 Markdown 标识");
  expect(instruction).toContain("不写‘我不能替你做什么’‘我不能确定什么’或‘作为 AI’");
  expect(instruction).toContain("不要逐项复述缺口");
  expect(instruction).toContain("此时不要求凑足三段，不虚构行为或内容");
  expect(instruction).toContain("保留与该情况直接相关的必要支持和安全信息");
});

test("growth reply is displayed and reused as plain text without changing ordinary chat", async () => {
  const formatted = "### 行为总结\n**你留下了一条记录。**\n\n## 内容总结\n你关注怎样表达暂停。\n\n### 推荐行动\n- 先练习一句短句。";
  const plain = "行为总结\n你留下了一条记录。\n\n内容总结\n你关注怎样表达暂停。\n\n推荐行动\n先练习一句短句。";
  request.mockResolvedValueOnce({ ...response, message: formatted });
  const view = render(tree());
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  expect(await screen.findByText(plain)).toBeTruthy();
  expect(screen.queryByText(formatted)).toBeNull();
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "再给我一个容易开始的行动。");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(request.mock.calls[1]![0].history).toContainEqual({ role: "assistant", content: plain });

  view.unmount();
  request.mockResolvedValueOnce({ ...response, message: formatted });
  render(tree(false));
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "想聊聊今天。");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(await screen.findByText(formatted)).toBeTruthy();
});

test("no matching records can yield one honest short paragraph without adding disclaimers or invented activity", async () => {
  const message = "这段时间未找到足够的回顾记录。可以先记下一件今天在意的小事。";
  mockCollect.mockResolvedValueOnce({ records: [{ id: "growth-review-coverage", text: "成长回顾内部资料边界：所选范围内各来源均无匹配留存记录，不推断未记录的经历。" }],
    period: { startDate: "2026-10-17", endDate: "2026-10-23", label: "最近一周" } });
  request.mockResolvedValueOnce({ ...response, message });
  render(tree());
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  expect(await screen.findByText(message)).toBeTruthy();
  expect(message.split("\n\n")).toHaveLength(1);
});

test.each([
  "只看周一到周三的记录。",
  "只看星期一到星期三的记录。",
  "只看周末的记录。",
  "周末呢？",
  "工作日呢？",
  "回顾最近一周，但只看工作日。",
  "只看国庆假期的记录。",
  "改成国庆假期。",
  "仅限周末。",
  "日期换成假期。",
  "只看今天的记录。",
  "改成昨天。",
  "上周呢？",
  "上个月呢？",
  "回顾最近一周，但只看今天的记录。",
  "只看2026-10-20至2026-10-21的记录。",
  "回顾最近一周和所有记录。",
])("a time-changing follow-up keeps its draft without reading or sending the previous month: %s", async question => {
  mockCollect.mockResolvedValueOnce({ records: [{ id: "growth-review-coverage", text: "仅提供已授权的月度资料。" }],
    period: { startDate: "2026-09-23", endDate: "2026-10-23", label: "最近一个月" } });
  render(tree());
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  await screen.findByText(response.message);
  fireEvent.changeText(screen.getByLabelText("聊天消息"), question);
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/请在问题中写明回顾范围/u);
  expect(composerDraft()).toBe(question);
  expect(mockCollect).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(1);
});
