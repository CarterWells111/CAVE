import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, View } from "react-native";

import { darkTheme as theme } from "../design/theme";
import { ProgressHeader } from "./ProgressHeader";

afterEach(() => jest.restoreAllMocks());

test("shows compact n / total progress with a descriptive accessible name", () => {
  render(<ProgressHeader currentPage={3} totalPages={7} />);
  expect(screen.getByText("3 / 7")).toBeTruthy();
  expect(screen.getByRole("header", { name: "第 3 页，共 7 页" })).toHaveProp(
    "accessibilityLiveRegion", "polite",
  );
});

test("hides progress by default on Screen 1", () => {
  render(<ProgressHeader currentPage={1} totalPages={7} />);
  expect(screen.queryByRole("header")).toBeNull();
  expect(screen.queryByText("1 / 7")).toBeNull();
});

test("can explicitly show or hide progress without removing navigation", () => {
  const onBack = jest.fn();
  const { rerender } = render(
    <ProgressHeader currentPage={1} onBack={onBack} showProgress totalPages={7} />,
  );
  expect(screen.getByText("1 / 7")).toBeTruthy();
  rerender(<ProgressHeader currentPage={2} onBack={onBack} showProgress={false} totalPages={7} />);
  expect(screen.queryByRole("header")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test.each([0, 8, 1.5, Number.NaN])("rejects current page %p outside the supplied total", (currentPage) => {
  expect(() => render(<ProgressHeader currentPage={currentPage} totalPages={7} />)).toThrow(
    "ProgressHeader currentPage must be an integer from 1 through totalPages.",
  );
});

test("keeps actions at least 44 points and exposes unavailable state", () => {
  const onBack = jest.fn();
  render(<ProgressHeader backBusy currentPage={2} onBack={onBack} totalPages={7} />);
  const back = screen.getByRole("button", { name: "返回上一页" });
  expect(back).toHaveStyle({ minHeight: 44, minWidth: 44 });
  expect(back).toHaveProp("accessibilityState", { busy: true, disabled: true });
  expect(back).toHaveStyle({ borderWidth: 1 });
  expect(screen.getByText("加载中")).toBeTruthy();
  fireEvent.press(back);
  expect(onBack).not.toHaveBeenCalled();
});

test("keeps all three slots in one row at 320 points while allowing full labels to scale and wrap", () => {
  render(
    <View style={{ width: 320 }} testID="narrow-viewport">
      <ProgressHeader currentPage={7} onBack={jest.fn()} onExit={jest.fn()} totalPages={7} testID="header" />
    </View>,
  );
  expect(screen.getByTestId("narrow-viewport")).toHaveStyle({ width: 320 });
  expect(screen.getByTestId("header")).toHaveStyle({ flexDirection: "row", width: "100%" });
  expect(screen.queryByTestId("progress-actions-row")).toBeNull();
  for (const label of ["返回上一页", "退出旅程"]) {
    expect(screen.getByRole("button", { name: label })).toHaveStyle({ minHeight: 44, minWidth: 44 });
    expect(screen.getByText(label)).toHaveStyle({ flexShrink: 1, flexWrap: "wrap" });
    expect(screen.getByText(label).props.allowFontScaling).toBeUndefined();
    expect(screen.getByText(label).props.maxFontSizeMultiplier).toBeUndefined();
    expect(screen.getByText(label).props.numberOfLines).toBeUndefined();
    expect(screen.getByText(label).props.ellipsizeMode).toBeUndefined();
  }
  expect(screen.getByText("7 / 7").props.numberOfLines).toBeUndefined();
});

test("announces visible progress changes on iOS", () => {
  process.env.EXPO_OS = "ios";
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(jest.fn());
  const { rerender } = render(<ProgressHeader currentPage={2} totalPages={7} />);
  rerender(<ProgressHeader currentPage={3} totalPages={7} />);
  expect(announce).toHaveBeenLastCalledWith("第 3 页，共 7 页");
  delete process.env.EXPO_OS;
});

test("uses the approved focus ring", () => {
  render(<ProgressHeader currentPage={2} onBack={jest.fn()} totalPages={7} />);
  const back = screen.getByRole("button", { name: "返回上一页" });
  fireEvent(back, "focus");
  expect(back).toHaveStyle({ outlineColor: theme.color.focus, outlineOffset: 2, outlineWidth: 2 });
});
