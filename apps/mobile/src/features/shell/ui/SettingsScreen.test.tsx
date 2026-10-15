import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { darkTheme, lightTheme, type AppTheme } from "../../../core/design/theme";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { SettingsScreen } from "./SettingsScreen";

function renderScreen(overrides: Partial<React.ComponentProps<typeof SettingsScreen>> = {}) {
  const props = {
    account: { status: "signedOut" as const, onSignIn: jest.fn() },
    appearancePreference: "system" as const,
    appearanceSaving: false,
    onOpenAccountPrivacy: jest.fn(),
    onAppearancePreferenceChange: jest.fn(async () => undefined),
    onBack: jest.fn(),
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
    onOpenAccountPrivacy: jest.fn(),
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

test("explains related-record access and its lifetime in settings help", () => {
  renderScreen();
  fireEvent.press(screen.getByRole("button", { name: "设置，帮助" }));
  expect(screen.getByText(/普通 AI 聊天发送后直接取得回复/u)).toHaveTextContent(/问题涉及的本账号日记和旅程内容发送至内界服务端/u);
  expect(screen.getByText(/选择会延续到新对话和页面切换/u)).toHaveTextContent(/退出 App 后恢复关闭/u);
  expect(screen.queryByText(/仅适用于本次会话的普通公开聊天/u)).toBeNull();
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

  fireEvent.press(screen.getByRole("button", { name: "外观，跟随系统" }));
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

test("closing appearance choices preserves the saved preference", () => {
  const props = renderScreen();
  fireEvent.press(screen.getByRole("button", { name: "外观，跟随系统" }));
  expect(screen.getByRole("radio", { name: /跟随系统/u, checked: true })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "关闭外观" }));
  expect(props.onAppearancePreferenceChange).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "外观，跟随系统" })).toBeTruthy();
});

test("appearance choices cannot open during a preference save", () => {
  const props = renderScreen({ appearanceSaving: true });
  const trigger = screen.getByRole("button", { name: "外观，跟随系统" });
  expect(trigger).toBeDisabled();
  fireEvent.press(trigger);
  expect(screen.queryByRole("radio")).toBeNull();
  expect(props.onAppearancePreferenceChange).not.toHaveBeenCalled();
});

test.each([darkTheme, lightTheme])("keeps appearance selection readable in the $name theme", async (theme) => {
  await renderThemedScreen(theme);
  const field = screen.getByRole("button", { name: "外观，跟随系统" });
  expect(field).toHaveStyle({ backgroundColor: theme.color.surface });
  fireEvent.press(field);
  expect(screen.getByRole("radio", { name: "亮色" })).toHaveStyle({ backgroundColor: theme.color.surface });
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
  fireEvent.press(screen.getByRole("button", { name: "外观，跟随系统" }));
  fireEvent.press(screen.getByRole("radio", { name: "亮色" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("外观设置未保存，请重试。");
  expect(screen.queryByText(/private storage path/u)).toBeNull();
});

test("settings keeps account privacy behind the last navigation row",()=>{const props=renderScreen();expect(screen.queryByRole("button",{name:"删除全部本机数据"})).toBeNull();expect(screen.queryByRole("switch")).toBeNull();const rows=screen.getAllByRole("button");expect(rows[rows.length-1]).toHaveTextContent(/账号与隐私/);fireEvent.press(screen.getByRole("button",{name:"账号与隐私，账号管理、隐私设置与危险操作"}));expect(props.onOpenAccountPrivacy).toHaveBeenCalledTimes(1);});
