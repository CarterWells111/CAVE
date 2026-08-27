import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { JourneyScreenShell } from "./JourneyScreenShell";

test.each([
  ["welcome", 1],
  ["overnight", 2],
  ["body-knowledge", 3],
  ["behavior-attitudes", 4],
  ["reflection", 5],
  ["preset-practice", 6],
  ["checklist", 7],
  ["communication-card", 8]
] as const)("renders %s as page %i without readiness language", (pageId, pageNumber) => {
  render(<JourneyScreenShell pageId={pageId} />);

  expect(screen.getByTestId(`journey-page-${pageId}`)).toBeTruthy();
  expect(screen.getByText(`第 ${pageNumber} 页，共 8 页`)).toBeTruthy();
  expect(screen.queryByText(/准备度|readiness|score|percentage/iu)).toBeNull();
});

test("provides a safe-area, keyboard-aware scroll structure for long and small screens", () => {
  render(
    <JourneyScreenShell pageId="overnight">
      {Array.from({ length: 40 }, (_, index) => (
        <Text key={index}>{`long-content-${index}`}</Text>
      ))}
    </JourneyScreenShell>
  );

  expect(screen.getByTestId("journey-safe-area")).toBeTruthy();
  expect(screen.getByTestId("journey-keyboard-avoiding")).toBeTruthy();
  expect(screen.getByTestId("journey-scroll").props).toEqual(expect.objectContaining({
    keyboardDismissMode: "interactive",
    keyboardShouldPersistTaps: "handled"
  }));
  expect(screen.getByText("long-content-39")).toBeTruthy();
});

test("keeps a stable localized title, page count and back region", () => {
  const onBack = jest.fn();
  const { rerender } = render(<JourneyScreenShell pageId="overnight" onBack={onBack} />);

  expect(screen.getByText("过夜期待与在意")).toBeTruthy();
  expect(screen.getByText("第 2 页，共 8 页")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  expect(onBack).toHaveBeenCalledTimes(1);

  rerender(<JourneyScreenShell pageId="welcome" />);
  expect(screen.queryByRole("button", { name: "返回上一页" })).toBeNull();
  expect(screen.getByTestId("journey-back-placeholder")).toBeTruthy();
});

test("keeps a disabled back button on later pages when navigation is not injected", () => {
  const { rerender } = render(<JourneyScreenShell pageId="overnight" />);

  expect(screen.getByRole("button", { name: "返回上一页" }).props.accessibilityState).toEqual(
    expect.objectContaining({ disabled: true })
  );
  expect(screen.queryByTestId("journey-back-placeholder")).toBeNull();

  rerender(<JourneyScreenShell pageId="welcome" />);
  expect(screen.queryByRole("button", { name: "返回上一页" })).toBeNull();
  expect(screen.getByTestId("journey-back-placeholder")).toBeTruthy();
});

test("renders a runtime-injected Expo Go notice without owning runtime detection", () => {
  render(
    <JourneyScreenShell
      pageId="welcome"
      runtimeNotice={{
        accessibilityLabel: "当前为 Expo Go 演示模式",
        message: "Expo Go 演示模式"
      }}
    />
  );

  expect(screen.getByText("Expo Go 演示模式")).toBeTruthy();
  expect(screen.getByLabelText("当前为 Expo Go 演示模式")).toBeTruthy();
});

function channel(hex: string, offset: number) {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(foreground: unknown, background: unknown) {
  if (typeof foreground !== "string" || typeof background !== "string") return 0;
  if (!/^#[0-9a-f]{6}$/iu.test(foreground) || !/^#[0-9a-f]{6}$/iu.test(background)) return 0;
  const luminance = (hex: string) => (
    0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
  );
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

test("uses 44 point back target and baseline AA text contrast", () => {
  render(<JourneyScreenShell pageId="overnight" onBack={jest.fn()} />);

  const back = screen.getByRole("button", { name: "返回上一页" });
  const backStyle = StyleSheet.flatten(back.props.style);
  const backLabelStyle = StyleSheet.flatten(screen.getByText("返回修改").props.style);

  expect(backStyle).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
  expect(contrastRatio(backLabelStyle.color, backStyle.backgroundColor)).toBeGreaterThanOrEqual(4.5);
});
