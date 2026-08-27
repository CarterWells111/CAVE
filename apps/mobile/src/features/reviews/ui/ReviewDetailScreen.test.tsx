import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { ReviewDetailScreen } from "./ReviewDetailScreen";

const metadata = { id: "review-1", title: "边界与表达", dateLabel: "8月26日", statusLabel: "已完成" } as const;
const sections = [
  { id: "noticed", title: "我注意到", text: "我需要更多时间。" },
  { id: "next", title: "下次想尝试", text: "先说出自己的节奏。" }
] as const;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, reject, resolve };
}

test("shows detail body only here and exposes back and branch actions", () => {
  const onBack = jest.fn();
  const onBranch = jest.fn();
  render(
    <ReviewDetailScreen
      metadata={metadata}
      onBack={onBack}
      onBranch={onBranch}
      onContinueAfterDelete={jest.fn()}
      onDelete={jest.fn(async () => undefined)}
      sections={sections}
    />
  );

  expect(screen.getByText("我需要更多时间。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "从这条回顾开始新分支" }));
  fireEvent.press(screen.getByRole("button", { name: "返回回顾历史" }));
  expect(onBranch).toHaveBeenCalledWith("review-1");
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("requires explicit deletion confirmation and allows cancellation", () => {
  const onDelete = jest.fn(async () => undefined);
  render(
    <ReviewDetailScreen metadata={metadata} onBack={jest.fn()} onBranch={jest.fn()} onContinueAfterDelete={jest.fn()} onDelete={onDelete} sections={sections} />
  );

  fireEvent.press(screen.getByRole("button", { name: "删除这条回顾" }));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByText(/请再次确认/)).toBeTruthy();
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "取消删除" }));
  expect(screen.queryByRole("button", { name: "确认删除这条回顾" })).toBeNull();
});

test("shows non-color pending and success states and prevents duplicate deletion", async () => {
  const pending = deferred<void>();
  const onDelete = jest.fn(() => pending.promise);
  const onContinueAfterDelete = jest.fn();
  render(
    <ReviewDetailScreen metadata={metadata} onBack={jest.fn()} onBranch={jest.fn()} onContinueAfterDelete={onContinueAfterDelete} onDelete={onDelete} sections={sections} />
  );

  fireEvent.press(screen.getByRole("button", { name: "删除这条回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除这条回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "正在删除这条回顾…" }));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "正在删除这条回顾…" }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  expect(screen.queryByText("这条回顾已删除。" )).toBeNull();

  pending.resolve();
  expect(await screen.findByText("这条回顾已删除。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "返回回顾历史" }));
  expect(onContinueAfterDelete).toHaveBeenCalledTimes(1);
});

test("keeps content visible after a safe delete error and retries", async () => {
  const onDelete = jest.fn()
    .mockRejectedValueOnce(new Error("secret database path"))
    .mockResolvedValueOnce(undefined);
  render(
    <ReviewDetailScreen metadata={metadata} onBack={jest.fn()} onBranch={jest.fn()} onContinueAfterDelete={jest.fn()} onDelete={onDelete} sections={sections} />
  );

  fireEvent.press(screen.getByRole("button", { name: "删除这条回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除这条回顾" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("删除失败，请重试。回顾内容仍保留在当前画面。")).toBeTruthy();
  expect(screen.queryByText(/secret database path/)).toBeNull();
  expect(screen.getByText("我需要更多时间。")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "重试删除" }));
  await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("这条回顾已删除。")).toBeTruthy();
});

test("is a static keyboard-safe large-text layout with 44-point actions", () => {
  const { UNSAFE_getAllByType, getByTestId } = render(
    <ReviewDetailScreen metadata={metadata} onBack={jest.fn()} onBranch={jest.fn()} onContinueAfterDelete={jest.fn()} onDelete={jest.fn(async () => undefined)} sections={sections} />
  );

  const scroll = getByTestId("review-detail-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(scroll.props.reducedMotion).toBeUndefined();
  for (const button of screen.getAllByRole("button")) {
    const style = typeof button.props.style === "function" ? button.props.style({ pressed: false }) : button.props.style;
    expect(StyleSheet.flatten(style).minHeight).toBeGreaterThanOrEqual(44);
  }
  for (const text of UNSAFE_getAllByType(Text)) {
    expect(text.props.numberOfLines).toBeUndefined();
  }
});
