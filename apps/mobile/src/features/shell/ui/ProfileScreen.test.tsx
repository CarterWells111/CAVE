import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { ProfileScreen } from "./ProfileScreen";
import type { GrowthData } from "../../growth/growth-records";

const data: GrowthData = { events: [
  { id: "today", metric: "journal", at: "2026-10-23T09:00:00Z" },
  { id: "old", metric: "journal", at: "2026-09-01T09:00:00Z" },
], undatedAiTurns: 0, notes: [] };
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-23T12:00:00Z")); });
afterEach(() => { jest.useRealTimers(); });

test("keeps the account card above growth and removes the three former archive sections", () => {
  const open = jest.fn();
  const view = render(<ProfileScreen account={{ status: "ready", email: "person@example.com", profile: { displayName: "阿岚" } }}
    growth={data} growthState="ready" onOpenGrowth={open} onRetryGrowth={jest.fn()} onOpenSettings={jest.fn()} />);
  expect(screen.getByText("阿岚")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "更改昵称" })).toBeNull();
  const output = JSON.stringify(view.toJSON());
  expect(output.indexOf("阿岚")).toBeLessThan(output.indexOf("我的成长记录"));
  for (const label of ["内界手记", "我的卡片", "我的回顾"]) expect(screen.queryByRole("header", { name: label })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "打开关键事件与阶段回顾" }));
  expect(open).toHaveBeenCalledTimes(1);
});

test("switches the graph from the current week to all dated records", () => {
  render(<ProfileScreen growth={data} growthState="ready" onOpenGrowth={jest.fn()} onRetryGrowth={jest.fn()} onOpenSettings={jest.fn()} />);
  expect(screen.getByRole("image", { name: /1周活动折线图，记录手记1篇/u })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "查看按时间的活动明细" }));
  const details = screen.getByTestId("bottom-sheet-panel");
  expect(within(details).getByRole("header", { name: "成长记录时间明细" })).toBeTruthy();
  expect(within(details).getByText("2026年10月23日")).toBeTruthy();
  expect(within(details).getByText(/记录手记1篇/u)).toBeTruthy();
  expect(screen.getByTestId("bottom-sheet-scroll")).toBeTruthy();
  fireEvent.press(within(details).getByRole("button", { name: "关闭成长记录时间明细" }));
  expect(screen.queryByText("2026年10月23日")).toBeNull();
  expect(screen.getByRole("button", { name: "查看按时间的活动明细", expanded: false })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "选择成长记录显示区间，当前1周" }));
  for (const label of ["1周", "一个月", "半年", "所有"]) expect(screen.getByRole("button", { name: "显示" + label + "的成长记录" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "显示所有的成长记录" }));
  expect(screen.getByRole("image", { name: /所有活动折线图，记录手记2篇/u })).toBeTruthy();
});

test("shows retry rather than zero activity when loading failed", () => {
  const retry = jest.fn();
  render(<ProfileScreen growth={data} growthState="error" onOpenGrowth={jest.fn()} onRetryGrowth={retry} onOpenSettings={jest.fn()} />);
  expect(screen.queryByRole("image")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "重试读取成长记录" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("preserves sign in and settings actions for the public profile", () => {
  const signIn = jest.fn(), settings = jest.fn();
  render(<ProfileScreen account={{ status: "signedOut", onSignIn: signIn }} growth={{ events: [], undatedAiTurns: 0, notes: [] }}
    growthState="locked" onOpenGrowth={jest.fn()} onRetryGrowth={jest.fn()} onOpenSettings={settings} />);
  fireEvent.press(screen.getByRole("button", { name: "邮箱登录" }));
  fireEvent.press(screen.getByRole("button", { name: "设置" }));
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(settings).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("image")).toBeNull();
});

test("keeps the counting notes and review guidance inside page help", () => {
  render(<ProfileScreen growth={{ ...data, notes: ["合成统计口径说明"] }} growthState="ready"
    onOpenGrowth={jest.fn()} onRetryGrowth={jest.fn()} onOpenSettings={jest.fn()} />);
  expect(screen.queryByText("合成统计口径说明")).toBeNull();
  expect(screen.queryByText(/每个时间段内统计当前保留的记录次数/u)).toBeNull();
  expect(screen.queryByText("看看最近一周，也为下一段路留一点建议")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "我的，帮助" }));
  expect(screen.getByText("合成统计口径说明")).toBeTruthy();
  expect(screen.getByText(/每个时间段内统计当前保留的记录次数/u)).toBeTruthy();
  expect(screen.getByText(/关键事件与阶段回顾中可以选择时间范围/u)).toBeTruthy();
});

test("keeps the true empty-state hint on the profile", () => {
  render(<ProfileScreen growth={{ events: [], undatedAiTurns: 0, notes: [] }} growthState="ready"
    onOpenGrowth={jest.fn()} onRetryGrowth={jest.fn()} onOpenSettings={jest.fn()} />);
  expect(screen.getByText("这段时间还没有可显示的活动，按自己的节奏慢慢开始。")).toBeTruthy();
});
