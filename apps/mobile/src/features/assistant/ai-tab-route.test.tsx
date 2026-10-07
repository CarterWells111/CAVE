import { fireEvent, render, screen } from "@testing-library/react-native";
import { Profiler } from "react";
import AiTabRoute from "../../../app/(tabs)/ai";
import { stageReportHandoff, takeReportHandoff } from "../rooms/application/report-handoff";

let mockAccountId: string | undefined = "synthetic-account-a";
let mockAdultStatus = "authorized";
let mockFocused = true;
const report = "合成测试报告：A 与伙伴约定暂停";
const accountTransitions = [
  ["A → signed-out → B", [undefined, "synthetic-account-b"]],
  ["A → B", ["synthetic-account-b"]],
  ["A → signed-out → A", [undefined, "synthetic-account-a"]],
] as const;

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
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
}));

beforeEach(() => {
  mockAccountId = "synthetic-account-a";
  mockAdultStatus = "authorized";
  mockFocused = true;
  process.env.EXPO_PUBLIC_ASSISTANT_MODE = "mock";
  takeReportHandoff("ai", undefined);
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
    if (view.current) committedDrafts.push(view.current.getByLabelText("聊天消息").props.value as string);
  }}><AiTabRoute /></Profiler>;
  view.current = render(route());
  return { committedDrafts, rerender: () => view.current!.rerender(route()) };
}

function expectEmptyDraft(committedDrafts: string[]) {
  expect(screen.getByLabelText("聊天消息")).toHaveProp("value", "");
  expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  expect(committedDrafts.length).toBeGreaterThan(0);
  expect(committedDrafts.every(value => value === "")).toBe(true);
}

test.each(accountTransitions)("consumed reports are cleared at every account boundary: %s", (_name, accounts) => {
  stageReport();
  const route = mountRoute();
  expect(screen.getByLabelText("聊天消息")).toHaveProp("value", report);
  // A pending confirmation must disappear along with the old account draft.
  fireEvent.press(screen.getByRole("button", { name: "发送消息" }));
  expect(screen.getByText("确认本次模拟内容")).toBeTruthy();
  route.committedDrafts.length = 0;
  for (const accountId of accounts) {
    mockAccountId = accountId;
    mockAdultStatus = accountId ? "authorized" : "public";
    route.rerender();
    expectEmptyDraft(route.committedDrafts);
    expect(screen.queryByText(report)).toBeNull();
    expect(screen.queryByText("确认本次模拟内容")).toBeNull();
  }
});

test.each(accountTransitions)("account changes clear consumed reports while the tab is unfocused: %s", (_name, accounts) => {
  stageReport();
  const route = mountRoute();
  expect(screen.getByLabelText("聊天消息")).toHaveProp("value", report);
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
  expect(screen.getByLabelText("聊天消息")).toHaveProp("value", report);
  const edited = "合成编辑草稿：我想再讨论暂停安排";
  fireEvent.changeText(screen.getByLabelText("聊天消息"), edited);
  mockFocused = false;
  route.rerender();
  mockFocused = true;
  route.rerender();
  expect(screen.getByLabelText("聊天消息")).toHaveProp("value", edited);
  expect(screen.queryByText("确认本次模拟内容")).toBeNull();
  expect(takeReportHandoff("ai", mockAccountId)).toBeNull();

  mockFocused = false;
  route.rerender();
  const nextReport = "合成测试报告：A 的新约定";
  stageReport(nextReport);
  mockFocused = true;
  route.rerender();
  expect(screen.getByLabelText("聊天消息")).toHaveProp("value", nextReport);
  expect(takeReportHandoff("ai", mockAccountId)).toBeNull();
});

test("another account cannot consume a staged report", () => {
  stageReport();
  mockAccountId = "synthetic-account-b";
  const route = mountRoute();
  expect(screen.getByLabelText("聊天消息")).toHaveProp("value", "");
  route.committedDrafts.length = 0;
  mockAccountId = "synthetic-account-a";
  route.rerender();
  expectEmptyDraft(route.committedDrafts);
});
