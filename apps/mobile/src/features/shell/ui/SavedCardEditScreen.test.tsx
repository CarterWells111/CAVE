import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { StyleSheet, Text, TextInput } from "react-native";

import { ThemeProvider } from "../../../core/design/theme-provider";
import { darkTheme, lightTheme, type AppTheme } from "../../../core/design/theme";
import { COMMUNICATION_SECTION_IDS } from "../../journey/domain/types";
import { SavedCardEditScreen } from "./SavedCardEditScreen";

const metadata = {
  id: "card-1",
  title: "沟通卡",
  dateLabel: "2026 年 8 月 27 日",
  statusLabel: "已保存"
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
  visibility: index === 0 ? "included" as const : index === 1 ? "private" as const : index === 2 ? "deleted" as const : "pending" as const,
  needsReview: index === 3,
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function renderScreen(overrides: Partial<ComponentProps<typeof SavedCardEditScreen>> = {}) {
  const props = {
    sections,
    metadata,
    onCancel: jest.fn(),
    onSave: jest.fn(async () => undefined),
    ...overrides
  };
  render(<SavedCardEditScreen {...props} />);
  return props;
}

test("renders all seven sections and their three explicit visibility choices even when none are included", () => {
  renderScreen({
    sections: sections.map((section) => ({ ...section, visibility: "pending" })),
  });

  expect(screen.getByRole("header", { name: "编辑沟通卡" })).toBeTruthy();
  expect(screen.UNSAFE_getAllByType(TextInput)).toHaveLength(7);
  expect(screen.getAllByRole("radio")).toHaveLength(21);
  expect(screen.getAllByText("尚未决定")).toHaveLength(7);
  expect(screen.queryByText(/没有可编辑/u)).toBeNull();
});

test("shows review state and marks the selected visibility with radio semantics", () => {
  renderScreen();

  expect(screen.getByText("内容已变化，需要重新确认")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "加入展示：对这次相处的期待" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ checked: true, selected: true }));
  expect(screen.getByRole("radio", { name: "只留给自己：可能愿意的靠近" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ checked: true, selected: true }));
  expect(screen.getByRole("radio", { name: "删除这一段：希望当下再决定" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ checked: true, selected: true }));
});

test("blocks blank visible content but permits a blank deleted section", async () => {
  const props = renderScreen();
  fireEvent.changeText(screen.getByLabelText("编辑：对这次相处的期待"), "   ");
  fireEvent.press(screen.getByRole("button", { name: "保存沟通卡" }));

  expect(props.onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(/对这次相处的期待.*不能为空/u);

  fireEvent.press(screen.getByRole("radio", { name: "删除这一段：对这次相处的期待" }));
  fireEvent.press(screen.getByRole("button", { name: "保存沟通卡" }));

  expect(props.onSave).toHaveBeenCalledWith([{
    id: "communication-night-expectations",
    text: "",
    visibility: "deleted",
  }]);
  expect(await screen.findByText("更改已保存。")).toBeTruthy();
});

test("saves only dirty sections after persistence resolves and reports success", async () => {
  const saving = deferred();
  const onSave = jest.fn(() => saving.promise);
  const props = renderScreen({ onSave });
  fireEvent.changeText(screen.getByLabelText("编辑：让我更安心的方式"), "  请先问我，再慢一点。  ");
  fireEvent.press(screen.getByRole("radio", { name: "加入展示：可能愿意的靠近" }));

  const save = screen.getByRole("button", { name: "保存沟通卡" });
  fireEvent.press(save);
  fireEvent.press(save);

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith([
    {
      id: "communication-possible-closeness",
      text: "第 2 段文字",
      visibility: "included",
    },
    {
      id: "communication-comfort",
      text: "请先问我，再慢一点。",
      visibility: "pending",
    },
  ]);
  expect(screen.getByRole("button", { name: "正在保存更改…" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ busy: true, disabled: true }));
  expect(screen.getByRole("button", { name: "取消编辑" }).props.accessibilityState.disabled).toBe(true);

  await act(async () => { saving.resolve(); });
  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "完成编辑" }));
  expect(props.onCancel).toHaveBeenCalledTimes(1);
});

test("returns to editing controls when content changes after a successful save", async () => {
  const props = renderScreen();
  fireEvent.changeText(screen.getByLabelText("编辑：共同边界"), "第一次保存的边界");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "保存沟通卡" }));
  });
  expect(await screen.findByText("更改已保存。")).toBeTruthy();

  fireEvent.changeText(screen.getByLabelText("编辑：让我更安心的方式"), "第二次修改");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "保存沟通卡" }));
  });

  expect(props.onSave).toHaveBeenCalledTimes(2);
  expect(props.onSave).toHaveBeenLastCalledWith([{
    id: "communication-comfort",
    text: "第二次修改",
    visibility: "pending",
  }]);
});

test("keeps edits after a safe save error and retries the same dirty updates", async () => {
  const onSave = jest.fn()
    .mockRejectedValueOnce(new Error("private database details"))
    .mockResolvedValueOnce(undefined);
  renderScreen({ onSave });
  fireEvent.changeText(screen.getByLabelText("编辑：共同边界"), "请保留我的新边界。");
  fireEvent.press(screen.getByRole("button", { name: "保存沟通卡" }));

  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("保存失败，请重试。你的编辑仍保留在当前画面。")).toBeTruthy();
  expect(screen.queryByText(/private database details/u)).toBeNull();
  expect(screen.getByLabelText("编辑：共同边界")).toHaveProp("value", "请保留我的新边界。");
  fireEvent.press(screen.getByRole("button", { name: "重试保存" }));

  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  expect(onSave).toHaveBeenCalledTimes(2);
  expect(onSave.mock.calls[1]?.[0]).toEqual([{
    id: "communication-mutual-boundaries",
    text: "请保留我的新边界。",
    visibility: "pending",
  }]);
});

test("supports keyboard-safe scrolling, Dynamic Type and 44 point controls", () => {
  const props = renderScreen();

  const scroll = screen.getByTestId("saved-card-edit-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  for (const control of screen.getAllByRole(/button|radio/u)) {
    expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(44);
  }
  for (const input of screen.UNSAFE_getAllByType(TextInput)) {
    expect(StyleSheet.flatten(input.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(input.props.multiline).toBe(true);
  }
  for (const text of screen.UNSAFE_getAllByType(Text)) {
    expect(text.props.numberOfLines).toBeUndefined();
  }
  fireEvent.press(screen.getByRole("button", { name: "取消编辑" }));
  expect(props.onCancel).toHaveBeenCalledTimes(1);
});

test.each([darkTheme, lightTheme])("uses the $name theme for the page background and controls", async (theme: AppTheme) => {
  render(
    <ThemeProvider repository={{ load: async () => theme.name, save: async () => undefined }}>
      <SavedCardEditScreen metadata={metadata} onCancel={jest.fn()} onSave={jest.fn()} sections={sections} />
    </ThemeProvider>,
  );

  await screen.findByRole("header", { name: "编辑沟通卡" });
  expect(StyleSheet.flatten(screen.getByTestId("saved-card-edit-scroll").props.style).backgroundColor)
    .toBe(theme.color.background);
  expect(screen.getByLabelText("编辑：对这次相处的期待")).toHaveStyle({
    backgroundColor: theme.color.surfaceMuted,
    color: theme.color.text,
  });
});
