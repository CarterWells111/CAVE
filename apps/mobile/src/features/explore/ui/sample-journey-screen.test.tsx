import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler, Dimensions, StyleSheet } from "react-native";

import { SAMPLE_JOURNEYS } from "../catalog";
import { SampleJourneyScreen } from "./sample-journey-screen";

const first = SAMPLE_JOURNEYS[0]!;
const second = SAMPLE_JOURNEYS[1]!;
const next = () => fireEvent.press(screen.getByRole("button", { name: "下一页" }));

it("starts with a framework preview and progresses through exactly three pages", () => {
  const exit = jest.fn();
  render(<SampleJourneyScreen journey={first} onExit={exit} />);
  expect(screen.getByLabelText("第 1 页，共 3 页")).toBeTruthy();
  expect(screen.getByText(first.pages[0].body)).toHaveProp("selectable", true);
  expect(screen.queryByRole("button", { name: "返回上一页" })).toBeNull();
  next();
  expect(screen.getByLabelText("第 2 页，共 3 页")).toBeTruthy();
  expect(screen.getByText(first.pages[1].body)).toHaveProp("selectable", true);
  next();
  expect(screen.getByLabelText("第 3 页，共 3 页")).toBeTruthy();
  expect(screen.getByText(first.pages[2].body)).toHaveProp("selectable", true);
  expect(screen.queryByRole("button", { name: "下一页" })).toBeNull();
  expect(exit).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "返回地图" }));
  expect(exit).toHaveBeenCalledTimes(1);
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
