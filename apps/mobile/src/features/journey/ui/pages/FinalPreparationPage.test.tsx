import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { loadCatalog } from "@cave/content";
import type { ComponentProps } from "react";

import { darkTheme as theme } from "../../../../core/design/theme";
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
    ...overrides
  };
  render(<FinalPreparationPage {...props} />);
  return props;
}

test("renders all seven default-retained drafts in four fixed two-column rows", () => {
  renderPage();

  expect(screen.queryByText("7 / 7")).toBeNull();
  expect(screen.getAllByText("保留在沟通草稿中")).toHaveLength(7);
  expect(screen.getAllByText("从草稿中删除")).toHaveLength(7);
  expect(screen.getAllByText("编辑")).toHaveLength(7);
  expect(screen.getAllByTestId(/communication-draft-row-/u)).toHaveLength(4);
  for (const section of loadCatalog().journey.uiCopy.communicationSections) {
    expect(screen.getByText(section.title)).toBeTruthy();
  }
  expect(screen.queryByText("只给自己看的准备")).toBeNull();
  expect(screen.queryByText(/加入分享|保存为图片|复制已确认|全屏展示/u)).toBeNull();
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
  await waitFor(() => expect(onSetVisibility).toHaveBeenLastCalledWith(sectionId, "included"));
  expect(screen.getAllByText("保留在沟通草稿中")).toHaveLength(7);
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
