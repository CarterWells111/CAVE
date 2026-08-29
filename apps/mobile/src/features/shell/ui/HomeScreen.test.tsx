import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { HomeScreen } from "./HomeScreen";

const activeReview = { id: "active", kind: "review" as const, title: "八月回顾", dateLabel: "2026年8月27日", statusLabel: "进行中" };
const currentCard = { id: "card", title: "当前沟通草稿", dateLabel: "2026年8月27日", statusLabel: "仅本机" };
const recent = { id: "recent", title: "周末回顾", dateLabel: "2026年8月20日", statusLabel: "已完成" };

test("shows all long-term home destinations using neutral metadata only", () => {
  const onOpenAccount = jest.fn();
  const callbacks = {
    onContinueJourney: jest.fn(), onOpenCurrentCard: jest.fn(), onOpenRecord: jest.fn(),
    onStartPractice: jest.fn(), onStartReview: jest.fn(),
  };
  render(
    <HomeScreen
      account={{ displayName: "阿岚", onOpen: onOpenAccount, status: "ready" }}
      activeJourney={activeReview}
      currentCard={currentCard}
      recentRecords={[recent]}
      {...callbacks}
    />,
  );

  expect(screen.getByText("首页")).toBeTruthy();
  expect(screen.getByText("八月回顾")).toBeTruthy();
  expect(screen.getByText("2026年8月27日 · 进行中")).toBeTruthy();
  expect(screen.getByText("周末回顾")).toBeTruthy();
  expect(screen.queryByText(/正文|私密内容|昨晚/u)).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "继续本次回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "打开当前沟通草稿" }));
  fireEvent.press(screen.getByRole("button", { name: "开始练习" }));
  fireEvent.press(screen.getByRole("button", { name: "开始一次回顾" }));
  expect(callbacks.onStartReview).not.toHaveBeenCalled();
  expect(screen.getByText("已有进行中的回顾")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "取消新回顾" }));
  expect(callbacks.onStartReview).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "开始一次回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "确认开始新回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "打开周末回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "查看阿岚的账号" }));
  expect(Object.values(callbacks).every((callback) => callback.mock.calls.length === 1)).toBe(true);
  expect(onOpenAccount).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "打开设置" })).toBeNull();

  const action = screen.getByRole("button", { name: "开始练习" });
  expect(StyleSheet.flatten(action.props.style)).toEqual(expect.objectContaining({ minWidth: 44 }));
});

test("shows the promotional login CTA only while signed out", () => {
  const onOpen = jest.fn();
  const view = render(
    <HomeScreen
      account={{ onOpen, status: "signedOut" }}
      recentRecords={[]}
      onStartPractice={jest.fn()}
      onStartReview={jest.fn()}
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "去登录，享受更多功能" }));
  expect(onOpen).toHaveBeenCalledTimes(1);

  view.rerender(
    <HomeScreen
      account={{ displayName: "内界用户", onOpen, status: "ready" }}
      recentRecords={[]}
      onStartPractice={jest.fn()}
      onStartReview={jest.fn()}
    />,
  );
  expect(screen.queryByText("去登录，享受更多功能")).toBeNull();
  expect(screen.getByRole("button", { name: "查看内界用户的账号" })).toBeTruthy();
});

test("disables the account entry while profile status is loading", () => {
  render(
    <HomeScreen
      account={{ onOpen: jest.fn(), status: "loading" }}
      recentRecords={[]}
      onStartPractice={jest.fn()}
      onStartReview={jest.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "正在检查账号状态…" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ disabled: true }));
});

test("continues an unfinished initial journey without offering to replace it", () => {
  const onContinueJourney = jest.fn();
  const onStartReview = jest.fn();
  render(
    <HomeScreen
      activeJourney={{
        id: "initial",
        kind: "initial",
        title: "首次旅程",
        dateLabel: "2026年8月28日",
        statusLabel: "进行中",
      }}
      onContinueJourney={onContinueJourney}
      onStartPractice={jest.fn()}
      onStartReview={onStartReview}
      recentRecords={[]}
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "继续首次旅程" }));
  expect(onContinueJourney).toHaveBeenCalledWith("initial");
  expect(screen.queryByRole("button", { name: "开始一次回顾" })).toBeNull();
  expect(onStartReview).not.toHaveBeenCalled();
});

test("renders loading, retryable error, and real empty destinations", () => {
  const retry = jest.fn();
  const { rerender } = render(<HomeScreen loadState="loading" recentRecords={[]} onStartPractice={jest.fn()} onStartReview={jest.fn()} />);
  expect(screen.getByRole("status")).toBeTruthy();

  rerender(<HomeScreen loadState="error" onRetry={retry} recentRecords={[]} onStartPractice={jest.fn()} onStartReview={jest.fn()} />);
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  expect(retry).toHaveBeenCalledTimes(1);

  rerender(<HomeScreen recentRecords={[]} onStartPractice={jest.fn()} onStartReview={jest.fn()} />);
  expect(screen.getByText("还没有最近手记")).toBeTruthy();
  expect(screen.getByText("还没有当前沟通草稿")).toBeTruthy();
});
