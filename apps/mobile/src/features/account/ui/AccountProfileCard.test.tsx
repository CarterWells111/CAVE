import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { darkTheme, lightTheme } from "../../../core/design/theme";
import { AccountProfileCard } from "./AccountProfileCard";

let mockTheme = darkTheme;

jest.mock("../../../core/design/theme-provider", () => ({
  useTheme: () => mockTheme,
}));

beforeEach(() => {
  mockTheme = darkTheme;
});

test("shows the default avatar and email login action when signed out", () => {
  const onSignIn = jest.fn();
  render(<AccountProfileCard onSignIn={onSignIn} status="signedOut" />);
  expect(screen.getByLabelText("默认头像")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "邮箱登录" }));
  expect(onSignIn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "更改昵称" })).toBeNull();
  expect(screen.getByTestId("account-profile-card").props.accessible).toBe(false);
});

test("shows the avatar, display name, and read-only email without edit controls", () => {
  render(<AccountProfileCard
    avatarUri="file:///account-avatar.jpg"
    displayName="阿岚"
    email="person@example.com"
    onChangeAvatar={jest.fn()}
    onChangeDisplayName={jest.fn()}
    readOnly
    status="ready"
  />);
  expect(screen.getByLabelText("账号头像").props.source).toEqual({ uri: "file:///account-avatar.jpg" });
  expect(screen.getByText("阿岚")).toBeTruthy();
  const identity = screen.getByTestId("account-profile-identity");
  expect(identity).toHaveStyle({ flexDirection: "column" });
  expect(within(identity).getByText("person@example.com")).toBeTruthy();
  expect(screen.queryByText("点击更改")).toBeNull();
  expect(screen.queryByRole("button", { name: "更改昵称" })).toBeNull();
});

test("explains how to recover the email for a legacy signed-in session", () => {
  render(<AccountProfileCard displayName="阿岚" status="ready" />);

  expect(screen.getByText("邮箱未记录，请重新登录后显示")).toBeTruthy();
});

test("offers 44-point avatar and accessible nickname editing controls in editable mode", () => {
  const onChangeAvatar = jest.fn();
  const onChangeDisplayName = jest.fn();
  render(<AccountProfileCard
    displayName="内界用户"
    email="person@example.com"
    onChangeAvatar={onChangeAvatar}
    onChangeDisplayName={onChangeDisplayName}
    status="ready"
  />);
  const avatarAction = screen.getByRole("button", { name: "更改头像" });
  const nameAction = screen.getByRole("button", { name: "更改昵称" });
  expect(screen.getByTestId("account-profile-card").props.accessible).toBe(false);
  expect(screen.getByText("点击更改")).toBeTruthy();
  expect(avatarAction).toHaveStyle({ minHeight: 44, minWidth: 44 });
  expect(nameAction).toHaveStyle({ minHeight: 44, minWidth: 44 });
  fireEvent.press(avatarAction);
  fireEvent.press(nameAction);
  expect(onChangeAvatar).toHaveBeenCalledTimes(1);
  expect(onChangeDisplayName).toHaveBeenCalledTimes(1);
});

test.each([
  ["dark", darkTheme],
  ["light", lightTheme],
] as const)("uses %s theme colors for its card and text", (_name, selectedTheme) => {
  mockTheme = selectedTheme;
  render(<AccountProfileCard
    displayName="内界用户"
    email="person@example.com"
    readOnly
    status="ready"
  />);
  expect(screen.getByTestId("account-profile-card")).toHaveStyle({
    backgroundColor: selectedTheme.color.surface,
    borderColor: selectedTheme.color.border,
  });
  expect(screen.getByText("内界用户")).toHaveStyle({ color: selectedTheme.color.text });
  expect(screen.getByText("person@example.com")).toHaveStyle({ color: selectedTheme.color.textSecondary });
});

test("renders neutral loading and error states without identity edit actions", () => {
  const onRetry = jest.fn();
  const view = render(<AccountProfileCard status="loading" />);
  expect(screen.getByText("正在读取账号资料…").props.accessibilityState).toEqual({ busy: true });
  view.rerender(<AccountProfileCard onRetry={onRetry} status="error" />);
  expect(screen.getByRole("alert")).toHaveTextContent("暂时无法读取账号资料，请稍后重试。");
  fireEvent.press(screen.getByRole("button", { name: "重试账号资料" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "更改头像" })).toBeNull();
  expect(screen.queryByRole("button", { name: "更改昵称" })).toBeNull();
});
