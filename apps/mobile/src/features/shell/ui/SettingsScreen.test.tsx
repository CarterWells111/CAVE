import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, StyleSheet, Text } from "react-native";

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
  const deleteAllData = jest.fn(async () => undefined);
  const onContinue = jest.fn();
  const props = {
    account: { status: "signedOut" as const, onSignIn: jest.fn() },
    appearancePreference: "system" as const,
    appearanceSaving: false,
    deletion: { deleteAllData, onContinue },
    onAppearancePreferenceChange: jest.fn(async () => undefined),
    onBack: jest.fn(),
    resolvedTheme: "dark" as const,
    ...overrides
  };
  render(<SettingsScreen {...props} />);
  return { ...props, deleteAllData, onContinue };
}

async function renderThemedScreen(theme: AppTheme) {
  const props = {
    appearancePreference: "system" as const,
    appearanceSaving: false,
    deletion: {
      deleteAllData: jest.fn(async () => undefined),
      onContinue: jest.fn(),
    },
    onAppearancePreferenceChange: jest.fn(async () => undefined),
    onBack: jest.fn(),
    resolvedTheme: theme.name,
  };
  render(
    <ThemeProvider repository={{ load: async () => theme.name, save: async () => undefined }}>
      <SettingsScreen {...props} />
    </ThemeProvider>,
  );
  await screen.findByRole("header", { name: "设置" });
}

afterEach(() => {
  jest.restoreAllMocks();
});

test("shows one signed-out email login action without claiming cloud sync", () => {
  const props = renderScreen();

  expect(screen.getByRole("header", { name: "设置" })).toBeTruthy();
  expect(screen.getByRole("header", { name: "账户与保存" })).toBeTruthy();
  expect(screen.getByLabelText("默认头像")).toBeTruthy();
  expect(screen.getByText("本机保存（当前）")).toBeTruthy();
  expect(screen.getByText("邮箱登录（不含同步）")).toBeTruthy();
  expect(screen.getByText(/使用内界手记必须登录/u)).toBeTruthy();
  expect(screen.getByText(/登录只会把本机手记与账号关联/u)).toBeTruthy();
  expect(screen.getByText("隐私与本机数据")).toBeTruthy();
  expect(screen.getByText(/能解锁这台设备的人仍可能看到/u)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "更改称呼" })).toBeNull();
  expect(screen.queryByText("界面称呼")).toBeNull();
  expect(screen.getAllByRole("button", { name: "邮箱登录" })).toHaveLength(1);
  fireEvent.press(screen.getByRole("button", { name: "邮箱登录" }));
  expect(props.account!.onSignIn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "管理邮箱账号" })).toBeNull();

  const scroll = screen.getByTestId("settings-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
});

test("keeps local-content boundaries explicit for a signed-in account", () => {
  const onManageAccount = jest.fn();
  renderScreen({
    account: {
      email: "person@example.com",
      onManageAccount,
      profile: { displayName: "阿岚" },
      status: "ready",
    },
  });
  expect(screen.getByText("阿岚")).toBeTruthy();
  expect(screen.getByText("person@example.com")).toBeTruthy();
  expect(screen.getByText(/登录不会上传日记、沟通卡、回顾或亲密内容/u)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "邮箱登录" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "管理邮箱账号" }));
  expect(onManageAccount).toHaveBeenCalledTimes(1);
});

test("offers avatar selection, restore-default, and cancel through a native alert", () => {
  const chooseAvatar = jest.fn(async () => undefined);
  const removeAvatar = jest.fn(async () => undefined);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  renderScreen({
    account: {
      chooseAvatar,
      email: "person@example.com",
      profile: { displayName: "阿岚" },
      removeAvatar,
      status: "ready",
    },
  });

  fireEvent.press(screen.getByRole("button", { name: "更改头像" }));
  expect(alert).toHaveBeenCalledTimes(1);
  const buttons = alert.mock.calls[0]![2]!;
  expect(buttons.map((button) => button.text)).toEqual(["从相册选择", "恢复默认头像", "取消"]);
  buttons[0]!.onPress?.();
  buttons[1]!.onPress?.();
  expect(chooseAvatar).toHaveBeenCalledTimes(1);
  expect(removeAvatar).toHaveBeenCalledTimes(1);
});

test("validates a trimmed 1–24 Unicode-character nickname before saving", async () => {
  const saveDisplayName = jest.fn(async () => undefined);
  renderScreen({
    account: {
      email: "person@example.com",
      profile: { displayName: "原昵称" },
      saveDisplayName,
      status: "ready",
    },
  });

  fireEvent.press(screen.getByRole("button", { name: "更改昵称" }));
  const input = screen.getByLabelText("昵称");
  fireEvent.changeText(input, "   ");
  fireEvent.press(screen.getByRole("button", { name: "保存昵称" }));
  expect(screen.getByRole("alert")).toHaveTextContent("昵称需要 1–24 个字符。");
  expect(saveDisplayName).not.toHaveBeenCalled();

  fireEvent.changeText(input, "🌿".repeat(25));
  fireEvent.press(screen.getByRole("button", { name: "保存昵称" }));
  expect(saveDisplayName).not.toHaveBeenCalled();

  fireEvent.changeText(input, "  新昵称  ");
  fireEvent.press(screen.getByRole("button", { name: "保存昵称" }));
  await waitFor(() => expect(saveDisplayName).toHaveBeenCalledWith("新昵称"));
  expect(screen.queryByLabelText("昵称")).toBeNull();
});

test("keeps the nickname editor open with a neutral error when saving fails", async () => {
  renderScreen({
    account: {
      email: "person@example.com",
      profile: { displayName: "原昵称" },
      saveDisplayName: jest.fn(async () => { throw new Error("private file path"); }),
      status: "ready",
    },
  });

  fireEvent.press(screen.getByRole("button", { name: "更改昵称" }));
  fireEvent.changeText(screen.getByLabelText("昵称"), "新昵称");
  fireEvent.press(screen.getByRole("button", { name: "保存昵称" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("账号资料未保存，请重试。");
  expect(screen.getByLabelText("昵称")).toBeTruthy();
  expect(screen.queryByText(/private file path/u)).toBeNull();
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

test("does not render a deletion action when no real deletion capability is supplied", () => {
  renderScreen({ deletion: undefined });

  expect(screen.getByRole("header", { name: "设置" })).toBeTruthy();
  expect(screen.getByText("隐私与本机数据")).toBeTruthy();
  expect(screen.queryByRole("header", { name: "删除本机数据" })).toBeNull();
  expect(screen.queryByRole("button", { name: "删除全部本机数据" })).toBeNull();
});

test.each([darkTheme, lightTheme])("keeps unchecked radio boundaries at 3:1 in the $name theme", async (theme) => {
  await renderThemedScreen(theme);

  const unchecked = screen.getByRole("radio", { name: "亮色" });
  const borderColor = StyleSheet.flatten(unchecked.props.style).borderColor as string;
  expect(borderColor).toBe(theme.color.interactiveBorder);
  expect(contrast(borderColor, theme.color.surface)).toBeGreaterThanOrEqual(3);
});

test.each([darkTheme, lightTheme])("uses the $name theme on the settings page background", async (theme) => {
  await renderThemedScreen(theme);

  expect(screen.getByTestId("settings-scroll")).toHaveStyle({
    backgroundColor: theme.color.background,
  });
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
  expect(props.deleteAllData).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "确认删除全部本机数据" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "取消删除" }));
  expect(screen.queryByRole("button", { name: "确认删除全部本机数据" })).toBeNull();
  expect(props.deleteAllData).not.toHaveBeenCalled();
});

test("keeps deletion pending, blocks duplicate confirmation and never reports optimistic success", async () => {
  const deletion = deferred();
  const onDeleteAllData = jest.fn(() => deletion.promise);
  renderScreen({ deletion: { deleteAllData: onDeleteAllData, onContinue: jest.fn() } });
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
  const onContinue = jest.fn();
  renderScreen({ deletion: { deleteAllData: onDeleteAllData, onContinue } });
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("删除尚未完成；部分本机清理步骤可能已经完成。当前画面会保留，请安全重试直到显示完成。");
  expect(screen.queryByText(/private database path/u)).toBeNull();
  expect(screen.getByRole("header", { name: "设置" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试删除" }));

  expect(await screen.findByText("本机数据已删除。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "返回首页" }));
  expect(onContinue).toHaveBeenCalledTimes(1);
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
