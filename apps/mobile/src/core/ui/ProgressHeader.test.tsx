import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import * as ReactNative from "react-native";

import { theme } from "../design/theme";
import { ProgressHeader } from "./ProgressHeader";

const originalExpoOs = process.env.EXPO_OS;

afterEach(() => {
  if (originalExpoOs === undefined) {
    delete process.env.EXPO_OS;
  } else {
    process.env.EXPO_OS = originalExpoOs;
  }
  jest.restoreAllMocks();
});

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/gu)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(first: string, second: string) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test("uses Expo's direct build-time OS contract", () => {
  const source = readFileSync(join(__dirname, "ProgressHeader.tsx"), "utf8");

  expect(source).toContain('process.env.EXPO_OS === "ios"');
  expect(source).not.toMatch(/process\.env\[[^\]]*EXPO_OS[^\]]*\]/u);
});

test("announces progress through the fixed eight-page journey", () => {
  render(<ProgressHeader currentPage={3} />);

  const progress = screen.getByRole("header", { name: "第 3 页，共 8 页" });
  expect(progress).toHaveProp("accessibilityLiveRegion", "polite");
  expect(screen.getByText("第 3 页，共 8 页")).toBeTruthy();
});

test.each([0, 9, 1.5, Number.NaN])("rejects an invalid current page of %p", (currentPage) => {
  expect(() => render(<ProgressHeader currentPage={currentPage} />)).toThrow(
    "ProgressHeader currentPage must be an integer from 1 through 8."
  );
});

test("conditionally renders explicitly labelled back and exit actions", () => {
  const { rerender } = render(<ProgressHeader currentPage={2} />);

  expect(screen.queryByRole("button")).toBeNull();

  rerender(
    <ProgressHeader currentPage={2} onBack={jest.fn()} onExit={jest.fn()} />
  );

  expect(screen.getByRole("button", { name: "返回上一页" })).toHaveStyle({
    minHeight: 44,
    minWidth: 44
  });
  expect(screen.getByRole("button", { name: "退出旅程" })).toHaveStyle({
    minHeight: 44,
    minWidth: 44
  });
});

test.each(["返回上一页", "退出旅程"])("shows color and non-color pressed signals for %s", (label) => {
  render(<ProgressHeader currentPage={2} onBack={jest.fn()} onExit={jest.fn()} />);
  const action = screen.getByRole("button", { name: label });
  const defaultBackground = action.props.style.backgroundColor;
  const defaultOpacity = action.props.style.opacity;

  fireEvent(action, "responderGrant", { nativeEvent: {}, persist: jest.fn() });

  expect(action.props.style.backgroundColor).not.toBe(defaultBackground);
  expect(action.props.style.opacity).not.toBe(defaultOpacity);
});

test.each(["返回上一页", "退出旅程"])("shows and clears focus treatment for %s", (label) => {
  render(<ProgressHeader currentPage={2} onBack={jest.fn()} onExit={jest.fn()} />);
  const action = screen.getByRole("button", { name: label });
  const normalBorderWidth = action.props.style.borderWidth;

  fireEvent(action, "focus");
  expect(action.props.style.borderWidth).toBe(normalBorderWidth);
  expect(action.props.style.outlineColor).toBe(theme.color.focus);
  expect(action.props.style.outlineWidth).toBe(theme.border.focusWidth);
  expect(action.props.style.outlineOffset).toBeGreaterThan(0);
  expect(contrastRatio(action.props.style.outlineColor, theme.color.background)).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(action.props.style.outlineColor, theme.color.surface)).toBeGreaterThanOrEqual(3);

  fireEvent(action, "blur");
  expect(action.props.style.outlineWidth).toBe(0);
});

test("keeps progress centered with one action by retaining symmetric side slots", () => {
  render(<ProgressHeader currentPage={2} onBack={jest.fn()} />);

  const leading = screen.getByTestId("progress-leading-slot");
  const trailing = screen.getByTestId("progress-trailing-slot");
  expect(leading).toHaveStyle({ flex: 1 });
  expect(trailing).toHaveStyle({ flex: 1 });
  expect(leading.props.style.flex).toBe(trailing.props.style.flex);
  expect(screen.getByTestId("progress-center")).toBeTruthy();
});

test("keeps progress centered when action labels have unequal widths", () => {
  render(
    <ProgressHeader
      backLabel="返回"
      currentPage={2}
      exitLabel="退出并返回开始页面"
      onBack={jest.fn()}
      onExit={jest.fn()}
    />
  );

  const leading = screen.getByTestId("progress-leading-slot");
  const trailing = screen.getByTestId("progress-trailing-slot");
  expect(leading.props.style.flex).toBe(trailing.props.style.flex);
  expect(screen.getByText("第 2 页，共 8 页")).toBeTruthy();
});

test("announces changed progress through AccessibilityInfo only on iOS", () => {
  process.env.EXPO_OS = "ios";
  const announce = jest
    .spyOn(AccessibilityInfo, "announceForAccessibility")
    .mockImplementation(jest.fn());
  announce.mockClear();
  const { rerender } = render(<ProgressHeader currentPage={2} />);

  rerender(<ProgressHeader currentPage={3} />);

  expect(announce).toHaveBeenLastCalledWith("第 3 页，共 8 页");
});

test("retains the Android polite live-region contract behind the iOS-only build guard", () => {
  render(<ProgressHeader currentPage={3} />);

  expect(screen.getByRole("header", { name: "第 3 页，共 8 页" })).toHaveProp(
    "accessibilityLiveRegion",
    "polite"
  );
});

test("uses a two-line header at 320 points with the largest text scale", () => {
  jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
    fontScale: 2,
    height: 568,
    scale: 2,
    width: 320
  });

  render(
    <ProgressHeader
      backLabel="返回上一页"
      currentPage={2}
      exitLabel="退出并返回开始页面"
      onBack={jest.fn()}
      onExit={jest.fn()}
      testID="responsive-progress-header"
    />
  );

  expect(screen.getByTestId("responsive-progress-header")).toHaveStyle({
    flexDirection: "column",
    width: "100%"
  });
  expect(screen.getByTestId("progress-actions-row")).toHaveStyle({
    flexDirection: "row",
    width: "100%"
  });
  expect(screen.getByText("退出并返回开始页面")).toHaveStyle({
    flexShrink: 1,
    flexWrap: "wrap"
  });
  expect(screen.getByRole("header", { name: "第 2 页，共 8 页" })).toHaveStyle({
    flexShrink: 1,
    flexWrap: "wrap"
  });
});

test("exposes busy and disabled state for an unavailable back action", () => {
  const onBack = jest.fn();

  render(
    <ProgressHeader
      backBusy
      backDisabled
      currentPage={2}
      onBack={onBack}
    />
  );

  const back = screen.getByRole("button", { name: "返回上一页" });
  expect(back).toHaveProp("accessibilityState", { busy: true, disabled: true });
  fireEvent.press(back);
  expect(onBack).not.toHaveBeenCalled();
});
