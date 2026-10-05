import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler, Dimensions, Linking, StyleSheet } from "react-native";

import { SAMPLE_JOURNEYS } from "../catalog";
import { SampleJourneyScreen } from "./sample-journey-screen";

const first = SAMPLE_JOURNEYS[0]!;
const second = SAMPLE_JOURNEYS[1]!;
const next = () => fireEvent.press(screen.getByRole("button", { name: "下一页" }));

it("offers a gentle reveal for the numbered diagram while keeping Chinese descriptions visible", () => {
  const exit = jest.fn();
  render(<SampleJourneyScreen journey={first} onExit={exit} />);
  expect(screen.getByLabelText("第 1 页，共 3 页")).toBeTruthy();
  expect(screen.getByText(first.pages[0].body)).toHaveProp("selectable", true);
  expect(screen.getByText("身体知识 · 待专业复核")).toBeTruthy();
  expect(screen.getByText("温馨提示｜外阴结构图")).toBeTruthy();
  expect(screen.queryByTestId("journey-01-diagram-viewport")).toBeNull();
  expect(screen.getByRole("button", { name: "确认点开" })).toBeTruthy();
  expect(screen.queryByText("可选，不查看也可以继续")).toBeNull();
  for (const name of ["阴阜", "大阴唇", "阴蒂", "小阴唇", "尿道口", "阴道口", "肛门"]) {
    expect(screen.getByText(new RegExp(`^[1-7] ${name}$`, "u"))).toBeTruthy();
  }
  expect(screen.getByText("通往体内阴道的开口。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "确认点开" }));
  expect(screen.getByLabelText(/外阴结构示意图，数字 1 至 7/u)).toBeTruthy();
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

it("keeps 02 as a framework preview without the body diagram", () => {
  render(<SampleJourneyScreen journey={second} onExit={jest.fn()} />);
  expect(screen.getByText("样板 · 框架预览")).toBeTruthy();
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


it("preview help preserves the selected page and keeps educational content visible", () => {
  const exit = jest.fn();
  render(<SampleJourneyScreen journey={second} onExit={exit} />);
  next();
  const page = second.pages[1]!;
  expect(screen.queryByText(/这是三页框架预览/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: `${page.title}，帮助` }));
  expect(screen.getByText(/这是三页框架预览，不会保存答案/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: `关闭${page.title} · 帮助` }));
  expect(screen.getByLabelText("第 2 页，共 3 页")).toBeTruthy();
  expect(screen.getByText(page.body)).toBeTruthy();
  expect(exit).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  expect(screen.getByLabelText("第 1 页，共 3 页")).toBeTruthy();
});
