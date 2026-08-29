import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { JournalAccessProvider, useJournalAccess } from "./JournalAccessProvider";

const claimLegacyRecords = jest.fn(async () => undefined);
const clearCurrentAccount = jest.fn(async () => undefined);
const ensureDeletionCleanup = jest.fn(async () => false);
const createJournalService = jest.fn(() => ({
  claimLegacyRecords,
  clearCurrentAccount,
  ensureDeletionCleanup,
}));
let mockAuth: { status: "loading" | "signedOut" | "signedIn" | "offline"; accountId?: string } = { status: "signedOut" };
let mockRuntime: {
  mode: "expo-go-demo" | "native-secure";
  journalPersistence: "memory-only" | "plaintext-sqlite" | "sqlcipher";
  createJournalService: typeof createJournalService;
} | null = {
  mode: "native-secure",
  journalPersistence: "sqlcipher",
  createJournalService,
};

jest.mock("../../auth/runtime/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("../../journey/runtime/JourneyRuntimeProvider", () => ({
  useOptionalJourneyRuntime: () => mockRuntime,
}));

function Probe() {
  const access = useJournalAccess();
  return <Text>{`${access.status}:${access.accountId ?? "none"}:${access.journalPersistence}`}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  claimLegacyRecords.mockResolvedValue(undefined);
  ensureDeletionCleanup.mockResolvedValue(false);
  mockAuth = { status: "signedOut" };
  mockRuntime = { mode: "native-secure", journalPersistence: "sqlcipher", createJournalService };
});

test("keeps the journal locked and unopened while signed out", () => {
  render(<JournalAccessProvider><Probe /></JournalAccessProvider>);

  expect(screen.getByText("locked:none:sqlcipher")).toBeTruthy();
  expect(createJournalService).not.toHaveBeenCalled();
});

test.each(["signedIn", "offline"] as const)("claims legacy rows and exposes the %s account service", async (status) => {
  mockAuth = { status, accountId: "account-a" };
  render(<JournalAccessProvider><Probe /></JournalAccessProvider>);

  expect(screen.getByText("loading:account-a:sqlcipher")).toBeTruthy();
  await waitFor(() => expect(screen.getByText("ready:account-a:sqlcipher")).toBeTruthy());
  expect(createJournalService).toHaveBeenCalledWith("account-a");
  expect(claimLegacyRecords).toHaveBeenCalledTimes(1);
});

test("reports a retryable error without exposing the service when legacy claiming fails", async () => {
  mockAuth = { status: "signedIn", accountId: "account-a" };
  claimLegacyRecords.mockRejectedValueOnce(new Error("claim-failed"));
  render(<JournalAccessProvider><Probe /></JournalAccessProvider>);

  await waitFor(() => expect(screen.getByText("error:account-a:sqlcipher")).toBeTruthy());
});

test("exposes Expo Go journal access as persistent plaintext SQLite", async () => {
  mockAuth = { status: "signedIn", accountId: "account-a" };
  mockRuntime = {
    mode: "expo-go-demo",
    journalPersistence: "plaintext-sqlite",
    createJournalService,
  };
  render(<JournalAccessProvider><Probe /></JournalAccessProvider>);

  await waitFor(() => expect(screen.getByText("ready:account-a:plaintext-sqlite")).toBeTruthy());
});

test("logout locks without deleting and the same account can reopen its journal service", async () => {
  mockAuth = { status: "signedIn", accountId: "account-a" };
  const view = render(<JournalAccessProvider><Probe /></JournalAccessProvider>);
  await waitFor(() => expect(screen.getByText("ready:account-a:sqlcipher")).toBeTruthy());

  mockAuth = { status: "signedOut" };
  view.rerender(<JournalAccessProvider><Probe /></JournalAccessProvider>);
  expect(screen.getByText("locked:none:sqlcipher")).toBeTruthy();
  expect(clearCurrentAccount).not.toHaveBeenCalled();

  mockAuth = { status: "signedIn", accountId: "account-a" };
  view.rerender(<JournalAccessProvider><Probe /></JournalAccessProvider>);
  await waitFor(() => expect(createJournalService).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByText("ready:account-a:sqlcipher")).toBeTruthy());
  expect(claimLegacyRecords).toHaveBeenCalledTimes(2);
  expect(clearCurrentAccount).not.toHaveBeenCalled();
});
