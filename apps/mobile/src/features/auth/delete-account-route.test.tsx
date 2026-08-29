import { render } from "@testing-library/react-native";

import DeleteAccountRoute from "../../../app/auth/delete-account";

const mockClearCurrentAccount = jest.fn(async () => undefined);
const mockAuth = {
  status: "signedIn",
  createAccountDeletionIdempotencyKey: jest.fn(),
  deleteAccount: jest.fn(),
  requestAccountDeletionChallenge: jest.fn(),
  verifyAccountDeletionChallenge: jest.fn(),
};
let capturedProps: Record<string, unknown> | undefined;

jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("./runtime/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("../journal/runtime/JournalAccessProvider", () => ({
  useJournalAccess: () => ({ clearCurrentAccount: mockClearCurrentAccount, temporaryPreview: false }),
}));

jest.mock("./ui/DeleteAccountScreen", () => ({
  DeleteAccountScreen: (props: Record<string, unknown>) => {
    capturedProps = props;
    return null;
  },
}));

beforeEach(() => {
  capturedProps = undefined;
  jest.clearAllMocks();
});

test("将当前账户的本机手记删除能力与持久化模式传给账户删除页", () => {
  render(<DeleteAccountRoute />);

  expect(capturedProps?.onClearCurrentAccountJournal).toBe(mockClearCurrentAccount);
  expect(capturedProps?.temporaryPreview).toBe(false);
});
