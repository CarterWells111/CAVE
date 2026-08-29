import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { EmailAuthScreen } from "./EmailAuthScreen";

const challenge = {
  contractVersion: "1" as const,
  requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
  challengeId: "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
  expiresInSeconds: 600,
  resendAfterSeconds: 60,
};

afterEach(() => { jest.restoreAllMocks(); });

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
  const failure = Object.assign(new Error(`account ${privateEmail} failed`), {
    code: "NETWORK_ERROR",
    status: 0,
    email: privateEmail,
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

  expect(warning).toHaveBeenCalledWith("auth.action.failed", {
    name: "AuthActionError",
    code: "NETWORK_ERROR",
    status: 0,
  });
  expect(JSON.stringify(warning.mock.calls)).not.toContain(privateEmail);
});

function deferredChallenge() {
  let resolve!: (value: typeof challenge) => void;
  const promise = new Promise<typeof challenge>((next) => { resolve = next; });
  return { promise, resolve };
}

test("does not initiate authentication before adulthood is locally declared", () => {
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
  fireEvent.press(screen.getByRole("button", { name: "先完成成年确认" }));
  expect(onAdultGate).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText("邮箱地址")).toBeNull();
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
