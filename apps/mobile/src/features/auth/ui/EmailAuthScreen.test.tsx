import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { MobileAuthApiError } from "../infrastructure/auth-api-client";
import { EmailAuthScreen } from "./EmailAuthScreen";
import { InMemoryAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { darkTheme, lightTheme } from "../../../core/design/theme";
import { AppState, ScrollView, StyleSheet, type AppStateStatus } from "react-native";

const challenge = {
  contractVersion: "1" as const,
  requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
  challengeId: "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
  expiresInSeconds: 600,
  resendAfterSeconds: 60,
};

afterEach(() => { jest.restoreAllMocks(); });

test.each(["dark", "light"] as const)("paints the whole login page and inputs using the %s theme", async (mode) => {
  const repository = new InMemoryAppearancePreferencesRepository();
  await repository.save(mode);
  const theme = mode === "dark" ? darkTheme : lightTheme;
  render(<ThemeProvider repository={repository}><EmailAuthScreen
    adultAuthorized onBack={jest.fn()} onDeleteAccount={jest.fn()} onLogout={jest.fn()}
    onRequestEmail={jest.fn(async () => challenge)} onVerifyCode={jest.fn()} status="signedOut"
  /></ThemeProvider>);
  await screen.findByLabelText("邮箱地址");
  expect(StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.style)).toEqual(expect.objectContaining({ backgroundColor: theme.color.background, flex: 1 }));
  expect(screen.getByLabelText("邮箱地址")).toHaveStyle({ backgroundColor: theme.color.surface, color: theme.color.text });
  expect(screen.getByLabelText("邮箱地址")).toHaveProp("keyboardAppearance", mode);
  fireEvent.changeText(screen.getByLabelText("邮箱地址"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));
  expect(await screen.findByLabelText("6 位验证码")).toHaveProp("keyboardAppearance", mode);
});

test("explains the local-only boundary and completes an email code flow", async () => {
  const requestEmail = jest.fn(async () => challenge);
  const verifyCode = jest.fn(async () => undefined);
  render(<EmailAuthScreen
    adultAuthorized
    onBack={jest.fn()}
    onDeleteAccount={jest.fn()}
    onLogout={jest.fn()}
    onRequestEmail={requestEmail}
    onVerifyCode={verifyCode}
    status="signedOut"
  />);
  expect(screen.getByText(/不会上传日记、沟通卡、回顾或亲密内容/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "邮箱账户，帮助" }));
  expect(screen.getByText(/日记、沟通卡、回顾或亲密内容仍只在本机/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "关闭邮箱账户 · 帮助" }));
  fireEvent.changeText(screen.getByLabelText("邮箱地址"), " Person@Example.com ");
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));
  await screen.findByLabelText("6 位验证码");
  fireEvent.changeText(screen.getByLabelText("6 位验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "登录" }));
  await waitFor(() => expect(verifyCode).toHaveBeenCalledWith(
    challenge.challengeId,
    "123456",
    "person@example.com",
  ));
});

test("verifies the normalized email snapshot that started the challenge", async () => {
  const requested = deferredChallenge();
  const requestEmail = jest.fn(() => requested.promise);
  const verifyCode = jest.fn(async () => undefined);
  render(<EmailAuthScreen
    adultAuthorized
    onBack={jest.fn()}
    onDeleteAccount={jest.fn()}
    onLogout={jest.fn()}
    onRequestEmail={requestEmail}
    onVerifyCode={verifyCode}
    status="signedOut"
  />);

  fireEvent.changeText(screen.getByLabelText("邮箱地址"), " Person@Example.com ");
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));
  expect(requestEmail).toHaveBeenCalledWith("person@example.com");
  fireEvent.changeText(screen.getByLabelText("邮箱地址"), "other@example.com");
  requested.resolve(challenge);
  await screen.findByLabelText("6 位验证码");
  fireEvent.changeText(screen.getByLabelText("6 位验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "登录" }));

  await waitFor(() => expect(verifyCode).toHaveBeenCalledWith(
    challenge.challengeId,
    "123456",
    "person@example.com",
  ));
});

test("development diagnostics omit private messages and arbitrary input", async () => {
  const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  const privateEmail = "private.person@example.com";
  const privateCode = "654321";
  const privateToken = "secret-session-token";
  const providerResponse = "provider rejected private.person@example.com";
  const failure = Object.assign(new Error(`account ${privateEmail} failed with ${privateCode}`), {
    code: "NETWORK_ERROR",
    status: 0,
    email: privateEmail,
    oneTimeCode: privateCode,
    response: providerResponse,
    token: privateToken,
  });
  render(<EmailAuthScreen
    adultAuthorized
    onBack={jest.fn()}
    onDeleteAccount={jest.fn()}
    onLogout={jest.fn()}
    onRequestEmail={jest.fn(async () => { throw failure; })}
    onVerifyCode={jest.fn()}
    status="signedOut"
  />);

  fireEvent.changeText(screen.getByLabelText("邮箱地址"), privateEmail);
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));
  await screen.findByRole("alert");

  expect(warning).toHaveBeenCalledWith("auth.action.failed");
  const diagnostics = JSON.stringify(warning.mock.calls);
  expect(diagnostics).not.toContain(privateEmail);
  expect(diagnostics).not.toContain(privateCode);
  expect(diagnostics).not.toContain(privateToken);
  expect(diagnostics).not.toContain(providerResponse);
});

test.each([
  [new MobileAuthApiError("NETWORK_ERROR", 0), "无法连接认证服务。请检查网络连接后重试。"],
  [new MobileAuthApiError("AUTH_DELIVERY_UNAVAILABLE", 503), "验证码暂时无法发送。请稍后重试。"],
  [new MobileAuthApiError("RATE_LIMITED", 429, 42), "操作过于频繁。请等待 42 秒后重试。"],
  [new MobileAuthApiError("AUTH_INVALID_CODE", 400), "验证码不正确。请检查后重新输入。"],
  [new MobileAuthApiError("AUTH_CODE_EXPIRED", 400), "验证码已过期。请重新获取验证码。"],
  [new MobileAuthApiError("AUTH_TOO_MANY_ATTEMPTS", 400), "验证码尝试次数过多。请重新获取验证码。"],
  [new MobileAuthApiError("AUTH_CHALLENGE_INVALID", 400), "本次验证已失效。请重新获取验证码。"],
  [new MobileAuthApiError("INVALID_RESPONSE", 502), "认证服务返回异常。请稍后重试。"],
])("shows an actionable message for authentication failure %#", async (failure, message) => {
  const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  render(<EmailAuthScreen
    adultAuthorized
    onBack={jest.fn()}
    onDeleteAccount={jest.fn()}
    onLogout={jest.fn()}
    onRequestEmail={jest.fn(async () => { throw failure; })}
    onVerifyCode={jest.fn()}
    status="signedOut"
  />);

  fireEvent.changeText(screen.getByLabelText("邮箱地址"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(warning).toHaveBeenCalledWith("auth.action.failed");
});

function deferredChallenge() {
  let resolve!: (value: typeof challenge) => void;
  const promise = new Promise<typeof challenge>((next) => { resolve = next; });
  return { promise, resolve };
}

test("allows email sign-in before adulthood is declared", () => {
  const onAdultGate = jest.fn();
  render(<EmailAuthScreen
    adultAuthorized={false}
    onAdultGate={onAdultGate}
    onBack={jest.fn()}
    onDeleteAccount={jest.fn()}
    onLogout={jest.fn()}
    onRequestEmail={jest.fn()}
    onVerifyCode={jest.fn()}
    status="signedOut"
  />);
  expect(screen.queryByRole("button", { name: "先完成成年确认" })).toBeNull();
  expect(screen.getByLabelText("邮箱地址")).toBeTruthy();
});

test("offers device logout and separate cloud-account deletion when signed in", () => {
  render(<EmailAuthScreen
    adultAuthorized
    onBack={jest.fn()}
    onDeleteAccount={jest.fn()}
    onLogout={jest.fn()}
    onRequestEmail={jest.fn()}
    onVerifyCode={jest.fn()}
    status="offline"
  />);
  expect(screen.getByText("已登录（当前离线）")).toBeTruthy();
  expect(screen.getByRole("button", { name: "从这台设备退出登录" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "删除云端账户" })).toBeTruthy();
});


test("centers email and code input text and recalibrates the resend countdown on foreground", async () => {
  jest.useFakeTimers();
  const started = Date.parse("2026-10-14T12:00:00Z");
  jest.setSystemTime(started);
  let onState: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
    onState = callback;
    return { remove };
  });
  const requestEmail = jest.fn(async () => challenge);
  const view = render(<EmailAuthScreen adultAuthorized onBack={jest.fn()} onDeleteAccount={jest.fn()} onLogout={jest.fn()}
    onRequestEmail={requestEmail} onVerifyCode={jest.fn()} status="signedOut" />);
  expect(screen.getByLabelText("邮箱地址")).toHaveStyle({ paddingVertical: 0, textAlignVertical: "center", includeFontPadding: false });
  fireEvent.changeText(screen.getByLabelText("邮箱地址"), "person@example.com");
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "发送验证码" })); });
  expect(screen.getByLabelText("6 位验证码")).toHaveStyle({ paddingVertical: 0, textAlignVertical: "center", includeFontPadding: false });
  expect(screen.getByText("60 秒后可重新发送。")).toBeTruthy();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText("59 秒后可重新发送。")).toBeTruthy();
  act(() => { jest.setSystemTime(started + 61_000); onState?.("active"); });
  expect(screen.getByRole("button", { name: "重新发送验证码" })).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "重新发送验证码" })); });
  expect(requestEmail).toHaveBeenCalledTimes(2);
  expect(screen.getByText("60 秒后可重新发送。")).toBeTruthy();
  view.unmount();
  expect(remove).toHaveBeenCalled();
  jest.useRealTimers();
});

test("logs in with a password without requesting an OTP", async () => {
  const requestEmail = jest.fn();
  const onPasswordLogin = jest.fn(async () => undefined);
  render(<EmailAuthScreen adultAuthorized onBack={jest.fn()} onDeleteAccount={jest.fn()} onLogout={jest.fn()}
    onRequestEmail={requestEmail} onVerifyCode={jest.fn()} onPasswordLogin={onPasswordLogin} status="signedOut" />);
  fireEvent.press(screen.getByRole("button", { name: "密码登录" }));
  fireEvent.changeText(screen.getByLabelText("邮箱地址"), " Person@Example.com ");
  expect(screen.getByLabelText("密码")).toHaveProp("secureTextEntry", true);
  fireEvent.changeText(screen.getByLabelText("密码"), "exact password ");
  fireEvent.press(screen.getByRole("button", { name: "登录" }));
  await waitFor(() => expect(onPasswordLogin).toHaveBeenCalledWith("person@example.com", "exact password "));
  expect(requestEmail).not.toHaveBeenCalled();
});

test("requires a password for registration and sends it only with the verification submission", async () => {
  const onRegister = jest.fn(async () => undefined);
  const onVerifyCode = jest.fn();
  render(<EmailAuthScreen adultAuthorized onBack={jest.fn()} onDeleteAccount={jest.fn()} onLogout={jest.fn()}
    onRequestEmail={jest.fn(async () => challenge)} onVerifyCode={onVerifyCode} onRegister={onRegister} status="signedOut" />);
  fireEvent.press(screen.getByRole("button", { name: "注册 / 设置初始密码" }));
  fireEvent.changeText(screen.getByLabelText("邮箱地址"), "person@example.com");
  expect(screen.getByRole("button", { name: "发送验证码" })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("设置密码"), "long password");
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));
  await screen.findByLabelText("6 位验证码");
  fireEvent.changeText(screen.getByLabelText("6 位验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "注册并登录" }));
  await waitFor(() => expect(onRegister).toHaveBeenCalledWith(challenge.challengeId, "123456", "person@example.com", "long password"));
  expect(onVerifyCode).not.toHaveBeenCalled();
});
