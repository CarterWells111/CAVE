import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { ReviewHistoryScreen } from "./ReviewHistoryScreen";

const reviews = [
  { id: "review-1", title: "边界与表达", dateLabel: "8月26日", statusLabel: "已完成" },
  { id: "review-2", title: "身体感受", dateLabel: "8月20日", statusLabel: "草稿" }
] as const;

test("renders distinct loading, empty, and safe retryable error states", () => {
  const retry = jest.fn();
  const { rerender } = render(<ReviewHistoryScreen loadState="loading" onOpenReview={jest.fn()} reviews={[]} />);

  expect(screen.getByRole("status")).toBeTruthy();
  expect(screen.getByText("正在读取本机回顾历史…")).toBeTruthy();

  rerender(<ReviewHistoryScreen loadState="error" onOpenReview={jest.fn()} onRetry={retry} reviews={[]} />);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByText("暂时无法读取本机回顾历史。你的记录没有因此被删除。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试读取" }));
  expect(retry).toHaveBeenCalledTimes(1);

  rerender(<ReviewHistoryScreen loadState="ready" onOpenReview={jest.fn()} reviews={[]} />);
  expect(screen.getByText("还没有历史回顾")).toBeTruthy();
});

test("lists only title, date, and status metadata and opens the selected review", () => {
  const onOpenReview = jest.fn();
  render(<ReviewHistoryScreen loadState="ready" onOpenReview={onOpenReview} reviews={reviews} />);

  expect(screen.getByText("边界与表达")).toBeTruthy();
  expect(screen.getByText("8月26日 · 已完成")).toBeTruthy();
  expect(screen.queryByText(/正文|私密|删除内容/)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "打开回顾：边界与表达" }));
  expect(onOpenReview).toHaveBeenCalledWith("review-1");
});

test("keeps history scrollable at large text sizes with 44-point actions", () => {
  const { UNSAFE_getAllByType, getByTestId } = render(
    <ReviewHistoryScreen loadState="ready" onOpenReview={jest.fn()} reviews={reviews} />
  );

  const scroll = getByTestId("review-history-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  for (const button of screen.getAllByRole("button")) {
    const style = typeof button.props.style === "function" ? button.props.style({ pressed: false }) : button.props.style;
    expect(StyleSheet.flatten(style).minHeight).toBeGreaterThanOrEqual(44);
  }
  for (const text of UNSAFE_getAllByType(Text)) {
    expect(text.props.numberOfLines).toBeUndefined();
  }
});
