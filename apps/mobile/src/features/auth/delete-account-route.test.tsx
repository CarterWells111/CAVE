import { act, render } from "@testing-library/react-native";

import DeleteAccountRoute from "../../../app/auth/delete-account";

const mockClearCurrentAccount = jest.fn(async () => undefined);
const mockClearAssistantHistory = jest.fn(async () => undefined);
const mockEnsureDeletionCleanup = jest.fn(async () => false);
const mockAuth = {
  status: "signedIn",
  accountId: "account-a",
  createAccountDeletionIdempotencyKey: jest.fn(),
  deleteAccount: jest.fn(),
  requestAccountDeletionChallenge: jest.fn(),
  verifyAccountDeletionChallenge: jest.fn(),
};
let mockDeletionAccountId = "account-a";
jest.mock("../account/runtime/account-journal-deletion-context", () => ({
  useOptionalAccountJournalDeletion: () => ({ accountId: mockDeletionAccountId, clearCurrentAccountAssistantHistory: mockClearAssistantHistory }),
}));
let capturedProps: Record<string, unknown> | undefined;

jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("./runtime/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("../journal/runtime/JournalAccessProvider", () => ({
  useJournalAccess: () => ({
    clearCurrentAccount: mockClearCurrentAccount,
    ensureDeletionCleanup: mockEnsureDeletionCleanup,
    journalPersistence: "sqlcipher",
  }),
}));

jest.mock("./ui/DeleteAccountScreen", () => ({
  DeleteAccountScreen: (props: Record<string, unknown>) => {
    capturedProps = props;
    return null;
  },
}));

beforeEach(() => {
  capturedProps = undefined;
  mockDeletionAccountId = "account-a";
  mockClearAssistantHistory.mockResolvedValue(undefined);
  jest.clearAllMocks();
});

test("将当前账户的本机手记删除能力与持久化模式传给账户删除页", () => {
  render(<DeleteAccountRoute />);

  expect(capturedProps?.onClearCurrentAccountJournal).toBe(mockClearCurrentAccount);
  expect(capturedProps?.onEnsureJournalCleanup).toBe(mockEnsureDeletionCleanup);
  expect(capturedProps?.journalPersistence).toBe("sqlcipher");
});


test("clears only the deleting account's AI history before submitting account deletion", async () => {
  const events: string[] = [];
  mockClearAssistantHistory.mockImplementationOnce(async () => { events.push("local-history"); });
  mockAuth.deleteAccount.mockImplementationOnce(async () => { events.push("cloud-account"); });
  render(<DeleteAccountRoute />);
  await act(async () => { await (capturedProps?.onDeleteAccount as (grant: string, key: string) => Promise<void>)("grant", "key"); });
  expect(events).toEqual(["local-history", "cloud-account"]);
  expect(mockAuth.deleteAccount).toHaveBeenCalledWith("grant", "key");
});

test("local history cleanup failure blocks account deletion and permits retry", async () => {
  const failure = new Error("synthetic-write-failure");
  mockClearAssistantHistory.mockRejectedValueOnce(failure);
  render(<DeleteAccountRoute />);
  const remove = capturedProps?.onDeleteAccount as (grant: string, key: string) => Promise<void>;
  await expect(remove("grant", "key")).rejects.toBe(failure);
  expect(mockAuth.deleteAccount).not.toHaveBeenCalled();
  await remove("grant", "key");
  expect(mockAuth.deleteAccount).toHaveBeenCalledTimes(1);
});

test("refuses a stale account deletion capability before clearing history", async () => {
  mockDeletionAccountId = "account-b";
  render(<DeleteAccountRoute />);
  await expect((capturedProps?.onDeleteAccount as (grant: string, key: string) => Promise<void>)("grant", "key"))
    .rejects.toThrow("assistant-history-deletion-unavailable");
  expect(mockClearAssistantHistory).not.toHaveBeenCalled();
  expect(mockAuth.deleteAccount).not.toHaveBeenCalled();
});
