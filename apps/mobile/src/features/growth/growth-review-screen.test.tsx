import { fireEvent, render, screen } from "@testing-library/react-native";
import { GrowthReviewScreen } from "./growth-review-screen";
import type { GrowthData } from "./growth-records";

const data: GrowthData = { events: [
  { id: "journal", metric: "journal", at: "2026-10-23T09:00:00Z", title: "这一周的一次尝试", href: "/journal/journal" },
  { id: "month", metric: "journal", at: "2026-10-01T09:00:00Z", title: "这个月的记录" },
  { id: "half-year", metric: "journey", at: "2026-06-01T09:00:00Z", title: "半年前的旅程" },
  { id: "old", metric: "ai", at: "2025-09-01T09:00:00Z", title: "更早的交流" },
  { id: "future", metric: "review", at: "2026-10-24T09:00:00Z", title: "未来的回顾" },
], undatedAiTurns: 0, notes: ["合成统计口径说明"] };
const props = { data, state: "ready" as const, now: new Date("2026-10-23T12:00:00Z"),
  onBack: jest.fn(), onRetry: jest.fn(), onAiReview: jest.fn(), onSignIn: jest.fn(), onOpenEvent: jest.fn() };
beforeEach(() => jest.clearAllMocks());

test("defaults to the last week and hands the same interval to AI", () => {
  render(<GrowthReviewScreen {...props} />);
  expect(screen.getByText("这一周的一次尝试")).toBeTruthy();
  expect(screen.queryByText("这个月的记录")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: /这一周的一次尝试/u }));
  expect(props.onOpenEvent).toHaveBeenCalledWith("/journal/journal");
  fireEvent.press(screen.getByRole("button", { name: "AI回顾我的成长" }));
  expect(props.onAiReview).toHaveBeenCalledWith("week");
  expect(screen.getByText("2026年10月17日 — 2026年10月23日")).toBeTruthy();
});

test.each([
  { label: "一个月", range: "month", start: "2026年9月24日", journal: 2, journey: 0, ai: 0, month: true, halfYear: false, old: false },
  { label: "半年", range: "halfYear", start: "2026年5月1日", journal: 2, journey: 1, ai: 0, month: true, halfYear: true, old: false },
  { label: "所有", range: "all", start: "2025年9月1日", journal: 2, journey: 1, ai: 1, month: true, halfYear: true, old: true },
])("updates dates, totals, records and the AI interval for $label", item => {
  render(<GrowthReviewScreen {...props} />);
  fireEvent.press(screen.getByRole("button", { name: "回顾区间，1周" }));
  for (const label of ["1周", "一个月", "半年", "所有"]) expect(screen.getByRole("radio", { name: label })).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: item.label }));
  expect(screen.getByRole("button", { name: "回顾区间，" + item.label })).toBeTruthy();
  expect(screen.getByText(item.start + " — 2026年10月23日")).toBeTruthy();
  expect(screen.getByTestId("growth-total-journal")).toHaveTextContent(item.journal + " 篇");
  expect(screen.getByTestId("growth-total-journey")).toHaveTextContent(item.journey + " 次");
  expect(screen.getByTestId("growth-total-ai")).toHaveTextContent(item.ai + " 次");
  expect(Boolean(screen.queryByText("这个月的记录"))).toBe(item.month);
  expect(Boolean(screen.queryByText("半年前的旅程"))).toBe(item.halfYear);
  expect(Boolean(screen.queryByText("更早的交流"))).toBe(item.old);
  expect(screen.queryByText("未来的回顾")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "AI回顾我的成长" }));
  expect(props.onAiReview).toHaveBeenCalledWith(item.range);
});

test("moves guidance and counting notes into the page help", () => {
  render(<GrowthReviewScreen {...props} />);
  expect(screen.queryByText("合成统计口径说明")).toBeNull();
  expect(screen.queryByText(/AI 回顾会先把当前所选时间范围的问题/u)).toBeNull();
  expect(screen.queryByText(/统计当前仍保留的记录/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "关键事件与阶段回顾，帮助" }));
  expect(screen.getByText("合成统计口径说明")).toBeTruthy();
  expect(screen.getByText(/AI 回顾会先把当前所选时间范围的问题/u)).toBeTruthy();
  expect(screen.getByText(/统计当前仍保留的记录/u)).toBeTruthy();
});

test("keeps an accurate empty-state hint", () => {
  render(<GrowthReviewScreen {...props} data={{ events: [], undatedAiTurns: 0, notes: [] }} />);
  expect(screen.getByText("这段时间还没有留存的手记、回顾、旅程或 AI 交流。")).toBeTruthy();
});

test("hides private stats and the AI button while signed out", () => {
  render(<GrowthReviewScreen {...props} state="locked" />);
  expect(screen.queryByText("这一周的一次尝试")).toBeNull();
  expect(screen.queryByRole("button", { name: "AI回顾我的成长" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "邮箱登录" }));
  expect(props.onSignIn).toHaveBeenCalledTimes(1);
});
