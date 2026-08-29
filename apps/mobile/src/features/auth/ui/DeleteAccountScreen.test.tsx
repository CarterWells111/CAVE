import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

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
    onRequestChallenge: jest.fn(async () => challenge),
    onVerifyChallenge: jest.fn(async () => grant),
    temporaryPreview: false,
    ...overrides,
  };
  render(<DeleteAccountScreen {...props} />);
  return props;
}

async function reachFinalConfirmation() {
  fireEvent.changeText(screen.getByLabelText("账户邮箱"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送删除验证码" }));
  await screen.findByLabelText("6 位删除验证码");
  fireEvent.changeText(screen.getByLabelText("6 位删除验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "验证并继续" }));
  await screen.findByText("请选择本机手记的处理方式");
}

test("最终删除前必须明确选择如何处理本机手记", async () => {
  setup();
  await reachFinalConfirmation();

  expect(screen.queryByRole("button", { name: "确认删除云端账户" })).toBeNull();
  expect(screen.getByText(/仍仅保存在本机/u)).toBeTruthy();
  expect(screen.getByText(/加密/u)).toBeTruthy();
  expect(screen.getByText(/删除账户后将无法再解锁/u)).toBeTruthy();
});

test("Expo Go 不声称可以加密持久保留本机手记", async () => {
  setup({ temporaryPreview: true });
  await reachFinalConfirmation();

  expect(screen.getByText(/当前是 Expo Go 临时预览/u)).toBeTruthy();
  expect(screen.getByText(/关闭 App 后即会丢失/u)).toBeTruthy();
  expect(screen.queryByText(/以加密状态保持锁定/u)).toBeNull();
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
