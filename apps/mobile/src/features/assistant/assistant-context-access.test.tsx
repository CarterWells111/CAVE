import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useEffect, useLayoutEffect, useState } from "react";
import { View } from "react-native";
import type { AssistantRequest, AssistantResponse } from "@cave/contracts";

import AssistantHistoryRoute from "../../../app/assistant-history";
import { AssistantChat } from "./assistant-chat";
import { AssistantComposerInput } from "./AssistantComposerInput";
import { AssistantHistoryProvider, useAssistantHistorySession, useOptionalAssistantContextAccess } from "./AssistantHistoryProvider";
import { collectAssistantQuestionContext, type AssistantQuestionContext } from "./assistant-question-context";
import { InMemoryAssistantHistoryRepository } from "./history/in-memory-assistant-history-repository";

let mockAccountId: string | undefined = "session-owner";
let mockAdult = "authorized";
let mockRepository: InMemoryAssistantHistoryRepository;
let mockConversationId = 0;
let mockShowHistory: (visible: boolean) => void = () => undefined;
const mockPush = jest.fn((destination: unknown) => {
  if (destination === "/assistant-history") mockShowHistory(true);
});
jest.mock("expo-crypto", () => ({ randomUUID: () => `session-conversation-${++mockConversationId}` }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: () => mockShowHistory(false), canGoBack: () => true, replace: () => mockShowHistory(false) }) }));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => ({ accountId: mockAccountId }) }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useAdultDeclaration: () => ({ status: mockAdult }),
  useOptionalJourneyRuntime: () => mockAdult === "authorized" ? { assistantHistory: mockRepository } : null,
}));
jest.mock("../journal/runtime/JournalAccessProvider", () => ({ useOptionalJournalAccess: () => null }));
jest.mock("./assistant-question-context", () => ({ collectAssistantQuestionContext: jest.fn(async () => ({ records: [] })) }));

const response: AssistantResponse = { status: "ok", providerMode: "mock", message: "合成回复", observations: [], sources: [] };
const mockRequest = jest.fn<Promise<AssistantResponse>, [AssistantRequest, AbortSignal]>(async () => response);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(collectAssistantQuestionContext).mockReset().mockResolvedValue({ records: [] });
  mockAccountId = "session-owner";
  mockAdult = "authorized";
  mockRepository = new InMemoryAssistantHistoryRepository();
  mockConversationId = 0;
  mockShowHistory = () => undefined;
  delete process.env.EXPO_PUBLIC_ASSISTANT_MODE;
});

function SessionHarness({ chatVisible = true }: { chatVisible?: boolean }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  mockShowHistory = setHistoryOpen;
  return <AssistantHistoryProvider>
    <View accessibilityElementsHidden={historyOpen} importantForAccessibility={historyOpen ? "no-hide-descendants" : "auto"}>
      {chatVisible ? <AssistantChat authorized journeyId="first-overnight" request={mockRequest} /> : null}
    </View>
    {historyOpen ? <AssistantHistoryRoute /> : null}
  </AssistantHistoryProvider>;
}

async function mountSession() {
  const view = render(<SessionHarness />);
  await act(async () => undefined);
  return view;
}
function allowAccess() {
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: false }));
  fireEvent.press(screen.getByRole("button", { name: "允许" }));
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
}

test("access choice survives new conversations and opening or leaving the history page", async () => {
  await mockRepository.save("session-owner", {
    id: "existing", title: "已有对话", journeyId: "pause", draft: "",
    createdAt: "2026-10-14T10:00:00.000Z", updatedAt: "2026-10-14T10:00:00.000Z",
    turns: [{ question: "已有对话", response }],
  });
  await mountSession();
  allowAccess();
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "待丢弃的草稿");
  fireEvent.press(screen.getByRole("button", { name: "新对话" }));
  expect(composerDraft()).toBe("");
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "对话历史" }));
  fireEvent.press(await screen.findByRole("button", { name: "打开对话：已有对话" }));
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "对话历史" }));
  fireEvent.press(screen.getByRole("button", { name: "返回聊天" }));
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
});

test("leaving the AI tab preserves access while the app-level provider stays mounted", async () => {
  const view = await mountSession();
  allowAccess();
  await act(async () => { view.rerender(<SessionHarness chatVisible={false} />); });
  expect(screen.queryByRole("switch", { name: "帮我批准" })).toBeNull();
  await act(async () => { view.rerender(<SessionHarness />); });
  expect(screen.getByRole("switch", { name: "帮我批准", checked: true })).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
});

test("fully unmounting the app provider resets access instead of restoring it from history", async () => {
  const view = await mountSession();
  allowAccess();
  view.unmount();
  await mountSession();
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
});

test("switching accounts resets access and returning to the old account does not revive it", async () => {
  const view = await mountSession();
  allowAccess();
  mockAccountId = "other-session-owner";
  await act(async () => { view.rerender(<SessionHarness />); });
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
  mockAccountId = "session-owner";
  mockAdult = "authorized";
  await act(async () => { view.rerender(<SessionHarness />); });
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
});

test("revoked access remains off after changing conversations and returning from another tab", async () => {
  const view = await mountSession();
  allowAccess();
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准", checked: true }));
  fireEvent.press(screen.getByRole("button", { name: "新对话" }));
  await act(async () => { view.rerender(<SessionHarness chatVisible={false} />); });
  await act(async () => { view.rerender(<SessionHarness />); });
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
});


test("account changes abort pending context collection and cannot upload its late records", async () => {
  let resolve!: (context: AssistantQuestionContext) => void;
  const collect = jest.mocked(collectAssistantQuestionContext);
  collect.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
  const view = await mountSession();
  allowAccess();
  fireEvent.changeText(screen.getByLabelText("聊天消息"), "合成账号一的问题");
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  const signal = collect.mock.calls[0]?.[0].signal;
  expect(mockRequest).not.toHaveBeenCalled();
  mockAccountId = "other-session-owner";
  await act(async () => { view.rerender(<SessionHarness />); });
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve({ records: [{ id: "synthetic-account-one-diary", text: "账号一的合成资料" }] }));
  expect(mockRequest).not.toHaveBeenCalled();
  expect(composerDraft()).toBe("");
  expect(screen.getByRole("switch", { name: "帮我批准", checked: false })).toBeTruthy();
});

type ScopeCommit = { account: string | undefined; adult: string; draft: string; allowed: boolean; titles: string[]; activeId: string | null };
function scopeHarness() {
  let mounts = 0;
  let history!: ReturnType<typeof useAssistantHistorySession>;
  let access!: NonNullable<ReturnType<typeof useOptionalAssistantContextAccess>>;
  const commits: ScopeCommit[] = [];
  function NavigatorProbe() {
    history = useAssistantHistorySession();
    access = useOptionalAssistantContextAccess()!;
    useEffect(() => { mounts += 1; }, []);
    const commit = { account: mockAccountId, adult: mockAdult, draft: history.draft, allowed: access.allowed, titles: history.conversations.map(item => item.title), activeId: history.activeId };
    useLayoutEffect(() => { commits.push(commit); });
    return null;
  }
  const tree = () => <AssistantHistoryProvider><NavigatorProbe /></AssistantHistoryProvider>;
  return { tree, commits, history: () => history, access: () => access, mounts: () => mounts };
}

test("scope changes preserve the navigator mount and never commit old history, drafts or access", async () => {
  const harness = scopeHarness();
  const view = render(harness.tree());
  await act(async () => undefined);
  act(() => { harness.history().appendTurn("账号一的内容", response); harness.access().setAllowed(true); });
  act(() => { harness.history().setDraft("账号一未发送草稿"); });
  await waitFor(async () => expect(await mockRepository.list("session-owner")).toHaveLength(1));
  mockAccountId = "second-owner";
  await act(async () => { view.rerender(harness.tree()); });
  const secondCommits = harness.commits.filter(item => item.account === "second-owner");
  expect(secondCommits.length).toBeGreaterThan(0);
  expect(secondCommits.every(item => item.draft === "" && !item.allowed && item.activeId === null && item.titles.length === 0)).toBe(true);
  act(() => { harness.history().setDraft("账号二未发送草稿"); harness.access().setAllowed(true); });
  mockAdult = "public";
  await act(async () => { view.rerender(harness.tree()); });
  const publicCommits = harness.commits.filter(item => item.adult === "public");
  expect(publicCommits.length).toBeGreaterThan(0);
  expect(publicCommits.every(item => item.draft === "" && !item.allowed && item.activeId === null && item.titles.length === 0)).toBe(true);
  mockAdult = "authorized";
  await act(async () => { view.rerender(harness.tree()); });
  expect(harness.mounts()).toBe(1);
  expect(harness.history().draft).toBe("");
  expect(harness.access().allowed).toBe(false);
});

test("switching scope cannot publish an old delayed history load into the new account", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const old = { id: "old", title: "旧账号历史", journeyId: "pause", draft: "旧账号草稿", createdAt: "2026-10-14T10:00:00.000Z", updatedAt: "2026-10-14T10:00:00.000Z", turns: [{ question: "旧账号历史", response }] };
  jest.spyOn(mockRepository, "list").mockImplementationOnce(async () => { await gate; return [old]; });
  const harness = scopeHarness();
  const view = render(harness.tree());
  mockAccountId = "second-owner";
  await act(async () => { view.rerender(harness.tree()); });
  await act(async () => { release(); });
  expect(harness.commits.filter(item => item.account === "second-owner").every(item => item.draft === "" && item.titles.length === 0)).toBe(true);
  expect(harness.mounts()).toBe(1);
});

test("deleting an old account while its save is pending cannot resurrect it or alter the new account", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const save = mockRepository.save.bind(mockRepository);
  const pending = jest.spyOn(mockRepository, "save").mockImplementationOnce(async (owner, item) => { await gate; await save(owner, item); });
  const harness = scopeHarness();
  const view = render(harness.tree());
  await act(async () => undefined);
  act(() => { harness.history().appendTurn("旧账号等待保存", response); });
  await waitFor(() => expect(pending).toHaveBeenCalledTimes(1));
  mockAccountId = "second-owner";
  await act(async () => { view.rerender(harness.tree()); });
  act(() => { harness.history().appendTurn("新账号的内容", response); });
  await waitFor(async () => expect((await mockRepository.list("second-owner"))[0]?.title).toBe("新账号的内容"));
  await act(async () => { await mockRepository.clearOwner("session-owner"); release(); });
  await waitFor(async () => expect(await mockRepository.list("session-owner")).toEqual([]));
  expect((await mockRepository.list("second-owner"))[0]?.title).toBe("新账号的内容");
  expect(harness.history().conversations.map(item => item.title)).toEqual(["新账号的内容"]);
  expect(harness.mounts()).toBe(1);
});

test("changing accounts still lets an already-started ordinary save finish for its original owner", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const save = mockRepository.save.bind(mockRepository);
  const pending = jest.spyOn(mockRepository, "save").mockImplementationOnce(async (owner, item) => { await gate; await save(owner, item); });
  const harness = scopeHarness();
  const view = render(harness.tree());
  await act(async () => undefined);
  act(() => { harness.history().appendTurn("旧账号保留的历史", response); });
  await waitFor(() => expect(pending).toHaveBeenCalledTimes(1));
  mockAccountId = "second-owner";
  await act(async () => { view.rerender(harness.tree()); release(); });
  await waitFor(async () => expect((await mockRepository.list("session-owner"))[0]?.title).toBe("旧账号保留的历史"));
  expect(await mockRepository.list("second-owner")).toEqual([]);
  expect(harness.history().conversations).toEqual([]);
});

test("a report draft on the first shared-provider mount is forwarded into the active history", async () => {
  render(<AssistantHistoryProvider><AssistantChat authorized journeyId="pause" initialDraft="首次挂载的报告草稿" request={mockRequest} /></AssistantHistoryProvider>);
  await act(async () => undefined);
  expect(composerDraft()).toBe("首次挂载的报告草稿");
});

function composerDraft() { return screen.UNSAFE_getByType(AssistantComposerInput).props.initialValue as string; }
