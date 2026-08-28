import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { StyleSheet, Text } from "react-native";

import { CardDetailScreen } from "./CardDetailScreen";

const metadata = {
  id: "card-1",
  title: "沟通草稿",
  dateLabel: "2026 年 8 月 27 日",
  statusLabel: "仅存本机"
};
const sections = [{
  id: "communication-comfort",
  title: "什么会让我更安心",
  text: "请先问我，再慢一点。"
}];

function renderScreen(overrides: Partial<ComponentProps<typeof CardDetailScreen>> = {}) {
  const props = {
    metadata,
    sections,
    onBack: jest.fn(),
    onEdit: jest.fn(async () => undefined),
    ...overrides
  };
  render(<CardDetailScreen {...props} />);
  return props;
}

test("renders retained sections as one continuous private paper draft", () => {
  const props = renderScreen();

  expect(screen.getByTestId("communication-draft-paper")).toBeTruthy();
  expect(screen.getByText("什么会让我更安心")).toBeTruthy();
  expect(screen.getByText("请先问我，再慢一点。")).toBeTruthy();
  expect(screen.queryByText(/同意|复制|分享|全屏/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "返回草稿箱" }));
  expect(props.onBack).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("card-detail-content")).toHaveStyle({ maxWidth: 600 });
});
test("renders an explicit empty paper draft", () => {
  renderScreen({ sections: [] });
  expect(screen.getByText("这次没有保留沟通草稿。")).toBeTruthy();
});

test("shows a safe edit error and retry state", async () => {
  const onEdit = jest.fn()
    .mockRejectedValueOnce(new Error("private storage details"))
    .mockResolvedValueOnce(undefined);
  renderScreen({ onEdit });

  fireEvent.press(screen.getByRole("button", { name: "编辑这份草稿" }));
  expect(await screen.findByText("暂时无法打开编辑，请重试。")).toBeTruthy();
  expect(screen.queryByText(/private storage details/u)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "重试编辑" })); });
  expect(onEdit).toHaveBeenCalledTimes(2);
});

test("keeps the detail scrollable, text-wrapping and controls accessible", () => {
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
