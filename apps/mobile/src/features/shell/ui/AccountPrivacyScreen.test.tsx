import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { AccountPrivacyScreen } from "./AccountPrivacyScreen";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function privacyCapability(
  overrides: Partial<
    NonNullable<React.ComponentProps<typeof AccountPrivacyScreen>["privacy"]>
  > = {},
) {
  return {
    changeJournalSaveNotice: jest.fn(async () => undefined),
    retry: jest.fn(),
    showLocalJournalSaveNotice: true,
    status: "ready" as const,
    ...overrides,
  };
}

function renderScreen(
  overrides: Partial<React.ComponentProps<typeof AccountPrivacyScreen>> = {},
) {
  const deleteAllData = jest.fn(async () => undefined);
  const onContinue = jest.fn();
  const props = {
    signedIn: false,
    onSignIn: jest.fn(),

    deletion: { deleteAllData, onContinue },

    onBack: jest.fn(),
    privacy: privacyCapability(),

    ...overrides,
  };
  render(<AccountPrivacyScreen {...props} />);
  return { ...props, deleteAllData, onContinue };
}

afterEach(() => jest.restoreAllMocks());
test("does not render a deletion action when no real deletion capability is supplied", () => {
  renderScreen({ deletion: undefined });

  expect(screen.getByRole("header", { name: "账号与隐私" })).toBeTruthy();
  expect(screen.getByText("隐私与本机数据")).toBeTruthy();
  expect(screen.queryByRole("header", { name: "删除本机数据" })).toBeNull();
  expect(screen.queryByRole("button", { name: "删除全部本机数据" })).toBeNull();
});

test("does not expose a private journal preference without an authorized runtime", () => {
  renderScreen({ privacy: undefined });

  expect(screen.getByText("隐私与本机数据")).toBeTruthy();
  expect(
    screen.queryByRole("switch", { name: "保存私人记录前显示本机提示" }),
  ).toBeNull();
});

test("requires an explicit second confirmation and supports cancellation", () => {
  const props = renderScreen();

  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));

  expect(screen.getByRole("alert")).toHaveTextContent(/无法恢复/u);
  expect(props.deleteAllData).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "确认删除全部本机数据" }),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "取消删除" }));
  expect(
    screen.queryByRole("button", { name: "确认删除全部本机数据" }),
  ).toBeNull();
  expect(props.deleteAllData).not.toHaveBeenCalled();
});

test("keeps deletion pending, blocks duplicate confirmation and never reports optimistic success", async () => {
  const deletion = deferred();
  const onDeleteAllData = jest.fn(() => deletion.promise);
  renderScreen({
    deletion: { deleteAllData: onDeleteAllData, onContinue: jest.fn() },
  });
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));

  const confirm = screen.getByRole("button", { name: "确认删除全部本机数据" });
  fireEvent.press(confirm);
  fireEvent.press(confirm);

  expect(onDeleteAllData).toHaveBeenCalledTimes(1);
  expect(screen.getByText("正在删除本机数据…")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "正在删除本机数据…" }).props
      .accessibilityState,
  ).toEqual(expect.objectContaining({ busy: true, disabled: true }));
  expect(screen.queryByText("本机数据已删除。")).toBeNull();

  await act(async () => {
    deletion.resolve();
  });
  expect(await screen.findByText("本机数据已删除。")).toBeTruthy();
});

test("keeps the settings screen on failure, hides private errors and retries truthfully", async () => {
  const onDeleteAllData = jest
    .fn()
    .mockRejectedValueOnce(new Error("private database path"))
    .mockResolvedValueOnce(undefined);
  const onContinue = jest.fn();
  renderScreen({ deletion: { deleteAllData: onDeleteAllData, onContinue } });
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "删除尚未完成；部分本机清理步骤可能已经完成。当前画面会保留，请安全重试直到显示完成。",
  );
  expect(screen.queryByText(/private database path/u)).toBeNull();
  expect(screen.getByRole("header", { name: "账号与隐私" })).toBeTruthy();
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

test("persists the private-journal notice switch without optimistic changes", async () => {
  const change = deferred();
  const onChangeJournalSaveNotice = jest.fn(() => change.promise);
  renderScreen({
    privacy: privacyCapability({
      changeJournalSaveNotice: onChangeJournalSaveNotice,
    }),
  });

  const noticeSwitch = screen.getByRole("switch", {
    name: "保存私人记录前显示本机提示",
  });
  expect(noticeSwitch).toHaveProp("value", true);
  fireEvent(noticeSwitch, "valueChange", false);
  expect(onChangeJournalSaveNotice).toHaveBeenCalledWith(false);
  expect(screen.getByText("正在保存设置…")).toBeTruthy();
  expect(noticeSwitch).toHaveProp("value", true);

  await act(async () => {
    change.resolve();
  });
  expect(screen.queryByText("正在保存设置…")).toBeNull();
});

test("keeps the original journal preference and shows a retryable error when saving fails", async () => {
  const onChangeJournalSaveNotice = jest.fn(async () => {
    throw new Error("private path");
  });
  renderScreen({
    privacy: privacyCapability({
      changeJournalSaveNotice: onChangeJournalSaveNotice,
      showLocalJournalSaveNotice: false,
    }),
  });

  const noticeSwitch = screen.getByRole("switch", {
    name: "保存私人记录前显示本机提示",
  });
  fireEvent(noticeSwitch, "valueChange", true);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "设置尚未保存，请重试。",
  );
  expect(screen.queryByText("private path")).toBeNull();
  expect(noticeSwitch).toHaveProp("value", false);
});

test("falls back visibly when privacy settings cannot be read", () => {
  const onRetryPrivacySettings = jest.fn();
  renderScreen({
    privacy: privacyCapability({
      retry: onRetryPrivacySettings,
      status: "error",
    }),
  });

  expect(screen.getByRole("alert")).toHaveTextContent(
    "暂时无法读取本机隐私设置；保存提示会保持开启。",
  );
  fireEvent.press(screen.getByRole("button", { name: "重试读取隐私设置" }));
  expect(onRetryPrivacySettings).toHaveBeenCalledTimes(1);
});

test("logout requires confirmation and cancel performs no operation", async () => {
  const onLogout = jest.fn(async () => undefined);
  const onDeleteAccount = jest.fn();
  renderScreen({ signedIn: true, onLogout, onDeleteAccount });
  fireEvent.press(screen.getByRole("button", { name: "退出登录" }));
  expect(onLogout).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "取消退出" }));
  expect(onLogout).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "退出登录" }));
  fireEvent.press(screen.getByRole("button", { name: "确认退出登录" }));
  await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole("button", { name: "删除账号" }));
  expect(onDeleteAccount).toHaveBeenCalledTimes(1);
});
test("logout blocks duplicate clicks and retains retryable failures", async () => {
  const pending = deferred();
  const onLogout = jest.fn(() => pending.promise);
  renderScreen({ signedIn: true, onLogout });
  fireEvent.press(screen.getByRole("button", { name: "退出登录" }));
  const confirm = screen.getByRole("button", { name: "确认退出登录" });
  fireEvent.press(confirm);
  fireEvent.press(confirm);
  expect(onLogout).toHaveBeenCalledTimes(1);
  await act(async () => pending.reject(new Error("private path")));
  expect(screen.getByRole("alert")).toHaveTextContent("退出尚未完成，请重试。");
  expect(screen.queryByText("private path")).toBeNull();
});
