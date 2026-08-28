import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { loadCatalog } from "@cave/content";

import { selectConfirmedCommunicationCard, type ConfirmedCommunicationCard } from "../../domain/derive-communication-card";
import { createJourneyDraft, type CommunicationSectionId } from "../../domain/types";
import { FinalPreparationPage } from "./FinalPreparationPage";

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(async () => "file:///cave-card.png"),
}));

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
  expect(screen.getByText("6 / 6")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "加入分享：我对这个夜晚的期待" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "保持私密：我对这个夜晚的期待" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "删除：我对这个夜晚的期待" })).toBeTruthy();
  expect(screen.queryByText("我期待一起休息。", { exact: true })).toBeTruthy();
  expect(screen.queryByText(/云端同步|后续版本/u)).toBeNull();
});

test("uses the confirmed selector for preview, clipboard and image export", async () => {
  const onCopy = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  const onSaveImage = jest.fn<Promise<void>, [ConfirmedCommunicationCard, string]>(async (card, uri) => { void card; void uri; });
  render(<FinalPreparationPage draft={draft()} onCopy={onCopy} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={onSaveImage} onSetVisibility={jest.fn()} />);

  fireEvent.press(screen.getByRole("radio", { name: "加入分享：我对这个夜晚的期待" }));
  fireEvent.press(screen.getByRole("radio", { name: "保持私密：什么会让我更安心" }));
  fireEvent.press(screen.getByRole("radio", { name: "删除：这次我不希望发生的事" }));
  fireEvent.press(screen.getByText("预览分享卡"));

  expect(screen.getByTestId("share-preview")).toBeTruthy();
  expect(screen.getByTestId("share-preview")).toHaveTextContent(/靠近之前，我想告诉你/u);
  expect(screen.getByTestId("share-preview")).toHaveTextContent(/我期待一起休息。/u);
  expect(screen.getByTestId("share-preview")).not.toHaveTextContent(/请先问我。/u);
  expect(screen.getByTestId("share-preview")).not.toHaveTextContent(/今晚不想做这件事。/u);

  fireEvent.press(screen.getByText("复制已确认内容"));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("已复制。")).toBeTruthy();
  fireEvent.press(screen.getByText("保存为图片"));
  expect(screen.getByText(/图片会进入系统相册/u)).toBeTruthy();
  fireEvent.press(screen.getByText("确认并保存图片"));
  await waitFor(() => expect(onSaveImage).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("图片已保存。")).toBeTruthy();
  expect(onCopy.mock.calls[0]?.[0]).toEqual(onSaveImage.mock.calls[0]?.[0]);
  expect(onSaveImage.mock.calls[0]?.[1]).toBe("file:///cave-card.png");
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

  fireEvent.press(screen.getByRole("radio", { name: "加入分享：我对这个夜晚的期待" }));
  fireEvent.press(screen.getByRole("button", { name: "编辑：我对这个夜晚的期待" }));
  fireEvent.changeText(screen.getByLabelText("编辑我对这个夜晚的期待"), "这是最新文字。");
  fireEvent.press(screen.getByText("保存编辑"));
  fireEvent.press(screen.getByText("复制已确认内容"));
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
  fireEvent.press(screen.getByText("复制已确认内容"));
  expect(await screen.findByText("复制失败，请重试或手写记录。" )).toBeTruthy();
  fireEvent.press(screen.getByText("我想手写"));
  expect(screen.getByText("可以把确认后的内容抄写到纸上；CAVE 不会自动分享。" )).toBeTruthy();
});

test("does not export when a queued visibility write failed", async () => {
  const onCopy = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  const onSetVisibility = jest.fn()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValueOnce(undefined);
  render(<FinalPreparationPage draft={draft()} onCopy={onCopy} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={jest.fn()} onSetVisibility={onSetVisibility} />);

  fireEvent.press(screen.getByRole("radio", { name: "加入分享：我对这个夜晚的期待" }));
  await waitFor(() => expect(onSetVisibility).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText("复制已确认内容"));
  fireEvent.press(screen.getByText("复制已确认内容"));

  expect(await screen.findByText("保存更改失败，请重试。" )).toBeTruthy();
  expect(onCopy).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("radio", { name: "保持私密：我对这个夜晚的期待" }));
  expect(onSetVisibility).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("radio", { name: "加入分享：我对这个夜晚的期待" }).props.accessibilityState)
    .toMatchObject({ selected: true });
  fireEvent.press(screen.getByText("重试保存更改"));
  await waitFor(() => expect(onSetVisibility).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("更改已保存，请再次选择复制或保存。" )).toBeTruthy();
  fireEvent.press(screen.getByText("复制已确认内容"));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
});

test("does not admit new optimistic writes after an output flush has started", async () => {
  let resolveVisibility!: () => void;
  const pendingVisibility = new Promise<void>((resolve) => { resolveVisibility = resolve; });
  const onSetVisibility = jest.fn(() => pendingVisibility);
  const onCopy = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  render(<FinalPreparationPage draft={draft()} onCopy={onCopy} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={jest.fn()} onSetVisibility={onSetVisibility} />);

  fireEvent.press(screen.getByRole("radio", { name: "加入分享：我对这个夜晚的期待" }));
  await waitFor(() => expect(onSetVisibility).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText("复制已确认内容"));
  fireEvent.press(screen.getByText("复制已确认内容"));
  fireEvent.press(screen.getByRole("radio", { name: "加入分享：什么会让我更安心" }));
  expect(onSetVisibility).toHaveBeenCalledTimes(1);

  await act(async () => { resolveVisibility(); });
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
  expect(onCopy.mock.calls[0]?.[0].sections).not.toContainEqual(expect.objectContaining({ id: "communication-comfort" }));
});

test("requires a rendered preview before copy or image export and guards duplicate completion", async () => {
  let resolveFinish!: () => void;
  const pendingFinish = new Promise<void>((resolve) => { resolveFinish = resolve; });
  const onCopy = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  const onSaveImage = jest.fn<Promise<void>, [ConfirmedCommunicationCard]>(async (card) => { void card; });
  const onFinish = jest.fn(() => pendingFinish);
  const onCompleted = jest.fn();
  render(<FinalPreparationPage draft={draft()} onCompleted={onCompleted} onCopy={onCopy} onEdit={jest.fn()} onFinish={onFinish} onSaveImage={onSaveImage} onSetVisibility={jest.fn()} />);

  fireEvent.press(screen.getByText("复制已确认内容"));
  expect(onCopy).not.toHaveBeenCalled();
  expect(screen.getByTestId("share-preview")).toBeTruthy();
  fireEvent.press(screen.getByText("复制已确认内容"));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));

  fireEvent.press(screen.getByText("保存为图片"));
  expect(onSaveImage).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("确认并保存图片"));
  await waitFor(() => expect(onSaveImage).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("图片已保存。")).toBeTruthy();

  fireEvent.press(screen.getByText("完成首次记录"));
  fireEvent.press(screen.getByText("正在完成…"));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  await act(async () => { resolveFinish(); });
  expect(await screen.findByText("首次记录已完成")).toBeTruthy();
  fireEvent.press(screen.getByText("首次记录已完成"));
  expect(onFinish).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole("button", { name: "返回应用入口" }));
  expect(onCompleted).toHaveBeenCalledTimes(1);
});

test("guards duplicate clipboard and image operations while each user action is pending", async () => {
  let resolveCopy!: () => void;
  let resolveImage!: () => void;
  const onCopy = jest.fn(() => new Promise<void>((resolve) => { resolveCopy = resolve; }));
  const onSaveImage = jest.fn(() => new Promise<void>((resolve) => { resolveImage = resolve; }));
  render(<FinalPreparationPage draft={draft()} onCopy={onCopy} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={onSaveImage} onSetVisibility={jest.fn()} />);

  fireEvent.press(screen.getByText("复制已确认内容"));
  fireEvent.press(screen.getByText("复制已确认内容"));
  fireEvent.press(screen.getByText("正在复制…"));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
  await act(async () => { resolveCopy(); });

  fireEvent.press(screen.getByText("保存为图片"));
  expect(screen.getByText("图片会进入系统相册。如果设备开启了相册云同步，它也可能同步到你的云端账户。")).toBeTruthy();
  fireEvent.press(screen.getByText("确认并保存图片"));
  fireEvent.press(screen.getByText("正在保存图片…"));
  await waitFor(() => expect(onSaveImage).toHaveBeenCalledTimes(1));
  await act(async () => { resolveImage(); });
});

test("offers an explicit settings recovery after photo permission is permanently denied", async () => {
  const onOpenImageSettings = jest.fn(async () => undefined);
  const onSaveImage = jest.fn(async () => {
    throw Object.assign(new Error("denied"), { recovery: "open-settings" });
  });
  render(<FinalPreparationPage
    draft={draft()}
    onCopy={jest.fn()}
    onEdit={jest.fn()}
    onFinish={jest.fn()}
    onOpenImageSettings={onOpenImageSettings}
    onSaveImage={onSaveImage}
    onSetVisibility={jest.fn()}
  />);

  fireEvent.press(screen.getByText("保存为图片"));
  fireEvent.press(screen.getByText("确认并保存图片"));
  expect(await screen.findByRole("button", { name: "前往系统设置" })).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "前往系统设置" }));
  await waitFor(() => expect(onOpenImageSettings).toHaveBeenCalledTimes(1));
});

test("offers user-readable private preparation controls and save-for-self", async () => {
  const onSaveDraft = jest.fn(async () => undefined);
  const onUpdatePreparation = jest.fn(async () => undefined);
  render(<FinalPreparationPage draft={draft()} onCopy={jest.fn()} onEdit={jest.fn()} onFinish={jest.fn()} onSaveDraft={onSaveDraft} onSaveImage={jest.fn()} onSetVisibility={jest.fn()} onUpdatePreparation={onUpdatePreparation} />);

  expect(screen.queryByText("checklist:expression")).toBeNull();
  expect(screen.getByText("表达与暂停")).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "表达与暂停：已经想到" }));
  await waitFor(() => expect(onUpdatePreparation).toHaveBeenCalledWith("checklist:expression", "considered"));
  expect(screen.getByRole("radio", { name: "表达与暂停：已经想到" }).props.accessibilityState).toMatchObject({ selected: true });
  fireEvent.press(screen.getByText("保存给自己"));
  await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("已保存当前草稿，不会自动分享。" )).toBeTruthy();
});

test("does not pretend preparation changes persist when no persistence callback is connected", () => {
  render(<FinalPreparationPage draft={draft()} onCopy={jest.fn()} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={jest.fn()} onSetVisibility={jest.fn()} />);

  const choice = screen.getByRole("radio", { name: "表达与暂停：已经想到" });
  expect(choice.props.accessibilityState).toMatchObject({ disabled: true, selected: false });
  fireEvent.press(choice);
  expect(choice.props.accessibilityState).toMatchObject({ selected: false });
});

test("announces the current communication visibility without relying on color", () => {
  const value = draft();
  value.communicationCard["communication-night-expectations"].visibility = "private";
  render(<FinalPreparationPage draft={value} onCopy={jest.fn()} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={jest.fn()} onSetVisibility={jest.fn()} />);

  expect(screen.getByRole("radio", { name: "保持私密：我对这个夜晚的期待" }).props.accessibilityState)
    .toMatchObject({ selected: true });
  expect(screen.getByRole("radio", { name: "加入分享：我对这个夜晚的期待" }).props.accessibilityState)
    .toMatchObject({ selected: false });
});

test("renders the seven content-owned section titles", () => {
  render(<FinalPreparationPage draft={draft()} onCopy={jest.fn()} onEdit={jest.fn()} onFinish={jest.fn()} onSaveImage={jest.fn()} onSetVisibility={jest.fn()} />);
  for (const section of loadCatalog().journey.uiCopy.communicationSections) {
    expect(screen.getByText(section.title)).toBeTruthy();
  }
});
