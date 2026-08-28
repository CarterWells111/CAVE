import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { StyleSheet, Text, TextInput } from "react-native";

import { SavedCardEditScreen } from "./SavedCardEditScreen";

const metadata = {
  id: "card-1",
  title: "过夜前想说的话",
  dateLabel: "2026 年 8 月 27 日",
  statusLabel: "已保存"
};
const confirmedSections = [
  { id: "comfort", title: "什么会让我更安心", text: "请先问我。", privateText: "PRIVATE" },
  { id: "boundaries", title: "这次先不要", text: "这次不要接吻。", deletedText: "DELETED" }
];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function renderScreen(overrides: Partial<ComponentProps<typeof SavedCardEditScreen>> = {}) {
  const props = {
    confirmedSections,
    metadata,
    onCancel: jest.fn(),
    onSave: jest.fn(async () => undefined),
    ...overrides
  };
  render(<SavedCardEditScreen {...props} />);
  return props;
}

test("edits only the explicitly supplied included sections without rendering extra private data", () => {
  renderScreen();

  expect(screen.getByRole("header", { name: "编辑过夜前想说的话" })).toBeTruthy();
  expect(screen.getByText(`${metadata.dateLabel} · ${metadata.statusLabel}`)).toBeTruthy();
  expect(screen.getByLabelText("编辑：什么会让我更安心")).toHaveProp("value", "请先问我。");
  expect(screen.getByLabelText("编辑：这次先不要")).toHaveProp("value", "这次不要接吻。");
  expect(screen.queryByText(/PRIVATE|DELETED/u)).toBeNull();
});

test("blocks blank included content with a visible per-section validation error", () => {
  const props = renderScreen();
  fireEvent.changeText(screen.getByLabelText("编辑：什么会让我更安心"), "   ");

  fireEvent.press(screen.getByRole("button", { name: "保存更改" }));

  expect(props.onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(/什么会让我更安心.*不能为空/u);
  expect(screen.getByLabelText("编辑：什么会让我更安心")).toHaveProp(
    "accessibilityHint",
    "此段不能为空。"
  );
});

test("saves trimmed updated sections and reports success only after persistence resolves", async () => {
  const saving = deferred();
  const onSave = jest.fn(() => saving.promise);
  const props = renderScreen({ onSave });
  fireEvent.changeText(screen.getByLabelText("编辑：什么会让我更安心"), "  请先问我，再慢一点。  ");

  const save = screen.getByRole("button", { name: "保存更改" });
  fireEvent.press(save);
  fireEvent.press(save);

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith([
    { id: "comfort", title: "什么会让我更安心", text: "请先问我，再慢一点。" },
    { id: "boundaries", title: "这次先不要", text: "这次不要接吻。" }
  ]);
  expect(screen.getByRole("button", { name: "正在保存更改…" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ busy: true, disabled: true }));
  expect(screen.getByRole("button", { name: "取消编辑" }).props.accessibilityState.disabled).toBe(true);
  expect(screen.queryByText("更改已保存。")).toBeNull();

  await act(async () => { saving.resolve(); });
  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "完成编辑" }));
  expect(props.onCancel).toHaveBeenCalledTimes(1);
});

test("keeps edits after a safe save error and retries the same current values", async () => {
  const onSave = jest.fn()
    .mockRejectedValueOnce(new Error("private database details"))
    .mockResolvedValueOnce(undefined);
  renderScreen({ onSave });
  fireEvent.changeText(screen.getByLabelText("编辑：这次先不要"), "请保留我的新边界。");
  fireEvent.press(screen.getByRole("button", { name: "保存更改" }));

  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("保存失败，请重试。你的编辑仍保留在当前画面。")).toBeTruthy();
  expect(screen.queryByText(/private database details/u)).toBeNull();
  expect(screen.getByLabelText("编辑：这次先不要")).toHaveProp("value", "请保留我的新边界。");
  fireEvent.press(screen.getByRole("button", { name: "重试保存" }));

  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  expect(onSave).toHaveBeenCalledTimes(2);
  expect(onSave.mock.calls[1]?.[0]).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "boundaries", text: "请保留我的新边界。" })
  ]));
});

test("supports keyboard-safe scrolling, Dynamic Type and 44 point controls", () => {
  const props = renderScreen();

  const scroll = screen.getByTestId("saved-card-edit-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
  expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  for (const control of screen.getAllByRole("button")) {
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
