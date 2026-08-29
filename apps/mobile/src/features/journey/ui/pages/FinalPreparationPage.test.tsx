import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { loadCatalog } from "@cave/content";
import type { ComponentProps } from "react";
import { AccessibilityInfo } from "react-native";

import { darkTheme as theme } from "../../../../core/design/theme";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import { createJourneyDraft, type CommunicationSectionId } from "../../domain/types";
import { FinalPreparationPage } from "./FinalPreparationPage";

function draft() {
  const value = createJourneyDraft({ id: "journey-1", now: "now" });
  for (const [index, field] of Object.values(value.communicationCard).entries()) {
    field.generatedText = `第${index + 1}段草稿正文。`;
  }
  return value;
}

function renderPage(overrides: Partial<ComponentProps<typeof FinalPreparationPage>> = {}) {
  const props = {
    draft: draft(),
    onEdit: jest.fn(async () => undefined),
    onFinish: jest.fn(async () => "card:journey-1"),
    onSetVisibility: jest.fn(async () => undefined),
    ...overrides,
  };
  render(<FinalPreparationPage {...props} />);
  return props;
}

test("renders all seven draft cards in one column with one private-draft save action", () => {
  renderPage();

  expect(screen.getAllByTestId(/communication-draft-row-/u)).toHaveLength(7);
  expect(screen.queryByText("保留在沟通草稿中")).toBeNull();
  expect(screen.getAllByText("从草稿中删除")).toHaveLength(7);
  expect(screen.getAllByText("编辑")).toHaveLength(7);
  expect(screen.getAllByTestId(/communication-draft-actions-/u)).toHaveLength(7);
  for (const section of loadCatalog().journey.uiCopy.communicationSections) {
    expect(screen.getByText(section.title)).toBeTruthy();
  }

  expect(screen.queryByText("只给自己看的准备")).toBeNull();
  expect(screen.queryByText("逐段确认沟通内容")).toBeNull();
  expect(screen.queryByText("加入分享")).toBeNull();
  expect(screen.queryByText("只留给自己")).toBeNull();
  expect(screen.queryByRole("button", { name: "预览分享卡" })).toBeNull();
  expect(screen.queryByRole("button", { name: "复制已确认内容" })).toBeNull();
  expect(screen.queryByRole("button", { name: "保存为图片" })).toBeNull();
  expect(screen.queryByRole("button", { name: "保存给自己" })).toBeNull();
  expect(screen.queryByRole("button", { name: "我想手写" })).toBeNull();
  expect(screen.getByText("保存后，所有未删除的段落会进入“我的沟通草稿”，只保存在本机。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "保存并查看我的沟通草稿" })).toBeTruthy();
});

test("deletes a card in place, announces the state, and restores it", async () => {
  const onSetVisibility = jest.fn(async () => undefined);
  renderPage({ onSetVisibility });
  const sectionId: CommunicationSectionId = "communication-night-expectations";
  const card = screen.getByTestId(`communication-draft-card-${sectionId}`);

  fireEvent.press(screen.getAllByText("从草稿中删除")[0]!);
  await waitFor(() => expect(onSetVisibility).toHaveBeenCalledWith(sectionId, "deleted"));
  expect(screen.getByText("已从草稿中删除")).toBeTruthy();
  expect(card).toHaveStyle({ backgroundColor: theme.color.disabled });
  expect(screen.getByText("第1段草稿正文。")).toBeTruthy();

  fireEvent.press(screen.getByText("恢复到草稿"));
  await waitFor(() => expect(onSetVisibility).toHaveBeenLastCalledWith(sectionId, "pending"));
  expect(screen.queryByText("保留在沟通草稿中")).toBeNull();
});

test("edits in a bottom sheet and rejects blank text without deleting", async () => {
  const onEdit = jest.fn(async () => undefined);
  renderPage({ onEdit });

  fireEvent.press(screen.getAllByText("编辑")[0]!);
  expect(screen.UNSAFE_getByType(BottomSheet).props).toMatchObject({
    closeLabel: "取消",
    hideHeader: true,
    title: "编辑沟通草稿",
  });
  const input = screen.getByLabelText("草稿内容：我对这个夜晚的期待");
  fireEvent.changeText(input, "   ");
  fireEvent.press(screen.getByText("保存编辑"));
  expect(screen.getByRole("alert")).toHaveTextContent(/内容不能为空/u);
  expect(onEdit).not.toHaveBeenCalled();

  fireEvent.changeText(input, "  更新后的草稿。  ");
  fireEvent.press(screen.getByText("保存编辑"));
  await waitFor(() => expect(onEdit).toHaveBeenCalledWith("communication-night-expectations", "更新后的草稿。"));
  expect(screen.queryByTestId("bottom-sheet-modal")).toBeNull();
  expect(screen.getByText("更新后的草稿。")).toBeTruthy();
});

test("flushes pending edits before saving and guards duplicate completion", async () => {
  let resolveEdit!: () => void;
  const pendingEdit = new Promise<void>((resolve) => { resolveEdit = resolve; });
  const onEdit = jest.fn(() => pendingEdit);
  const onFinish = jest.fn(async () => "card:journey-1");
  renderPage({ onEdit, onFinish });

  fireEvent.press(screen.getAllByText("编辑")[0]!);
  fireEvent.changeText(screen.getByLabelText("草稿内容：我对这个夜晚的期待"), "最新文字");
  fireEvent.press(screen.getByText("保存编辑"));
  const confirmation = screen.getByRole("button", { name: "保存并查看我的沟通草稿" });
  fireEvent.press(confirmation);
  fireEvent.press(confirmation);
  expect(onFinish).not.toHaveBeenCalled();

  await act(async () => { resolveEdit(); });
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
});

test("blocks final save after a failed write and retries the queued change", async () => {
  const onSetVisibility = jest.fn()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValueOnce(undefined);
  const onFinish = jest.fn(async () => "card:journey-1");
  renderPage({ onFinish, onSetVisibility });

  fireEvent.press(screen.getAllByText("从草稿中删除")[0]!);
  expect(await screen.findByText("保存更改失败，请重试。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "保存并查看我的沟通草稿" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  fireEvent.press(screen.getByText("重试保存更改"));
  await waitFor(() => expect(onSetVisibility).toHaveBeenCalledTimes(2));
  fireEvent.press(screen.getByText("保存并查看我的沟通草稿"));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
});

test("blocks an opposite visibility change until the pending write settles", async () => {
  let rejectWrite!: (reason: Error) => void;
  const pendingWrite = new Promise<void>((_resolve, reject) => { rejectWrite = reject; });
  const onSetVisibility = jest.fn()
    .mockImplementationOnce(() => pendingWrite)
    .mockResolvedValueOnce(undefined);
  const onFinish = jest.fn(async () => "card:journey-1");
  renderPage({ onFinish, onSetVisibility });

  fireEvent.press(screen.getAllByText("从草稿中删除")[0]!);
  await waitFor(() => expect(onSetVisibility).toHaveBeenCalledTimes(1));
  const restore = screen.getByRole("button", { name: "恢复到草稿：我对这个夜晚的期待" });
  expect(restore).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  fireEvent.press(restore);
  expect(onSetVisibility).toHaveBeenCalledTimes(1);

  await act(async () => { rejectWrite(new Error("disk full")); });
  expect(await screen.findByText("保存更改失败，请重试。")).toBeTruthy();
  fireEvent.press(screen.getByText("重试保存更改"));
  await waitFor(() => expect(onSetVisibility).toHaveBeenLastCalledWith("communication-night-expectations", "deleted"));
  expect(await screen.findByText("更改已保存。")).toBeTruthy();
  fireEvent.press(screen.getByText("保存并查看我的沟通草稿"));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(screen.getByText("已从草稿中删除")).toBeTruthy();
});

test("allows an empty communication draft to be saved and viewed", async () => {
  const onFinish = jest.fn(async () => "card:journey-1");
  const onSetVisibility = jest.fn(async () => undefined);
  renderPage({ onFinish, onSetVisibility });

  for (let index = 0; index < 7; index += 1) {
    fireEvent.press(screen.getAllByText("从草稿中删除")[0]!);
    await waitFor(() => expect(onSetVisibility).toHaveBeenCalledTimes(index + 1));
    await waitFor(() => expect(screen.getAllByText("已从草稿中删除")).toHaveLength(index + 1));
  }
  expect(screen.getAllByText("已从草稿中删除")).toHaveLength(7);
  fireEvent.press(screen.getByText("保存并查看我的沟通草稿"));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
});

test("keeps the user on 6/6 when saving fails and allows retry", async () => {
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
  const onFinish = jest.fn()
    .mockRejectedValueOnce(new Error("completion failed"))
    .mockResolvedValueOnce("card:journey-1");
  renderPage({ onFinish });

  fireEvent.press(screen.getByText("保存并查看我的沟通草稿"));
  expect(await screen.findByText("保存失败，请重试。")).toBeTruthy();
  expect(announce).toHaveBeenCalledWith("保存失败，请重试。");
  fireEvent.press(screen.getByText("保存并查看我的沟通草稿"));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(2));
  announce.mockRestore();
});
