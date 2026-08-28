import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { SavedCardEditScreen } from "./SavedCardEditScreen";

const metadata = {
  id: "card-1",
  title: "沟通草稿",
  dateLabel: "2026 年 8 月 27 日",
  statusLabel: "仅存本机"
};
const sections = [
  { id: "communication-comfort" as const, title: "什么会让我更安心", text: "请先问我。", deleted: false },
  { id: "communication-not-this-time" as const, title: "这次先不要", text: "这次不要接吻。", deleted: true }
];

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

test("shows retained and deleted sections in the same two-column editor", () => {
  renderScreen();
  expect(screen.getByRole("header", { name: "编辑沟通草稿" })).toBeTruthy();
  expect(screen.getByText("保留在沟通草稿中")).toBeTruthy();
  expect(screen.getByText("已从草稿中删除")).toBeTruthy();
  expect(screen.getByText("这次不要接吻。")).toBeTruthy();
  expect(screen.getByText("恢复到草稿")).toBeTruthy();
});

test("edits, restores, and saves the complete draft state", async () => {
  const onSave = jest.fn(async () => undefined);
  const props = renderScreen({ onSave });

  fireEvent.press(screen.getAllByText("编辑")[0]!);
  fireEvent.changeText(screen.getByLabelText("草稿内容：什么会让我更安心"), "  请先问我，再慢一点。  ");
  fireEvent.press(screen.getByText("保存编辑"));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "编辑" })
    .every((button) => button.props.accessibilityState.disabled === false)).toBe(true));
  fireEvent.press(screen.getByText("恢复到草稿"));
  fireEvent.press(screen.getByText("保存更改"));

  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  expect(onSave).toHaveBeenCalledWith([
    expect.objectContaining({ id: "communication-comfort", text: "请先问我，再慢一点。", deleted: false }),
    expect.objectContaining({ id: "communication-not-this-time", deleted: false })
  ]);
  fireEvent.press(screen.getByText("完成编辑"));
  expect(props.onCancel).toHaveBeenCalledTimes(1);
});

test("lets a legacy blank deleted section be rewritten before restoration", async () => {
  renderScreen({
    sections: [{
      id: "communication-comfort",
      title: "什么会让我更安心",
      text: "",
      deleted: true
    }]
  });

  expect(screen.getByText(/旧记录未保存此段内容/u)).toBeTruthy();
  expect(screen.getByRole("button", { name: "恢复到草稿" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByText("编辑"));
  fireEvent.changeText(screen.getByLabelText("草稿内容：什么会让我更安心"), "重新写下的内容");
  fireEvent.press(screen.getByText("保存编辑"));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "编辑" })
    .every((button) => button.props.accessibilityState.disabled === false)).toBe(true));
  fireEvent.press(screen.getByText("恢复到草稿"));
  expect(screen.getByText("保留在沟通草稿中")).toBeTruthy();
});

test("keeps local changes after a safe save error and retries", async () => {
  const onSave = jest.fn()
    .mockRejectedValueOnce(new Error("private database details"))
    .mockResolvedValueOnce(undefined);
  renderScreen({ onSave });
  fireEvent.press(screen.getByText("保存更改"));
  expect(await screen.findByText("保存失败，请重试。你的编辑仍保留在当前画面。")).toBeTruthy();
  expect(screen.queryByText(/private database details/u)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByText("重试保存")); });
  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  expect(onSave).toHaveBeenCalledTimes(2);
});
