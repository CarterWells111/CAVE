import { fireEvent, render, screen } from "@testing-library/react-native";
import { Profiler } from "react";
import { AssistantHistoryProvider } from "./AssistantHistoryProvider";
import { AssistantComposerInput } from "./AssistantComposerInput";
import AiTabRoute from "../../../app/(tabs)/ai";
import { stageReportHandoff, takeReportHandoff } from "../rooms/application/report-handoff";
import { GROWTH_REVIEW_STARTER, growthReviewStarter, stageGrowthReviewEntry, takeGrowthReviewEntry } from "./growth-review-entry";
import { JOURNAL_ASSISTANT_STARTER, stageJournalAssistantEntry, takeJournalAssistantEntry } from "./journal-assistant-entry";

let mockAccountId: string | undefined = "synthetic-account-a";
let mockAdultStatus = "authorized";
let mockJourneyId: string | undefined;
let mockFocused = true;
const report = "合成测试报告：A 与伙伴约定暂停";
const accountTransitions = [
  ["A → signed-out → B", [undefined, "synthetic-account-b"]],
  ["A → B", ["synthetic-account-b"]],
  ["A → signed-out → A", [undefined, "synthetic-account-a"]],
] as const;

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ journeyId: mockJourneyId }),
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const focused = mockFocused;
    React.useEffect(() => focused ? callback() : undefined, [callback, focused]);
  },
}));
jest.mock("../auth/runtime/AuthProvider", () => ({
  useOptionalAuth: () => ({ accountId: mockAccountId }),
}));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useAdultDeclaration: () => ({ status: mockAdultStatus }),
  useOptionalJourneyRuntime: () => null,
}));

beforeEach(() => {
  mockAccountId = "synthetic-account-a";
  mockAdultStatus = "authorized";
  mockJourneyId = undefined;
  mockFocused = true;
  process.env.EXPO_PUBLIC_ASSISTANT_MODE = "mock";
  takeReportHandoff("ai", undefined);
  takeGrowthReviewEntry(undefined);
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_ASSISTANT_MODE;
  takeReportHandoff("ai", undefined);
});

function stageReport(text = report) {
  stageReportHandoff("ai", "synthetic-account-a", "synthetic-room", text);
}

function mountRoute() {
  const view: { current?: ReturnType<typeof render> } = {};
  const committedDrafts: string[] = [];
  // Profiler runs during commit, before focus/passive effects can clear a leaked draft.
  const route = () => <Profiler id="ai-route" onRender={() => {
    if (view.current) committedDrafts.push(view.current.UNSAFE_getByType(AssistantComposerInput).props.initialValue as string);
  }}><AiTabRoute /></Profiler>;
  view.current = render(route());
  return { committedDrafts, rerender: () => view.current!.rerender(route()) };
}

function expectEmptyDraft(committedDrafts: string[]) {
  expect(composerDraft()).toBe("");
  expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  expect(committedDrafts.length).toBeGreaterThan(0);
  expect(committedDrafts.every(value => value === "")).toBe(true);
}

test.each(accountTransitions)("consumed reports are cleared at every account boundary: %s", (_name, accounts) => {
  delete process.env.EXPO_PUBLIC_ASSISTANT_MODE;
  stageReport();
  const route = mountRoute();
  expect(composerDraft()).toBe(report);
  // Pending context access must disappear along with the old account draft.
  fireEvent.press(screen.getByRole("switch", { name: "帮我批准" }));
  expect(screen.getByText("允许在本次使用期间访问问题涉及的日记和旅程内容吗？")).toBeTruthy();
  route.committedDrafts.length = 0;
  for (const accountId of accounts) {
    mockAccountId = accountId;
    mockAdultStatus = accountId ? "authorized" : "public";
    route.rerender();
    expectEmptyDraft(route.committedDrafts);
    expect(screen.queryByText(report)).toBeNull();
    expect(screen.queryByText("允许在本次使用期间访问问题涉及的日记和旅程内容吗？")).toBeNull();
  }
});

test.each(accountTransitions)("account changes clear consumed reports while the tab is unfocused: %s", (_name, accounts) => {
  stageReport();
  const route = mountRoute();
  expect(composerDraft()).toBe(report);
  mockFocused = false;
  route.rerender();
  route.committedDrafts.length = 0;
  for (const accountId of accounts) {
    mockAccountId = accountId;
    mockAdultStatus = accountId ? "authorized" : "public";
    route.rerender();
    expectEmptyDraft(route.committedDrafts);
  }
  mockFocused = true;
  route.rerender();
  expectEmptyDraft(route.committedDrafts);
});

test("same-account focus preserves an edited report and consumes a new report once", () => {
  stageReport();
  const route = mountRoute();
  expect(composerDraft()).toBe(report);
  const edited = "合成编辑草稿：我想再讨论暂停安排";
  fireEvent.changeText(screen.getByLabelText("聊天消息"), edited);
  mockFocused = false;
  route.rerender();
  mockFocused = true;
  route.rerender();
  expect(composerDraft()).toBe(edited);
  expect(screen.queryByText("允许在本次使用期间访问问题涉及的日记和旅程内容吗？")).toBeNull();
  expect(takeReportHandoff("ai", mockAccountId)).toBeNull();

  mockFocused = false;
  route.rerender();
  const nextReport = "合成测试报告：A 的新约定";
  stageReport(nextReport);
  mockFocused = true;
  route.rerender();
  expect(composerDraft()).toBe(nextReport);
  expect(takeReportHandoff("ai", mockAccountId)).toBeNull();
});

test("another account cannot consume a staged report", () => {
  stageReport();
  mockAccountId = "synthetic-account-b";
  const route = mountRoute();
  expect(composerDraft()).toBe("");
  route.committedDrafts.length = 0;
  mockAccountId = "synthetic-account-a";
  route.rerender();
  expectEmptyDraft(route.committedDrafts);
});

function composerDraft() { return screen.UNSAFE_getByType(AssistantComposerInput).props.initialValue as string; }

test("journal entry is applied once on focus and a second entry starts fresh", () => {
  stageJournalAssistantEntry(mockAccountId!);
  const route = mountRoute();
  expect(composerDraft()).toBe(JOURNAL_ASSISTANT_STARTER);
  expect(screen.getByRole("button", { name: "重新选择" })).toBeTruthy();
  const edited = JOURNAL_ASSISTANT_STARTER + "今天有一件小事";
  fireEvent.changeText(screen.getByLabelText("聊天消息"), edited);
  mockFocused = false; route.rerender();
  mockFocused = true; route.rerender();
  expect(composerDraft()).toBe(edited);
  mockFocused = false; route.rerender();
  stageJournalAssistantEntry(mockAccountId!);
  mockFocused = true; route.rerender();
  expect(composerDraft()).toBe(JOURNAL_ASSISTANT_STARTER);
  expect(takeJournalAssistantEntry(mockAccountId)).toBeNull();
});

test.each(accountTransitions)("journal entry is cleared at account boundary: %s", (_name, accounts) => {
  stageJournalAssistantEntry(mockAccountId!);
  const route = mountRoute();
  expect(composerDraft()).toBe(JOURNAL_ASSISTANT_STARTER);
  route.committedDrafts.length = 0;
  for (const accountId of accounts) {
    mockAccountId = accountId;
    mockAdultStatus = accountId ? "authorized" : "public";
    route.rerender();
    expectEmptyDraft(route.committedDrafts);
    expect(screen.queryByRole("button", { name: "重新选择" })).toBeNull();
  }
});

test("an applied journal entry cannot replay when another journey remounts the chat", () => {
  stageJournalAssistantEntry(mockAccountId!);
  const tree = () => <AssistantHistoryProvider><AiTabRoute /></AssistantHistoryProvider>;
  const view = render(tree());
  expect(composerDraft()).toBe(JOURNAL_ASSISTANT_STARTER);
  const edited = JOURNAL_ASSISTANT_STARTER + "我已经补充了自己的描述";
  fireEvent.changeText(screen.getByLabelText("聊天消息"), edited);
  mockJourneyId = "body-knowledge";
  view.rerender(tree());
  expect(composerDraft()).toBe(edited);
});

test("growth entry is consumed once and preserves an edited range on later focus", () => {
  stageGrowthReviewEntry(mockAccountId!);
  const route = mountRoute();
  expect(composerDraft()).toBe(GROWTH_REVIEW_STARTER);
  expect(takeGrowthReviewEntry(mockAccountId)).toBeNull();
  const edited = "查看我最近一周的旅程、手记和AI记录，回顾成长。";
  fireEvent.changeText(screen.getByLabelText("聊天消息"), edited);
  mockFocused = false; route.rerender();
  mockFocused = true; route.rerender();
  expect(composerDraft()).toBe(edited);
  expect(screen.queryByRole("button", { name: "允许" })).toBeNull();
});

test.each(accountTransitions)("growth entry and consent do not survive an account boundary: %s", (_name, accounts) => {
  stageGrowthReviewEntry(mockAccountId!);
  const route = mountRoute();
  expect(composerDraft()).toBe(GROWTH_REVIEW_STARTER);
  route.committedDrafts.length = 0;
  for (const accountId of accounts) {
    mockAccountId = accountId; mockAdultStatus = accountId ? "authorized" : "public";
    route.rerender();
    expectEmptyDraft(route.committedDrafts);
    expect(screen.queryByText("成长回顾 · 可修改问题中的时间范围")).toBeNull();
  }
});

test.each(["week", "month", "halfYear", "all"] as const)("selected %s range is visible in the AI composer before any send", range => {
  stageGrowthReviewEntry(mockAccountId!, range);
  mountRoute();
  expect(composerDraft()).toBe(growthReviewStarter(range));
  expect(screen.queryByRole("button", { name: "允许" })).toBeNull();
  expect(takeGrowthReviewEntry(mockAccountId)).toBeNull();
});
