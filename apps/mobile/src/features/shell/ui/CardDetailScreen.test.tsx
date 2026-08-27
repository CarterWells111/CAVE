import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { StyleSheet, Text } from "react-native";

import { CardDetailScreen } from "./CardDetailScreen";

const metadata = {
  id: "card-1",
  title: "过夜前想说的话",
  dateLabel: "2026 年 8 月 27 日",
  statusLabel: "已保存"
};

const confirmedSections = [{
  id: "communication-comfort",
  title: "什么会让我更安心",
  text: "请先问我，再慢一点。",
  privateText: "PRIVATE SHOULD NEVER RENDER",
  deletedText: "DELETED SHOULD NEVER RENDER"
}];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function renderScreen(overrides: Partial<ComponentProps<typeof CardDetailScreen>> = {}) {
  const props = {
    confirmedSections,
    metadata,
    onBack: jest.fn(),
    onCopy: jest.fn(async () => undefined),
    onEdit: jest.fn(async () => undefined),
    onFullscreen: jest.fn(),
    ...overrides
  };
  render(<CardDetailScreen {...props} />);
  return props;
}

test("renders only explicitly supplied confirmed section fields in normal mode", () => {
  const props = renderScreen();

  expect(screen.getByRole("header", { name: metadata.title })).toBeTruthy();
  expect(screen.getByText(`${metadata.dateLabel} · ${metadata.statusLabel}`)).toBeTruthy();
  expect(screen.getByRole("summary", { name: "什么会让我更安心。请先问我，再慢一点。" })).toBeTruthy();
  expect(screen.getByText("请先问我，再慢一点。")).toBeTruthy();
  expect(screen.queryByText(/PRIVATE|DELETED/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "返回卡片列表" }));
  expect(props.onBack).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("card-detail-content")).toHaveStyle({ maxWidth: 600 });
});

test("supports a full-width fullscreen presentation and explicit exit action", () => {
  const props = renderScreen({ mode: "fullscreen" });

  expect(screen.getByTestId("card-detail-content")).toHaveStyle({ maxWidth: "100%" });
  fireEvent.press(screen.getByRole("button", { name: "退出全屏展示" }));
  expect(props.onFullscreen).toHaveBeenCalledTimes(1);
});

test("keeps copy visibly busy, blocks competing actions and reports success only after completion", async () => {
  const copying = deferred();
  const onCopy = jest.fn(() => copying.promise);
  const props = renderScreen({ onCopy });

  const copy = screen.getByRole("button", { name: "复制确认内容" });
  fireEvent.press(copy);
  fireEvent.press(copy);

  expect(onCopy).toHaveBeenCalledTimes(1);
  expect(onCopy).toHaveBeenCalledWith(props.confirmedSections);
  expect(screen.getByRole("button", { name: "正在复制确认内容…" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ busy: true, disabled: true }));
  expect(screen.getByRole("button", { name: "编辑这张卡" }).props.accessibilityState.disabled).toBe(true);
  expect(screen.queryByText("已复制确认内容。")).toBeNull();

  await act(async () => { copying.resolve(); });
  expect(await screen.findByText("已复制确认内容。")).toBeTruthy();
});

test("shows safe copy error text and retries without leaking the failure", async () => {
  const onCopy = jest.fn()
    .mockRejectedValueOnce(new Error("private clipboard details"))
    .mockResolvedValueOnce(undefined);
  renderScreen({ onCopy });

  fireEvent.press(screen.getByRole("button", { name: "复制确认内容" }));

  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("复制失败，请重试。")).toBeTruthy();
  expect(screen.queryByText(/private clipboard details/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "重试复制" }));
  expect(await screen.findByText("已复制确认内容。")).toBeTruthy();
  expect(onCopy).toHaveBeenCalledTimes(2);
});

test("shows an independent safe edit error and retry state", async () => {
  const onEdit = jest.fn()
    .mockRejectedValueOnce(new Error("private storage details"))
    .mockResolvedValueOnce(undefined);
  renderScreen({ onEdit });

  fireEvent.press(screen.getByRole("button", { name: "编辑这张卡" }));

  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("暂时无法打开编辑，请重试。")).toBeTruthy();
  expect(screen.queryByText(/private storage details/u)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "重试编辑" })); });
  expect(onEdit).toHaveBeenCalledTimes(2);
});

test("keeps the detail scrollable, text-wrapping and all controls at least 44 points", () => {
  renderScreen();

  const scroll = screen.getByTestId("card-detail-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  for (const control of screen.getAllByRole("button")) {
    expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(44);
  }
  for (const text of screen.UNSAFE_getAllByType(Text)) {
    expect(text.props.numberOfLines).toBeUndefined();
  }
});
