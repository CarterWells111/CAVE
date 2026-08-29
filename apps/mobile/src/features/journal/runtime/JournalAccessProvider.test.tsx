import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { JournalAccessProvider, useJournalAccess } from "./JournalAccessProvider";

const claimLegacyRecords = jest.fn(async () => undefined);
const clearCurrentAccount = jest.fn(async () => undefined);
const createJournalService = jest.fn(() => ({ claimLegacyRecords, clearCurrentAccount }));
let mockAuth: { status: "loading" | "signedOut" | "signedIn" | "offline"; accountId?: string } = { status: "signedOut" };
let mockRuntime: { mode: "expo-go-demo" | "native-secure"; createJournalService: typeof createJournalService } | null = {
  mode: "native-secure",
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
  return <Text>{`${access.status}:${access.accountId ?? "none"}:${access.temporaryPreview}`}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  claimLegacyRecords.mockResolvedValue(undefined);
  mockAuth = { status: "signedOut" };
  mockRuntime = { mode: "native-secure", createJournalService };
});

test("keeps the journal locked and unopened while signed out", () => {
  render(<JournalAccessProvider><Probe /></JournalAccessProvider>);

  expect(screen.getByText("locked:none:false")).toBeTruthy();
  expect(createJournalService).not.toHaveBeenCalled();
});

test.each(["signedIn", "offline"] as const)("claims legacy rows and exposes the %s account service", async (status) => {
  mockAuth = { status, accountId: "account-a" };
  render(<JournalAccessProvider><Probe /></JournalAccessProvider>);

  expect(screen.getByText("loading:account-a:false")).toBeTruthy();
  await waitFor(() => expect(screen.getByText("ready:account-a:false")).toBeTruthy());
  expect(createJournalService).toHaveBeenCalledWith("account-a");
  expect(claimLegacyRecords).toHaveBeenCalledTimes(1);
});

test("reports a retryable error without exposing the service when legacy claiming fails", async () => {
  mockAuth = { status: "signedIn", accountId: "account-a" };
  claimLegacyRecords.mockRejectedValueOnce(new Error("claim-failed"));
  render(<JournalAccessProvider><Probe /></JournalAccessProvider>);

  await waitFor(() => expect(screen.getByText("error:account-a:false")).toBeTruthy());
});

test("marks Expo Go journal access as temporary", async () => {
  mockAuth = { status: "signedIn", accountId: "account-a" };
  mockRuntime = { mode: "expo-go-demo", createJournalService };
  render(<JournalAccessProvider><Probe /></JournalAccessProvider>);

  await waitFor(() => expect(screen.getByText("ready:account-a:true")).toBeTruthy());
});
