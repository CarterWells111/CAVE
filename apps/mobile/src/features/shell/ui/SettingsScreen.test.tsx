import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { darkTheme, lightTheme, type AppTheme } from "../../../core/design/theme";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { SettingsScreen } from "./SettingsScreen";

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/gu)!.map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function renderScreen(overrides: Partial<React.ComponentProps<typeof SettingsScreen>> = {}) {
  const props = {
    appearancePreference: "system" as const,
    appearanceSaving: false,
    onAppearancePreferenceChange: jest.fn(async () => undefined),
    onBack: jest.fn(),
    onContinueAfterDelete: jest.fn(),
    onDeleteAllData: jest.fn(async () => undefined),
    resolvedTheme: "dark" as const,
    ...overrides
  };
  render(<SettingsScreen {...props} />);
  return props;
}

async function renderThemedScreen(theme: AppTheme) {
  const props = {
    appearancePreference: "system" as const,
    appearanceSaving: false,
    onAppearancePreferenceChange: jest.fn(async () => undefined),
    onBack: jest.fn(),
    onContinueAfterDelete: jest.fn(),
    onDeleteAllData: jest.fn(async () => undefined),
    resolvedTheme: theme.name,
  };
  render(
    <ThemeProvider repository={{ load: async () => theme.name, save: async () => undefined }}>
      <SettingsScreen {...props} />
    </ThemeProvider>,
  );
  await screen.findByRole("header", { name: "设置" });
}

test("shows only local privacy and local deletion destinations", () => {
  renderScreen();

  expect(screen.getByRole("header", { name: "设置" })).toBeTruthy();
  expect(screen.getByText("隐私与本机数据")).toBeTruthy();
  expect(screen.getByText(/能解锁这台设备的人仍可能看到/u)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "更改称呼" })).toBeNull();
  expect(screen.queryByText("界面称呼")).toBeNull();
  expect(screen.queryByText(/账号|账户|云端|我的/u)).toBeNull();

  const scroll = screen.getByTestId("settings-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
});

test("offers accessible system, light and dark appearance choices and a back action", () => {
  const props = renderScreen();

  expect(screen.getByText("外观")).toBeTruthy();
  expect(screen.getByText("当前：深色")).toBeTruthy();
  expect(screen.getByRole("radio", { name: /跟随系统/u }).props.accessibilityState)
    .toEqual(expect.objectContaining({ checked: true }));
  expect(screen.getByRole("radio", { name: "亮色" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ checked: false }));
  expect(screen.getByRole("radio", { name: "深色" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ checked: false }));

  fireEvent.press(screen.getByRole("radio", { name: "亮色" }));
  expect(props.onAppearancePreferenceChange).toHaveBeenCalledWith("light");
  fireEvent.press(screen.getByRole("button", { name: "返回" }));
  expect(props.onBack).toHaveBeenCalledTimes(1);
});

test.each([darkTheme, lightTheme])("keeps unchecked radio boundaries at 3:1 in the $name theme", async (theme) => {
  await renderThemedScreen(theme);

  const unchecked = screen.getByRole("radio", { name: "亮色" });
  const borderColor = StyleSheet.flatten(unchecked.props.style).borderColor as string;
  expect(borderColor).toBe(theme.color.interactiveBorder);
  expect(contrast(borderColor, theme.color.surface)).toBeGreaterThanOrEqual(3);
});

test("shows a safe retryable message when an appearance choice cannot be saved", async () => {
  renderScreen({
    onAppearancePreferenceChange: jest.fn(async () => {
      throw new Error("private storage path");
    }),
  });

  fireEvent.press(screen.getByRole("radio", { name: "亮色" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("外观设置未保存，请重试。");
  expect(screen.queryByText(/private storage path/u)).toBeNull();
});

test("requires an explicit second confirmation and supports cancellation", () => {
  const props = renderScreen();

  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));

  expect(screen.getByRole("alert")).toHaveTextContent(/无法恢复/u);
  expect(props.onDeleteAllData).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "确认删除全部本机数据" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "取消删除" }));
  expect(screen.queryByRole("button", { name: "确认删除全部本机数据" })).toBeNull();
  expect(props.onDeleteAllData).not.toHaveBeenCalled();
});

test("keeps deletion pending, blocks duplicate confirmation and never reports optimistic success", async () => {
  const deletion = deferred();
  const onDeleteAllData = jest.fn(() => deletion.promise);
  renderScreen({ onDeleteAllData });
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));

  const confirm = screen.getByRole("button", { name: "确认删除全部本机数据" });
  fireEvent.press(confirm);
  fireEvent.press(confirm);

  expect(onDeleteAllData).toHaveBeenCalledTimes(1);
  expect(screen.getByText("正在删除本机数据…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "正在删除本机数据…" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ busy: true, disabled: true }));
  expect(screen.queryByText("本机数据已删除。")).toBeNull();

  await act(async () => { deletion.resolve(); });
  expect(await screen.findByText("本机数据已删除。")).toBeTruthy();
});

test("keeps the settings screen on failure, hides private errors and retries truthfully", async () => {
  const onDeleteAllData = jest.fn()
    .mockRejectedValueOnce(new Error("private database path"))
    .mockResolvedValueOnce(undefined);
  const props = renderScreen({ onDeleteAllData });
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("删除尚未完成；部分本机清理步骤可能已经完成。当前画面会保留，请安全重试直到显示完成。");
  expect(screen.queryByText(/private database path/u)).toBeNull();
  expect(screen.getByRole("header", { name: "设置" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试删除" }));

  expect(await screen.findByText("本机数据已删除。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "返回欢迎页" }));
  expect(props.onContinueAfterDelete).toHaveBeenCalledTimes(1);
});

test("keeps every interactive control at least 44 points and allows text to wrap", () => {
  renderScreen();
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));

  for (const control of screen.getAllByRole("button")) {
    const style = StyleSheet.flatten(control.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(control.props.accessibilityState?.disabled).toBe(false);
  }
  for (const text of screen.UNSAFE_getAllByType(Text)) {
    expect(text.props.numberOfLines).toBeUndefined();
  }
});
