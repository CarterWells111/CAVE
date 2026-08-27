import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { loadCatalog } from "@cave/content";

import { selectConfirmedCommunicationCard, type ConfirmedCommunicationCard } from "../../domain/derive-communication-card";
import { createJourneyDraft, type CommunicationSectionId } from "../../domain/types";
import { FinalPreparationPage } from "./FinalPreparationPage";

function draft() {
  const value = createJourneyDraft({ id: "journey-1", now: "now" });
  value.privatePreparation.items = [{
    id: "checklist:expression", category: "expression", sourceIds: [], status: "prepare-more"
  }];
  value.communicationCard["communication-night-expectations"].generatedText = "我期待一起休息。";
  value.communicationCard["communication-comfort"].generatedText = "请先问我。";
  value.communicationCard["communication-not-this-time"].generatedText = "今晚不想做这件事。";
  return value;
}

test("starts all seven sections pending and exposes explicit non-color visibility choices", () => {
  render(<FinalPreparationPage draft={draft()} onCopy={jest.fn()} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={jest.fn()} onSetVisibility={jest.fn()} />);

  expect(screen.getAllByText("待确认")).toHaveLength(7);
  expect(screen.getByText("7 / 7")).toBeTruthy();
  expect(screen.getByRole("button", { name: "加入分享：我对这个夜晚的期待" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "保持私密：我对这个夜晚的期待" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "删除：我对这个夜晚的期待" })).toBeTruthy();
  expect(screen.queryByText("我期待一起休息。", { exact: true })).toBeTruthy();
});

test("uses the confirmed selector for preview, clipboard and image export", async () => {
  const onCopy = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  const onSaveImage = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  render(<FinalPreparationPage draft={draft()} onCopy={onCopy} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={onSaveImage} onSetVisibility={jest.fn()} />);

  fireEvent.press(screen.getByRole("button", { name: "加入分享：我对这个夜晚的期待" }));
  fireEvent.press(screen.getByRole("button", { name: "保持私密：什么会让我更安心" }));
  fireEvent.press(screen.getByRole("button", { name: "删除：这次我不希望发生的事" }));
  fireEvent.press(screen.getByText("预览分享卡"));

  expect(screen.getByTestId("share-preview")).toBeTruthy();
  expect(screen.getByTestId("share-preview")).toHaveTextContent(/我期待一起休息。/u);
  expect(screen.getByTestId("share-preview")).not.toHaveTextContent(/请先问我。/u);
  expect(screen.getByTestId("share-preview")).not.toHaveTextContent(/今晚不想做这件事。/u);

  fireEvent.press(screen.getByText("复制已确认内容"));
  fireEvent.press(screen.getByText("保存为图片"));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(onSaveImage).toHaveBeenCalledTimes(1));
  expect(onCopy.mock.calls[0]?.[0]).toEqual(onSaveImage.mock.calls[0]?.[0]);
  const expectedDraft = draft();
  expectedDraft.communicationCard["communication-night-expectations"].visibility = "included";
  expectedDraft.communicationCard["communication-comfort"].visibility = "private";
  expectedDraft.communicationCard["communication-not-this-time"].visibility = "deleted";
  expect(onCopy.mock.calls[0]?.[0]).toEqual(selectConfirmedCommunicationCard(expectedDraft));
});

test("flushes the latest queued edit before copying", async () => {
  let resolveEdit!: () => void;
  const editPending = new Promise<void>((resolve) => { resolveEdit = resolve; });
  const onEdit = jest.fn<Promise<void>, [CommunicationSectionId, string]>((sectionId, text) => {
    void sectionId;
    void text;
    return editPending;
  });
  const onCopy = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  render(<FinalPreparationPage draft={draft()} onCopy={onCopy} onEdit={onEdit} onFinish={jest.fn()} onSaveImage={jest.fn()} onSetVisibility={jest.fn()} />);

  fireEvent.press(screen.getByRole("button", { name: "加入分享：我对这个夜晚的期待" }));
  fireEvent.press(screen.getByRole("button", { name: "编辑：我对这个夜晚的期待" }));
  fireEvent.changeText(screen.getByLabelText("编辑我对这个夜晚的期待"), "这是最新文字。");
  fireEvent.press(screen.getByText("保存编辑"));
  fireEvent.press(screen.getByText("复制已确认内容"));
  expect(onCopy).not.toHaveBeenCalled();

  await act(async () => { resolveEdit(); });
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
  expect(onCopy.mock.calls[0]?.[0].sections).toContainEqual(expect.objectContaining({ text: "这是最新文字。" }));
});

test("reports copy failure, keeps image export user-triggered and offers handwriting", async () => {
  const onCopy = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; throw new Error("clipboard denied"); });
  const onSaveImage = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  render(<FinalPreparationPage draft={draft()} onCopy={onCopy} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={onSaveImage} onSetVisibility={jest.fn()} />);

  expect(onSaveImage).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("复制已确认内容"));
  expect(await screen.findByText("复制失败，请重试或手写记录。" )).toBeTruthy();
  fireEvent.press(screen.getByText("我想手写"));
  expect(screen.getByText("可以把确认后的内容抄写到纸上；CAVE 不会自动分享。" )).toBeTruthy();
});

test("does not export when a queued visibility write failed", async () => {
  const onCopy = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  const onSetVisibility = jest.fn(async () => { throw new Error("disk full"); });
  render(<FinalPreparationPage draft={draft()} onCopy={onCopy} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={jest.fn()} onSetVisibility={onSetVisibility} />);

  fireEvent.press(screen.getByRole("button", { name: "加入分享：我对这个夜晚的期待" }));
  fireEvent.press(screen.getByText("复制已确认内容"));

  expect(await screen.findByText("保存更改失败，请重试。" )).toBeTruthy();
  expect(onCopy).not.toHaveBeenCalled();
});

test("renders the seven content-owned section titles", () => {
  render(<FinalPreparationPage draft={draft()} onCopy={jest.fn()} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={jest.fn()} onSetVisibility={jest.fn()} />);
  for (const section of loadCatalog().journey.uiCopy.communicationSections) {
    expect(screen.getByText(section.title)).toBeTruthy();
  }
});
