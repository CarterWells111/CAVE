import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { loadCatalog } from "@cave/content";
import type { ComponentProps } from "react";

import { darkTheme as theme } from "../../../../core/design/theme";
import { createJourneyDraft, type CommunicationSectionId } from "../../domain/types";
import { FinalPreparationPage } from "./FinalPreparationPage";

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(async () => "file:///local/export.png"),
}));

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
    ...overrides
  };
  render(<FinalPreparationPage {...props} />);
  return props;
}

test("renders all seven v4 pending drafts and their explicit confirmation controls", () => {
  renderPage();

  expect(screen.queryByText("7 / 7")).toBeNull();
  expect(screen.getAllByText("待确认")).toHaveLength(7);
  expect(screen.getAllByText("从草稿中删除")).toHaveLength(7);
  expect(screen.getAllByText("编辑")).toHaveLength(7);
  expect(screen.getAllByTestId(/communication-draft-row-/u)).toHaveLength(4);
  for (const section of loadCatalog().journey.uiCopy.communicationSections) {
    expect(screen.getAllByText(section.title).length).toBeGreaterThan(0);
  }
  expect(screen.getByText("只给自己看的准备")).toBeTruthy();
  expect(screen.getByText("只给自己的回答")).toBeTruthy();
  expect(screen.getByText("表达句")).toBeTruthy();
  expect(screen.getByText("安心需要")).toBeTruthy();
  expect(screen.getByText("条件式健康准备")).toBeTruthy();
  expect(screen.getByText("事后照顾")).toBeTruthy();
  expect(screen.getAllByText("加入分享")).toHaveLength(7);
});

test("restores private preparation, per-section confirmation, warm preview, and explicit export entry points", () => {
  const value = draft();
  value.privatePreparation.items = [{
    id: "checklist:expression",
    category: "expression",
    sourceIds: [],
    status: "prepare-more",
  }];
  renderPage({ draft: value });

  expect(screen.getByText("只给自己看的准备")).toBeTruthy();
  expect(screen.getByText("表达与暂停")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "加入分享：我对这个夜晚的期待" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "预览分享卡" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "复制已确认内容" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "保存为图片" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "保存给自己" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "我想手写" })).toBeTruthy();
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
  expect(screen.getAllByText("待确认")).toHaveLength(7);
});

test("requires explicit confirmation before writing an immutable preview snapshot to the clipboard", async () => {
  const onCopy = jest.fn<Promise<void>, [Parameters<NonNullable<ComponentProps<typeof FinalPreparationPage>["onCopy"]>>[0]]>(async () => undefined);
  const value = draft();
  value.communicationCard["communication-night-expectations"].visibility = "included";
  renderPage({ draft: value, onCopy });

  fireEvent.press(screen.getByRole("button", { name: "复制已确认内容" }));
  expect(onCopy).not.toHaveBeenCalled();
  expect(screen.getByText(/复制会写入系统剪贴板/u)).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "确认复制到剪贴板" }));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
  expect(Object.isFrozen(onCopy.mock.calls[0]![0])).toBe(true);
});

test("uses the same frozen snapshot for preview, copy, and PNG save until content changes", async () => {
  const onCopy = jest.fn<Promise<void>, [Parameters<NonNullable<ComponentProps<typeof FinalPreparationPage>["onCopy"]>>[0]]>(async () => undefined);
  const onSaveImage = jest.fn<Promise<void>, [Parameters<NonNullable<ComponentProps<typeof FinalPreparationPage>["onSaveImage"]>>[0], string]>(async () => undefined);
  const value = draft();
  value.communicationCard["communication-night-expectations"].visibility = "included";
  renderPage({ draft: value, onCopy, onSaveImage });

  fireEvent.press(screen.getByRole("button", { name: "预览分享卡" }));
  fireEvent.press(screen.getByRole("button", { name: "复制已确认内容" }));
  fireEvent.press(screen.getByRole("button", { name: "确认复制到剪贴板" }));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));

  fireEvent.press(screen.getByRole("button", { name: "保存为图片" }));
  fireEvent.press(screen.getByRole("button", { name: "确认并保存图片" }));
  await waitFor(() => expect(onSaveImage).toHaveBeenCalledTimes(1));
  expect(onSaveImage.mock.calls[0]![0]).toBe(onCopy.mock.calls[0]![0]);
  expect(Object.isFrozen(onSaveImage.mock.calls[0]![0])).toBe(true);
});

test("edits in a bottom sheet and rejects blank text without deleting", async () => {
  const onEdit = jest.fn(async () => undefined);
  renderPage({ onEdit });

  fireEvent.press(screen.getAllByText("编辑")[0]!);
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

test("returns an included section to pending when its text is edited", async () => {
  const value = draft();
  const sectionId: CommunicationSectionId = "communication-night-expectations";
  value.communicationCard[sectionId].visibility = "included";
  const onEdit = jest.fn(async () => undefined);
  renderPage({ draft: value, onEdit });

  fireEvent.press(screen.getAllByText("编辑")[0]!);
  fireEvent.changeText(screen.getByLabelText("草稿内容：我对这个夜晚的期待"), "新的确认文字");
  fireEvent.press(screen.getByText("保存编辑"));

  await waitFor(() => expect(onEdit).toHaveBeenCalledWith(sectionId, "新的确认文字"));
  expect(screen.getAllByText("待确认")).toHaveLength(7);
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
  fireEvent.press(screen.getByText("保存沟通草稿"));
  expect(onFinish).not.toHaveBeenCalled();

  await act(async () => { resolveEdit(); });
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("沟通草稿已保存到本机。")).toBeTruthy();
});

test("blocks completion after a failed write and retries the queued change", async () => {
  const onSetVisibility = jest.fn()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValueOnce(undefined);
  const onFinish = jest.fn(async () => "card:journey-1");
  renderPage({ onFinish, onSetVisibility });

  fireEvent.press(screen.getAllByText("从草稿中删除")[0]!);
  expect(await screen.findByText("保存更改失败，请重试。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "保存沟通草稿" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByText("重试保存更改"));
  await waitFor(() => expect(onSetVisibility).toHaveBeenCalledTimes(2));
  fireEvent.press(screen.getByText("保存沟通草稿"));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
});

test("allows an empty communication draft", async () => {
  const onFinish = jest.fn(async () => "card:journey-1");
  renderPage({ onFinish });

  for (let index = 0; index < 7; index += 1) {
    fireEvent.press(screen.getAllByText("从草稿中删除")[0]!);
  }
  expect(screen.getAllByText("已从草稿中删除")).toHaveLength(7);
  fireEvent.press(screen.getByText("保存沟通草稿"));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
});
