import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler, Dimensions, Image, Linking, StyleSheet } from "react-native";

import { SAMPLE_JOURNEYS } from "../catalog";
import { SampleJourneyScreen } from "./sample-journey-screen";

const first = SAMPLE_JOURNEYS[0]!;
const second = SAMPLE_JOURNEYS[1]!;
const next = () => fireEvent.press(screen.getByRole("button", { name: "下一页" }));

it("prefetches the existing diagram before the reader chooses to reveal it", () => {
  const resolveAsset = jest.spyOn(Image, "resolveAssetSource").mockReturnValue({
    uri: "https://example.test/diagram.png", width: 1600, height: 900, scale: 1,
  });
  const prefetch = jest.spyOn(Image, "prefetch").mockResolvedValue(true);
  try {
    render(<SampleJourneyScreen journey={first} onExit={jest.fn()} />);
    expect(prefetch).toHaveBeenCalledWith("https://example.test/diagram.png");
    expect(screen.queryByTestId("journey-01-diagram-viewport")).toBeNull();
  } finally {
    prefetch.mockRestore();
    resolveAsset.mockRestore();
  }
});

it("offers a gentle reveal for the numbered diagram while keeping Chinese descriptions visible", () => {
  const exit = jest.fn();
  render(<SampleJourneyScreen journey={first} onExit={exit} />);
  expect(screen.getByLabelText("第 1 页，共 3 页")).toBeTruthy();
  expect(screen.getByText(first.pages[0].body)).toHaveProp("selectable", true);
  expect(screen.getByText("身体知识 · 待专业复核")).toBeTruthy();
  expect(screen.getByText("温馨提示｜外阴结构图")).toBeTruthy();
  expect(screen.queryByTestId("journey-01-diagram-viewport")).toBeNull();
  expect(screen.queryByText("想认识自己的外阴？")).toBeNull();
  expect(screen.getByRole("button", { name: "确认点开" })).toBeTruthy();
  expect(screen.queryByText("可选，不查看也可以继续")).toBeNull();
  for (const [index, name] of ["阴阜", "大阴唇", "阴蒂", "小阴唇", "尿道口", "阴道口", "肛门"].entries()) {
    expect(screen.getByLabelText(`${index + 1} ${name}`)).toBeTruthy();
  }
  expect(screen.getByText("通往体内阴道的开口。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "确认点开" }));
  expect(screen.getByText("想认识自己的外阴？")).toBeTruthy();
  expect(screen.getByRole("button", { name: "查看英文参考：NHS 外阴自我观察指南" })).toBeTruthy();
  expect(screen.getByText("结构图正在加载…")).toBeTruthy();
  expect(screen.getByLabelText(/外阴结构示意图，数字 1 至 7/u)).toBeTruthy();
  expect(screen.queryByTestId("journey-01-line-tail-1")).toBeNull();
  fireEvent(screen.getByTestId("journey-01-diagram"), "load");
  expect(screen.queryByText("结构图正在加载…")).toBeNull();
  for (const number of [2, 4]) {
    const style = StyleSheet.flatten(screen.getByTestId(`journey-01-line-tail-${number}`).props.style);
    expect(style.left).toBe(0);
    expect(style.width).toBeGreaterThan(0);
  }
  for (const number of [1, 3, 5, 6, 7]) {
    const style = StyleSheet.flatten(screen.getByTestId(`journey-01-line-tail-${number}`).props.style);
    expect(style.left).toBeGreaterThan(0);
    expect(style.width).toBeGreaterThan(0);
  }
  fireEvent.press(screen.getByRole("button", { name: "隐藏图片" }));
  expect(screen.queryByTestId("journey-01-diagram-viewport")).toBeNull();
  expect(screen.queryByRole("button", { name: "返回上一页" })).toBeNull();
  next();
  expect(screen.getByLabelText("第 2 页，共 3 页")).toBeTruthy();
  expect(screen.getByText(first.pages[1].body)).toHaveProp("selectable", true);
  expect(screen.getByText("外阴与阴道健康")).toBeTruthy();
  next();
  expect(screen.getByLabelText("第 3 页，共 3 页")).toBeTruthy();
  expect(screen.getByText(first.pages[2].body)).toHaveProp("selectable", true);
  expect(screen.getByRole("button", { name: "阅读中文译述：身体反应与我的选择" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "下一页" })).toBeNull();
  expect(exit).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "返回地图" }));
  expect(exit).toHaveBeenCalledTimes(1);
});

it("keeps the central diagram crop within the screen width after rotation", () => {
  const original = Dimensions.get("window");
  act(() => Dimensions.set({ window: { ...original, width: 390, height: 844 } }));
  const view = render(<SampleJourneyScreen journey={first} onExit={jest.fn()} />);
  try {
    fireEvent.press(screen.getByRole("button", { name: "确认点开" }));
    const portraitViewport = StyleSheet.flatten(screen.getByTestId("journey-01-diagram-viewport").props.style);
    const portraitImage = StyleSheet.flatten(screen.getByTestId("journey-01-diagram").props.style);
    expect(portraitImage.width).toBeGreaterThan(portraitViewport.width);
    expect(portraitViewport.height / portraitViewport.width).toBeCloseTo(800 / 690);
    expect(portraitViewport.overflow).toBe("hidden");

    act(() => Dimensions.set({ window: { ...original, width: 844, height: 390 } }));
    const landscapeViewport = StyleSheet.flatten(screen.getByTestId("journey-01-diagram-viewport").props.style);
    const landscapeImage = StyleSheet.flatten(screen.getByTestId("journey-01-diagram").props.style);
    expect(landscapeViewport.width).toBeGreaterThan(portraitViewport.width);
    expect(landscapeViewport.width).toBeLessThanOrEqual(480);
    expect(landscapeImage.width).toBeGreaterThan(portraitImage.width);
    expect(landscapeViewport.height / landscapeViewport.width).toBeCloseTo(800 / 690);
  } finally {
    view.unmount();
    act(() => Dimensions.set({ window: original }));
  }
});

it("shows a retry action if the diagram cannot load", () => {
  render(<SampleJourneyScreen journey={first} onExit={jest.fn()} />);
  fireEvent.press(screen.getByRole("button", { name: "确认点开" }));
  fireEvent(screen.getByTestId("journey-01-diagram"), "error");
  expect(screen.getByRole("alert")).toHaveTextContent("图片加载失败，请重试。");
  fireEvent.press(screen.getByRole("button", { name: "重试加载图片" }));
  expect(screen.getByText("结构图正在加载…")).toBeTruthy();
  fireEvent(screen.getByTestId("journey-01-diagram"), "load");
  expect(screen.getByTestId("journey-01-line-tail-1")).toBeTruthy();
});

it("opens the 02 Chinese site overview and 03 Chinese site reading from journey 01", () => {
  const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  try {
    render(<SampleJourneyScreen journey={first} onExit={jest.fn()} />);
    next();
    fireEvent.press(screen.getByRole("button", {
      name: "阅读中文简述：外阴与阴道健康\n参考自美国妇产科医师学会（ACOG）的患者资料",
    }));
    expect(openUrl).toHaveBeenCalledWith(first.pages[1].article?.url);
    next();
    fireEvent.press(screen.getByRole("button", { name: "阅读中文译述：身体反应与我的选择" }));
    expect(openUrl).toHaveBeenCalledWith("https://neijiecave.com/body-response/");
  } finally {
    openUrl.mockRestore();
  }
});

it("lets readers open 02 cards independently and continue without opening them all", () => {
  render(<SampleJourneyScreen journey={second} onExit={jest.fn()} />);
  expect(screen.getByText("亲密方式 · 待专业复核")).toBeTruthy();
  expect(screen.getByText("亲密没有固定顺序")).toBeTruthy();
  next();
  expect(screen.getByText("认识不同的亲密方式")).toBeTruthy();
  expect(screen.getByRole("button", { name: "独自探索，可选，展开" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "肛门纳入，展开补充，展开" })).toBeTruthy();
  expect(screen.queryByText(second.pages[1].cards?.[2]?.body ?? "missing")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "手指触碰外阴，展开" }));
  expect(screen.getByText(second.pages[1].cards?.[2]?.body ?? "missing")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "手指触碰外阴，收起" }));
  expect(screen.queryByText(second.pages[1].cards?.[2]?.body ?? "missing")).toBeNull();
  expect(screen.getByText("任何时候、出于任何原因，都可以暂停或停止。")).toBeTruthy();
  next();
  expect(screen.getByText("选择可以留给自己")).toBeTruthy();
  expect(screen.queryByTestId("journey-01-diagram-viewport")).toBeNull();
});

it("returns one page at a time without exiting or retaining a completion state", () => {
  const exit = jest.fn();
  render(<SampleJourneyScreen journey={first} onExit={exit} />);
  next();
  next();
  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  expect(screen.getByLabelText("第 2 页，共 3 页")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  expect(screen.getByLabelText("第 1 页，共 3 页")).toBeTruthy();
  expect(exit).not.toHaveBeenCalled();
});

it.each([1, 2, 3])("exits from page %i", (page) => {
  const exit = jest.fn();
  render(<SampleJourneyScreen journey={first} onExit={exit} />);
  for (let index = 1; index < page; index += 1) next();
  fireEvent.press(screen.getByRole("button", { name: "退出旅程" }));
  expect(exit).toHaveBeenCalledTimes(1);
});

it("resets to page one when the journey id changes, including when switching back", () => {
  const exit = jest.fn();
  const view = render(<SampleJourneyScreen journey={first} onExit={exit} />);
  next();
  next();
  view.rerender(<SampleJourneyScreen journey={second} onExit={exit} />);
  expect(screen.getByLabelText("第 1 页，共 3 页")).toBeTruthy();
  expect(screen.getByText(second.title)).toBeTruthy();
  expect(screen.queryByText(first.title)).toBeNull();
  next();
  view.rerender(<SampleJourneyScreen journey={first} onExit={exit} />);
  expect(screen.getByLabelText("第 1 页，共 3 页")).toBeTruthy();
});

it("starts fresh on a later entry to the same journey", () => {
  const view = render(<SampleJourneyScreen journey={first} onExit={jest.fn()} />);
  next();
  view.unmount();
  render(<SampleJourneyScreen journey={first} onExit={jest.fn()} />);
  expect(screen.getByLabelText("第 1 页，共 3 页")).toBeTruthy();
});

it("consumes hardware back, goes to the previous page, then exits at page one, and removes listeners", () => {
  let hardwareBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
  const remove = jest.fn();
  const listener = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    hardwareBack = handler;
    return { remove };
  });
  try {
    const exit = jest.fn();
    const view = render(<SampleJourneyScreen journey={first} onExit={exit} />);
    next();
    next();
    act(() => { expect(hardwareBack?.({ type: "hardwareBackPress", timeStamp: 0 })).toBe(true); });
    expect(screen.getByLabelText("第 2 页，共 3 页")).toBeTruthy();
    act(() => { expect(hardwareBack?.({ type: "hardwareBackPress", timeStamp: 0 })).toBe(true); });
    expect(screen.getByLabelText("第 1 页，共 3 页")).toBeTruthy();
    act(() => { expect(hardwareBack?.({ type: "hardwareBackPress", timeStamp: 0 })).toBe(true); });
    expect(exit).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(remove).toHaveBeenCalledTimes(listener.mock.calls.length);
  } finally {
    listener.mockRestore();
  }
});

it("uses the scrolling core page shell with a visible progress header at large fonts", () => {
  const original = Dimensions.get("window");
  act(() => Dimensions.set({ window: { ...original, width: 320, fontScale: 2.5 } }));
  const view = render(<SampleJourneyScreen journey={first} onExit={jest.fn()} />);
  try {
    expect(screen.getByTestId("sample-journey-scroll")).toHaveProp("horizontal", false);
    expect(screen.getByTestId("screen-fixed-header")).toBeTruthy();
    expect(screen.getByText(first.pages[0].body).props.numberOfLines).toBeUndefined();
    const style = StyleSheet.flatten(screen.getByRole("button", { name: "下一页" }).props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.flexWrap).toBe("wrap");
  } finally {
    view.unmount();
    act(() => Dimensions.set({ window: original }));
  }
});


it("omits the question-mark help on every sample journey page", () => {
  const exit = jest.fn();
  render(<SampleJourneyScreen journey={second} onExit={exit} />);
  for (let index = 0; index < second.pages.length; index += 1) {
    const page = second.pages[index]!;
    expect(screen.getByText(page.body)).toBeTruthy();
    expect(screen.queryByRole("button", { name: `${page.title}，帮助` })).toBeNull();
    if (index < second.pages.length - 1) next();
  }
  expect(exit).not.toHaveBeenCalled();
});
