import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { StyleSheet, Text } from "react-native";

import { darkTheme } from "../../../core/design/theme";
import { COMMUNICATION_SECTION_IDS } from "../../journey/domain/types";
import { SavedCardEditScreen } from "./SavedCardEditScreen";

const metadata = {
  id: "card-1",
  title: "沟通草稿",
  dateLabel: "2026 年 8 月 27 日",
  statusLabel: "仅存本机"
};
const sectionTitles = [
  "对这次相处的期待",
  "可能愿意的靠近",
  "希望当下再决定",
  "这次不想做的事",
  "让我更安心的方式",
  "感受变化时怎么说",
  "共同边界",
] as const;
const sections = COMMUNICATION_SECTION_IDS.map((id, index) => ({
  id,
  title: sectionTitles[index]!,
  text: `第 ${index + 1} 段文字`,
  visibility: index === 0
    ? "included" as const
    : index === 1
      ? "private" as const
      : index === 2
        ? "deleted" as const
        : "pending" as const,
  needsReview: index === 3,
}));

function renderScreen(overrides: Partial<ComponentProps<typeof SavedCardEditScreen>> = {}) {
  const props = {
    metadata,
    sections,
    onCancel: jest.fn(),
    onSave: jest.fn(async () => undefined),
    ...overrides
  };
  render(<SavedCardEditScreen {...props} />);
  return props;
}

test("shows all seven local draft sections in the same two-column editor", () => {
  renderScreen();

  expect(screen.getByRole("header", { name: "编辑沟通草稿" })).toBeTruthy();
  expect(screen.getAllByText("保留在沟通草稿中")).toHaveLength(6);
  expect(screen.getByText("已从草稿中删除")).toBeTruthy();
  expect(screen.getByText("前面的回答有变化，请再检查一下这段文字。")).toBeTruthy();
  expect(screen.queryByText(/加入展示|分享|复制/u)).toBeNull();
  expect(screen.getByRole("button", { name: "保存更改" }).props.accessibilityState.disabled).toBe(true);
});

test("edits dirty sections incrementally without promoting private content and restores deleted content as pending", async () => {
  const onSave = jest.fn(async () => undefined);
  renderScreen({ onSave });

  const privateCard = within(screen.getByTestId("communication-draft-card-communication-possible-closeness"));
  fireEvent.press(privateCard.getByRole("button", { name: "编辑" }));
  fireEvent.changeText(screen.getByLabelText("草稿内容：可能愿意的靠近"), "  请先问我。  ");
  fireEvent.press(screen.getByRole("button", { name: "保存编辑" }));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "编辑" })
    .every((button) => button.props.accessibilityState.disabled === false)).toBe(true));

  const deletedCard = within(screen.getByTestId("communication-draft-card-communication-decide-in-moment"));
  fireEvent.press(deletedCard.getByRole("button", { name: "恢复到草稿" }));
  fireEvent.press(screen.getByRole("button", { name: "保存更改" }));

  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  expect(onSave).toHaveBeenCalledWith([
    {
      id: "communication-possible-closeness",
      text: "请先问我。",
      visibility: "private",
    },
    {
      id: "communication-decide-in-moment",
      text: "第 3 段文字",
      visibility: "pending",
    },
  ]);
});

test("lets a legacy blank deleted section be rewritten before safe restoration", async () => {
  const onSave = jest.fn(async () => undefined);
  renderScreen({
    onSave,
    sections: [{
      id: "communication-comfort",
      title: "让我更安心的方式",
      text: "",
      visibility: "deleted",
      needsReview: false,
    }]
  });

  expect(screen.getByText(/旧记录未保存此段内容/u)).toBeTruthy();
  expect(screen.getByRole("button", { name: "恢复到草稿" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "编辑" }));
  fireEvent.changeText(screen.getByLabelText("草稿内容：让我更安心的方式"), "重新写下的内容");
  fireEvent.press(screen.getByRole("button", { name: "保存编辑" }));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "编辑" })
    .every((button) => button.props.accessibilityState.disabled === false)).toBe(true));
  fireEvent.press(screen.getByRole("button", { name: "恢复到草稿" }));
  fireEvent.press(screen.getByRole("button", { name: "保存更改" }));

  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  expect(onSave).toHaveBeenCalledWith([{
    id: "communication-comfort",
    text: "重新写下的内容",
    visibility: "pending",
  }]);
});

test("keeps local dirty updates after a safe save error and retries", async () => {
  const onSave = jest.fn()
    .mockRejectedValueOnce(new Error("private database details"))
    .mockResolvedValueOnce(undefined);
  renderScreen({ onSave });

  const card = within(screen.getByTestId("communication-draft-card-communication-mutual-boundaries"));
  fireEvent.press(card.getByRole("button", { name: "编辑" }));
  fireEvent.changeText(screen.getByLabelText("草稿内容：共同边界"), "请保留我的新边界。");
  fireEvent.press(screen.getByRole("button", { name: "保存编辑" }));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "编辑" })
    .every((button) => button.props.accessibilityState.disabled === false)).toBe(true));
  fireEvent.press(screen.getByRole("button", { name: "保存更改" }));

  expect(await screen.findByText("保存失败，请重试。你的编辑仍保留在当前画面。")).toBeTruthy();
  expect(screen.queryByText(/private database details/u)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "重试保存" })); });
  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  expect(onSave).toHaveBeenCalledTimes(2);
  expect(onSave.mock.calls[1]?.[0]).toEqual([{
    id: "communication-mutual-boundaries",
    text: "请保留我的新边界。",
    visibility: "pending",
  }]);
});

test("keeps keyboard-safe scrolling, theme background, Dynamic Type and 44 point controls", () => {
  const props = renderScreen();

  const scroll = screen.getByTestId("saved-card-edit-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  expect(StyleSheet.flatten(scroll.props.style).backgroundColor).toBe(darkTheme.color.background);
  for (const control of screen.getAllByRole("button")) {
    expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(44);
  }
  for (const text of screen.UNSAFE_getAllByType(Text)) {
    expect(text.props.numberOfLines).toBeUndefined();
  }
  fireEvent.press(screen.getByRole("button", { name: "取消编辑" }));
  expect(props.onCancel).toHaveBeenCalledTimes(1);
});
