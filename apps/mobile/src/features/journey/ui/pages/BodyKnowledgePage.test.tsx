import { loadCatalog, type JourneyKnowledgeCard } from "@cave/content";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { BodyKnowledgePage } from "./BodyKnowledgePage";

const cards = [1, 2, 3].map((order) => ({
  id: `card-${order}`, page: 3, contentType: "MED", order,
  title: [`身体反应不等于同意`, `身体与心里的节奏可能不同`, `疼痛不需要成为“第一次”的证明`][order - 1]!,
  body: `知识正文 ${order}`, sourceIds: ["SRC-003"], reviewStatus: "expert_review_pending",
})) as JourneyKnowledgeCard[];

const definition = loadCatalog().journey.uiCopy.bodyKnowledgeDefinition;

test("renders exactly three expanded catalog cards and can continue without opening the optional diagram", async () => {
  const onContinue = jest.fn();
  const onRead = jest.fn();
  render(<BodyKnowledgePage cards={cards} definition={definition} onContinue={onContinue} onRead={onRead} />);
  expect(screen.getAllByTestId(/^body-knowledge-card-/u)).toHaveLength(3);
  for (const card of cards) {
    expect(screen.getByText(card.title)).toBeTruthy();
    expect(screen.getByText(card.body)).toBeTruthy();
  }
  expect(screen.queryByLabelText(/医学图审核稿/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "看看我对过夜的期待" }));
  await waitFor(() => expect(onRead).toHaveBeenCalledTimes(3));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test("announces progress toward overnight expectations while completion is being persisted", async () => {
  let resolveContinue!: () => void;
  const onContinue = jest.fn(() => new Promise<void>((resolve) => { resolveContinue = resolve; }));
  render(<BodyKnowledgePage cards={cards} definition={definition} onContinue={onContinue} />);

  fireEvent.press(screen.getByRole("button", { name: "看看我对过夜的期待" }));
  expect(screen.getByRole("button", { name: "正在继续…" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ busy: true, disabled: true }),
  );

  await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
  resolveContinue();
  await waitFor(() => expect(screen.getByRole("button", { name: "看看我对过夜的期待" })).toBeTruthy());
});

test("waits for persisted consent before showing optional explicit anatomy content", async () => {
  let resolveOpen!: () => void;
  const onOpenDiagram = jest.fn(() => new Promise<void>((resolve) => { resolveOpen = resolve; }));
  render(
    <BodyKnowledgePage
      cards={cards}
      definition={definition}
      diagramSource={{ uri: "medical-review" }}
      onContinue={jest.fn()}
      onOpenDiagram={onOpenDiagram}
    />,
  );
  fireEvent.press(screen.getByRole("button", { name: "查看外阴结构图" }));
  expect(screen.getByText("接下来会显示外阴结构的医学审核图。是否现在查看？")).toBeTruthy();
  expect(screen.queryByLabelText(/阴阜、大阴唇/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "我愿意查看" }));
  expect(onOpenDiagram).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText(/阴阜、大阴唇/u)).toBeNull();
  expect(screen.getByRole("button", { name: "正在记录查看选择…" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ busy: true, disabled: true }),
  );
  resolveOpen();
  await waitFor(() => expect(screen.getByLabelText(/阴阜、大阴唇/u)).toBeTruthy());
  expect(screen.getByLabelText(/阴阜、大阴唇、阴蒂、小阴唇、尿道口、阴道口、肛门/u)).toHaveProp(
    "resizeMode", "contain",
  );
  expect(screen.getByLabelText(/阴阜、大阴唇/u)).toHaveProp("accessibilityRole", "image");
  expect(screen.getByText("医学图审核稿")).toBeTruthy();
  expect(screen.getByText(/就诊前可以询问是否能安排女性医生/u)).toBeTruthy();
});

test("keeps the diagram hidden after a persistence failure and allows an announced retry", async () => {
  const onOpenDiagram = jest.fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(undefined);
  render(
    <BodyKnowledgePage
      cards={cards}
      definition={definition}
      diagramSource={{ uri: "medical-review" }}
      onContinue={jest.fn()}
      onOpenDiagram={onOpenDiagram}
    />,
  );
  fireEvent.press(screen.getByRole("button", { name: "查看外阴结构图" }));
  fireEvent.press(screen.getByRole("button", { name: "我愿意查看" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByText("身体图暂时无法打开，请重试。")).toBeTruthy();
  expect(screen.queryByLabelText(/阴阜、大阴唇/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "我愿意查看" }));
  await waitFor(() => expect(screen.getByLabelText(/阴阜、大阴唇/u)).toBeTruthy());
  expect(onOpenDiagram).toHaveBeenCalledTimes(2);
});

test("offers labelled button-only zoom with bounded state and reset", async () => {
  render(
    <BodyKnowledgePage
      cards={cards}
      definition={definition}
      diagramSource={{ uri: "medical-review" }}
      onContinue={jest.fn()}
      onOpenDiagram={jest.fn()}
      reducedMotion
    />,
  );
  fireEvent.press(screen.getByRole("button", { name: "查看外阴结构图" }));
  fireEvent.press(screen.getByRole("button", { name: "我愿意查看" }));
  await waitFor(() => expect(screen.getByLabelText(/阴阜、大阴唇/u)).toHaveProp(
    "accessibilityValue", expect.objectContaining({ text: "100%" }),
  ));
  expect(screen.getByRole("button", { name: "缩小身体图" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: true }),
  );
  expect(screen.getByRole("button", { name: "重置身体图缩放" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: true }),
  );

  fireEvent.press(screen.getByRole("button", { name: "放大身体图" }));
  expect(screen.getByLabelText(/阴阜、大阴唇/u)).toHaveProp(
    "accessibilityValue", expect.objectContaining({ text: "125%" }),
  );
  expect(screen.getByText("当前缩放：125%")).toHaveProp("accessibilityLiveRegion", "polite");
  expect(screen.getByTestId("body-diagram-viewport")).toHaveProp("zoomScale", 1.25);
  expect(screen.getByRole("button", { name: "缩小身体图" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: false }),
  );

  fireEvent.press(screen.getByRole("button", { name: "重置身体图缩放" }));
  expect(screen.getByLabelText(/阴阜、大阴唇/u)).toHaveProp(
    "accessibilityValue", expect.objectContaining({ text: "100%" }),
  );
});

test("keeps the 100–200% anatomy image in a pannable viewport and retries image loading", async () => {
  render(
    <BodyKnowledgePage
      cards={cards}
      definition={definition}
      diagramSource={{ uri: "medical-review" }}
      onContinue={jest.fn()}
      onOpenDiagram={jest.fn()}
    />,
  );
  fireEvent.press(screen.getByRole("button", { name: "查看外阴结构图" }));
  fireEvent.press(screen.getByRole("button", { name: "我愿意查看" }));
  const image = await screen.findByLabelText(/阴阜、大阴唇/u);
  const viewport = screen.getByTestId("body-diagram-viewport");
  expect(viewport).toHaveProp("maximumZoomScale", 2);
  expect(viewport).toHaveProp("minimumZoomScale", 1);
  expect(viewport).toHaveProp("pinchGestureEnabled", true);
  expect(viewport).toHaveProp("horizontal", true);
  expect(viewport).toHaveProp("zoomScale", 1);
  expect(image.props.style).not.toEqual(expect.arrayContaining([expect.objectContaining({ transform: expect.anything() })]));

  fireEvent(image, "error");
  expect(await screen.findByRole("alert")).toHaveTextContent("身体图加载失败，请重试。");
  fireEvent.press(screen.getByRole("button", { name: "重试加载身体图" }));
  expect(screen.getByLabelText(/阴阜、大阴唇/u)).toBeTruthy();
});

test("shows one official sources entry without catalog metadata or a source drawer", () => {
  const onOpenSources = jest.fn();
  render(
    <BodyKnowledgePage cards={cards} definition={definition} onContinue={jest.fn()} onOpenSources={onOpenSources} />,
  );
  const entry = screen.getByRole("button", { name: "打开内界官网信息来源" });
  expect(entry).toHaveTextContent("查看完整信息来源");
  expect(screen.getAllByText("查看完整信息来源")).toHaveLength(1);
  expect(screen.queryByText("RAINN")).toBeNull();
  expect(screen.queryByText("Vulvovaginal Health")).toBeNull();
  expect(screen.queryByText(/2026-05-31/u)).toBeNull();
  expect(screen.queryByTestId("bottom-sheet-modal")).toBeNull();
  fireEvent.press(entry);
  expect(onOpenSources).toHaveBeenCalledTimes(1);
});

test("reduced motion keeps the consent sheet non-animated", () => {
  render(<BodyKnowledgePage cards={cards} definition={definition} onContinue={jest.fn()} reducedMotion />);
  fireEvent.press(screen.getByRole("button", { name: "查看外阴结构图" }));
  expect(screen.getByTestId("bottom-sheet-modal")).toHaveProp("animationType", "none");
});

test("failed completion remains recoverable", async () => {
  render(<BodyKnowledgePage cards={cards} definition={definition} onContinue={jest.fn().mockRejectedValue(new Error("offline"))} />);
  fireEvent.press(screen.getByRole("button", { name: "看看我对过夜的期待" }));
  await waitFor(() => expect(screen.getByText("暂时无法继续，请重试。")).toBeTruthy());
  expect(screen.getByRole("button", { name: "看看我对过夜的期待" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: false }),
  );
});
