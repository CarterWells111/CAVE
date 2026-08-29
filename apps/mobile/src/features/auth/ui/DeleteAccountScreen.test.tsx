import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { MobileAuthApiError } from "../infrastructure/auth-api-client";
import { JournalDeletionCleanupRequiredError } from "../../journal/infrastructure/journal-repository";
import { DeleteAccountScreen } from "./DeleteAccountScreen";

const challenge = {
  contractVersion: "1" as const,
  requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
  challengeId: "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
  expiresInSeconds: 600,
  resendAfterSeconds: 60,
};
const grant = {
  contractVersion: "1" as const,
  requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
  deletionGrant: `cave_dg_${"d".repeat(43)}`,
  expiresInSeconds: 300,
};

function setup(overrides: Partial<React.ComponentProps<typeof DeleteAccountScreen>> = {}) {
  const props: React.ComponentProps<typeof DeleteAccountScreen> = {
    createIdempotencyKey: () => "mobile-delete-7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
    onBack: jest.fn(),
    onClearCurrentAccountJournal: jest.fn(async () => undefined),
    onComplete: jest.fn(),
    onDeleteAccount: jest.fn(async () => undefined),
    onEnsureJournalCleanup: jest.fn(async () => false),
    onRequestChallenge: jest.fn(async () => challenge),
    onVerifyChallenge: jest.fn(async () => grant),
    journalPersistence: "sqlcipher",
    ...overrides,
  };
  render(<DeleteAccountScreen {...props} />);
  return props;
}

async function reachFinalConfirmation() {
  fireEvent.changeText(await screen.findByLabelText("账户邮箱"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送删除验证码" }));
  await screen.findByLabelText("6 位删除验证码");
  fireEvent.changeText(screen.getByLabelText("6 位删除验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "验证并继续" }));
  await screen.findByText(/请选择本机手记的处理方式|本机手记已删除/u);
}

test("最终删除前必须明确选择如何处理本机手记", async () => {
  setup();
  await reachFinalConfirmation();

  expect(screen.queryByRole("button", { name: "确认删除云端账户" })).toBeNull();
  expect(screen.getByText(/仍仅保存在本机/u)).toBeTruthy();
  expect(screen.getByText(/加密/u)).toBeTruthy();
  expect(screen.getByText(/删除账户后将无法再解锁/u)).toBeTruthy();
});

test("Expo Go 说明保留的手记仍是本机明文且删除云端账户后保持锁定", async () => {
  setup({ journalPersistence: "plaintext-sqlite" });
  await reachFinalConfirmation();

  expect(screen.getByText(/当前是 Expo Go 开发预览/u)).toBeTruthy();
  expect(screen.getByText(/本机明文 SQLite/u)).toBeTruthy();
  expect(screen.getByText(/删除云端账户后内容保持锁定/u)).toBeTruthy();
  expect(screen.getByText(/卸载 Expo Go、清除项目数据或主动删除后不可恢复/u)).toBeTruthy();
  expect(screen.queryByText(/以加密状态保持锁定/u)).toBeNull();
});

test("memory-only fallback does not claim cross-restart persistence", async () => {
  setup({ journalPersistence: "memory-only" });
  await reachFinalConfirmation();

  expect(screen.getByText(/只存在于本次内存会话/u)).toBeTruthy();
  expect(screen.getByText(/关闭 App 后即会丢失/u)).toBeTruthy();
});

test("mount recovery preserves a previously committed local deletion", async () => {
  setup({ onEnsureJournalCleanup: jest.fn(async () => true) });

  expect(await screen.findByText(/本机手记已永久删除/u)).toBeTruthy();
  await reachFinalConfirmation();

  expect(screen.getByText("本机手记已删除")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "保留本机手记" })).toBeNull();
  expect(screen.getByRole("button", { name: "继续删除云端账户" })).toBeTruthy();
});

test("mount recovery blocks cloud deletion while durable cleanup is still pending", async () => {
  const ensure = jest.fn()
    .mockRejectedValueOnce(new JournalDeletionCleanupRequiredError(undefined, true))
    .mockResolvedValueOnce(true);
  setup({ onEnsureJournalCleanup: ensure });

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "本机手记已从 App 中删除，但安全清理尚未完成。请重试后再删除云端账户。",
  );
  expect(screen.queryByLabelText("账户邮箱")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "重试本机安全清理" }));

  expect(await screen.findByLabelText("账户邮箱")).toBeTruthy();
  expect(screen.getByText(/本机手记已永久删除/u)).toBeTruthy();
  expect(ensure).toHaveBeenCalledTimes(2);
});

test("mount recovery reports an unreadable local deletion state without claiming deletion", async () => {
  setup({
    onEnsureJournalCleanup: jest.fn(async () => {
      throw new Error("storage-read-failed");
    }),
  });

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "无法确认本机手记删除状态。为保护本机数据，暂不能删除云端账户。请重试。",
  );
  expect(screen.queryByText(/本机手记已永久删除/u)).toBeNull();
  expect(screen.queryByLabelText("账户邮箱")).toBeNull();
  expect(screen.getByRole("button", { name: "重试本机删除状态检查" })).toBeTruthy();
});

test("a single-item cleanup marker blocks cloud deletion without claiming all journals were deleted", async () => {
  const ensure = jest.fn()
    .mockResolvedValueOnce(false)
    .mockRejectedValueOnce(new JournalDeletionCleanupRequiredError())
    .mockResolvedValueOnce(false);
  const props = setup({ onEnsureJournalCleanup: ensure });
  await reachFinalConfirmation();
  fireEvent.press(screen.getByRole("button", { name: "保留本机手记" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除云端账户" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "本机有已删除内容的安全清理尚未完成。请重试后再删除云端账户。",
  );
  expect(screen.queryByText(/本机手记已永久删除/u)).toBeNull();
  expect(props.onDeleteAccount).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "完成安全清理并删除云端账户" }));
  await waitFor(() => expect(props.onComplete).toHaveBeenCalledTimes(1));
  expect(ensure).toHaveBeenCalledTimes(3);
});

test("发送删除验证码失败时显示可操作的认证错误", async () => {
  setup({
    onRequestChallenge: jest.fn(async () => {
      throw new MobileAuthApiError("RATE_LIMITED", 429, 42);
    }),
  });

  fireEvent.changeText(await screen.findByLabelText("账户邮箱"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送删除验证码" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "操作过于频繁。请等待 42 秒后重试。",
  );
});

test("验证删除验证码失败时显示过期原因并允许重新处理", async () => {
  setup({
    onVerifyChallenge: jest.fn(async () => {
      throw new MobileAuthApiError("AUTH_CODE_EXPIRED", 400);
    }),
  });

  fireEvent.changeText(await screen.findByLabelText("账户邮箱"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送删除验证码" }));
  await screen.findByLabelText("6 位删除验证码");
  fireEvent.changeText(screen.getByLabelText("6 位删除验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "验证并继续" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "验证码已过期。请重新获取验证码。",
  );
  fireEvent.press(screen.getByRole("button", { name: "重新获取验证码" }));
  expect(screen.getByLabelText("账户邮箱")).toBeTruthy();
  expect(screen.queryByLabelText("6 位删除验证码")).toBeNull();
});

test("保留本机手记时只删除云端账户", async () => {
  const props = setup();
  await reachFinalConfirmation();
  fireEvent.press(screen.getByRole("button", { name: "保留本机手记" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除云端账户" }));

  await waitFor(() => expect(props.onDeleteAccount).toHaveBeenCalledWith(
    expect.stringMatching(/^cave_dg_/u),
    "mobile-delete-7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
  ));
  expect(props.onClearCurrentAccountJournal).not.toHaveBeenCalled();
  expect(props.onComplete).toHaveBeenCalledTimes(1);
});

test("删除本机手记时先清除当前账户手记再删除云端账户", async () => {
  const calls: string[] = [];
  const props = setup({
    onClearCurrentAccountJournal: jest.fn(async () => { calls.push("local"); }),
    onDeleteAccount: jest.fn(async () => { calls.push("cloud"); }),
  });
  await reachFinalConfirmation();
  fireEvent.press(screen.getByRole("button", { name: "永久删除本机手记" }));
  fireEvent.press(screen.getByRole("button", { name: "删除手记并删除云端账户" }));

  await waitFor(() => expect(props.onComplete).toHaveBeenCalledTimes(1));
  expect(calls).toEqual(["local", "cloud"]);
});

test("本机手记删除失败时不调用云端删除且可重试", async () => {
  const clear = jest.fn().mockRejectedValueOnce(new Error("disk failure")).mockResolvedValueOnce(undefined);
  const props = setup({ onClearCurrentAccountJournal: clear });
  await reachFinalConfirmation();
  fireEvent.press(screen.getByRole("button", { name: "永久删除本机手记" }));
  fireEvent.press(screen.getByRole("button", { name: "删除手记并删除云端账户" }));

  expect(await screen.findByText("本机手记未能删除，云端账户保持不变。请重试。")).toBeTruthy();
  expect(props.onDeleteAccount).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "删除手记并删除云端账户" }));
  await waitFor(() => expect(props.onDeleteAccount).toHaveBeenCalledTimes(1));
  expect(clear).toHaveBeenCalledTimes(2);
});

test("本机手记已删除但云端删除失败时说明真实状态", async () => {
  const props = setup({ onDeleteAccount: jest.fn(async () => { throw new Error("network"); }) });
  await reachFinalConfirmation();
  fireEvent.press(screen.getByRole("button", { name: "永久删除本机手记" }));
  fireEvent.press(screen.getByRole("button", { name: "删除手记并删除云端账户" }));

  expect(await screen.findByText("本机手记已删除，但云端账户未能删除。请重试云端删除。")).toBeTruthy();
  expect(props.onComplete).not.toHaveBeenCalled();
});

test("删除已提交但安全清理失败时锁定选择并在重试成功后继续", async () => {
  const clear = jest.fn()
    .mockRejectedValueOnce(new JournalDeletionCleanupRequiredError(
      new Error("checkpoint-busy"),
      true,
    ))
    .mockResolvedValueOnce(undefined);
  const props = setup({ onClearCurrentAccountJournal: clear });
  await reachFinalConfirmation();
  fireEvent.press(screen.getByRole("button", { name: "永久删除本机手记" }));
  fireEvent.press(screen.getByRole("button", { name: "删除手记并删除云端账户" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "本机手记已从 App 中删除，但安全清理尚未完成。请重试后再删除云端账户。",
  );
  expect(screen.queryByRole("button", { name: "保留本机手记" })).toBeNull();
  expect(screen.queryByText(/若保留/u)).toBeNull();
  expect(props.onDeleteAccount).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "完成安全清理并删除云端账户" }));
  await waitFor(() => expect(props.onComplete).toHaveBeenCalledTimes(1));
  expect(clear).toHaveBeenCalledTimes(2);
  expect(props.onDeleteAccount).toHaveBeenCalledTimes(1);
});

test("删除授权过期时保留本机删除结果并重新完成邮箱验证", async () => {
  const clearJournal = jest.fn(async () => undefined);
  const deleteAccount = jest.fn()
    .mockRejectedValueOnce(new MobileAuthApiError("AUTH_REAUTH_REQUIRED", 401))
    .mockResolvedValueOnce(undefined);
  const createIdempotencyKey = jest.fn()
    .mockReturnValueOnce("mobile-delete-first")
    .mockReturnValueOnce("mobile-delete-second");
  const props = setup({
    createIdempotencyKey,
    onClearCurrentAccountJournal: clearJournal,
    onDeleteAccount: deleteAccount,
  });
  await reachFinalConfirmation();
  fireEvent.press(screen.getByRole("button", { name: "永久删除本机手记" }));
  fireEvent.press(screen.getByRole("button", { name: "删除手记并删除云端账户" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "删除验证已失效。请重新获取验证码。",
  );
  expect(screen.getByText(/本机手记已永久删除/u)).toBeTruthy();
  expect(screen.getByLabelText("账户邮箱")).toBeTruthy();
  expect(clearJournal).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByRole("button", { name: "发送删除验证码" }));
  await screen.findByLabelText("6 位删除验证码");
  fireEvent.changeText(screen.getByLabelText("6 位删除验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "验证并继续" }));
  await screen.findByText("本机手记已删除");
  expect(screen.queryByRole("button", { name: "保留本机手记" })).toBeNull();
  expect(screen.queryByRole("button", { name: "永久删除本机手记" })).toBeNull();
  expect(screen.queryByText(/若保留/u)).toBeNull();
  expect(screen.getByText(/只能继续删除云端账户/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "继续删除云端账户" }));

  await waitFor(() => expect(props.onComplete).toHaveBeenCalledTimes(1));
  expect(clearJournal).toHaveBeenCalledTimes(1);
  expect(deleteAccount).toHaveBeenNthCalledWith(
    2,
    expect.stringMatching(/^cave_dg_/u),
    "mobile-delete-second",
  );
});
