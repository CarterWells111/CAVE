import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { theme } from "../design/theme";
import { StatusBanner } from "./StatusBanner";

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
  const source = readFileSync(join(__dirname, "StatusBanner.tsx"), "utf8");

  expect(source).toContain('process.env.EXPO_OS === "ios"');
  expect(source).not.toMatch(/process\.env\[[^\]]*EXPO_OS[^\]]*\]/u);
});

test.each([
  ["info", "ⓘ"],
  ["success", "✓"],
  ["warning", "!"],
] as const)("renders %s status with a visible icon, text, and polite announcement", (variant, icon) => {
  render(<StatusBanner message="状态说明" variant={variant} />);

  const banner = screen.getByLabelText(`${icon} 状态说明`);
  expect(banner).toHaveProp("role", "status");
  expect(banner).toHaveProp("accessibilityLiveRegion", "polite");
  expect(screen.getByText(icon)).toBeTruthy();
  expect(screen.getByText("状态说明")).toBeTruthy();
});

test("announces errors assertively", () => {
  render(<StatusBanner message="保存失败" variant="error" />);

  const banner = screen.getByLabelText("× 保存失败");
  expect(banner).toHaveProp("role", "alert");
  expect(banner).toHaveProp("accessibilityLiveRegion", "assertive");
  expect(screen.getByText("×")).toBeTruthy();
  expect(screen.getByText("保存失败")).toBeTruthy();
});

test("renders a labelled recovery action with a minimum 44 point target", () => {
  const onAction = jest.fn();
  render(
    <StatusBanner
      actionLabel="重试保存"
      message="保存失败"
      onAction={onAction}
      variant="error"
    />
  );

  const action = screen.getByRole("button", { name: "重试保存" });
  expect(action).toHaveStyle({ minHeight: 44, minWidth: 44 });
  fireEvent.press(action);
  expect(onAction).toHaveBeenCalledTimes(1);
});

test.each(["info", "success", "warning", "error"] as const)(
  "keeps %s recovery action normal text on the primary text pairing",
  (variant) => {
    render(<StatusBanner actionLabel="继续" message="状态" onAction={jest.fn()} variant={variant} />);
    expect(screen.getByText("继续")).toHaveStyle({ color: theme.color.text });
    expect(screen.getByRole("button", { name: "继续" })).toHaveStyle({
      borderColor: theme.color.interactiveBorder,
    });
  },
);

test("shows color and non-color pressed signals on the recovery action", () => {
  render(
    <StatusBanner
      actionLabel="重试保存"
      message="保存失败"
      onAction={jest.fn()}
      variant="error"
    />
  );
  const action = screen.getByRole("button", { name: "重试保存" });
  const defaultBackground = action.props.style.backgroundColor;
  const defaultOpacity = action.props.style.opacity;

  fireEvent(action, "responderGrant", { nativeEvent: {}, persist: jest.fn() });

  expect(action.props.style.backgroundColor).not.toBe(defaultBackground);
  expect(action.props.style.opacity).not.toBe(defaultOpacity);
});

test("shows and clears focus treatment on the recovery action", () => {
  render(
    <StatusBanner
      actionLabel="重试保存"
      message="保存失败"
      onAction={jest.fn()}
      variant="error"
    />
  );
  const action = screen.getByRole("button", { name: "重试保存" });
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

test("announces changed status through AccessibilityInfo only on iOS", () => {
  process.env.EXPO_OS = "ios";
  const announce = jest
    .spyOn(AccessibilityInfo, "announceForAccessibility")
    .mockImplementation(jest.fn());
  announce.mockClear();
  const { rerender } = render(<StatusBanner message="正在保存" variant="info" />);

  rerender(<StatusBanner message="保存失败" variant="error" />);

  expect(announce).toHaveBeenLastCalledWith("保存失败");
});

test("retains the Android assertive live-region contract behind the iOS-only build guard", () => {
  render(<StatusBanner message="保存失败" variant="error" />);

  expect(screen.getByLabelText("× 保存失败")).toHaveProp(
    "accessibilityLiveRegion",
    "assertive"
  );
});

test("applies a custom accessibility label to the single status node", () => {
  render(
    <StatusBanner
      accessibilityLabel="本机暂存提示"
      message="演示期数据只保存在本机"
      variant="info"
    />
  );

  const labelledNodes = screen.getAllByLabelText("本机暂存提示");
  expect(labelledNodes).toHaveLength(1);
  expect(labelledNodes[0]).toHaveProp("role", "status");
  expect(labelledNodes[0]).toHaveProp("accessibilityLiveRegion", "polite");
});
