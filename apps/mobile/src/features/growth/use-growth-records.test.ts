import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useGrowthRecords } from "./use-growth-records";

let mockAuth: { status: "signedIn" | "signedOut" | "loading" | "offline"; accountId?: string };
let mockAccess: {
  status: "ready" | "loading" | "error" | "locked"; accountId?: string;
  service?: { listRecords: jest.Mock; listPeriodReviews: jest.Mock }; retry: jest.Mock;
};
let mockRuntime: { reviewHistory: { listMetadata: jest.Mock } } | null;
let mockHistory: { conversations: unknown[]; loading: boolean; error: string | null; retry: jest.Mock; subscribeToClear: jest.Mock };
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = jest.requireActual<typeof import("react")>("react");
    React.useEffect(effect, [effect]);
  },
}));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => mockAuth }));
jest.mock("../journal/runtime/JournalAccessProvider", () => ({ useOptionalJournalAccess: () => mockAccess }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({ useOptionalJourneyRuntime: () => mockRuntime }));
jest.mock("../assistant/AssistantHistoryProvider", () => ({ useOptionalAssistantHistory: () => mockHistory }));

const timestamp = "2026-10-23T10:00:00.000Z";
const service = (id: string) => ({
  listRecords: jest.fn(async () => [{ id, createdAt: timestamp }]),
  listPeriodReviews: jest.fn(async () => []),
});
beforeEach(() => {
  mockAuth = { status: "signedIn", accountId: "account-a" };
  mockAccess = { status: "ready", accountId: "account-a", service: service("a"), retry: jest.fn() };
  mockRuntime = { reviewHistory: { listMetadata: jest.fn(async () => []) } };
  mockHistory = { conversations: [], loading: false, error: null, retry: jest.fn(async () => undefined), subscribeToClear: jest.fn(() => () => undefined) };
});

test("loads current account metadata and exposes source failures without partial zero statistics", async () => {
  mockRuntime!.reviewHistory.listMetadata.mockRejectedValueOnce(new Error("synthetic-read-failure"));
  const { result } = renderHook(() => useGrowthRecords());
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.data.events).toEqual([]);
  expect(result.current.loading).toBe(false);
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.data.events).toHaveLength(1));
  expect(result.current.error).toBe(false);
});

test("account changes hide existing data immediately and reject the old account's late read", async () => {
  let finishOld!: (value: { id: string; createdAt: string }[]) => void;
  mockAccess.service!.listRecords.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  const { result, rerender } = renderHook(() => useGrowthRecords());
  expect(result.current.loading).toBe(true);
  mockAuth = { status: "signedIn", accountId: "account-b" };
  mockAccess = { status: "ready", accountId: "account-b", service: service("b"), retry: jest.fn() };
  rerender({});
  expect(result.current.data.events).toEqual([]);
  await waitFor(() => expect(result.current.data.events[0]?.id).toBe("b"));
  await act(async () => { finishOld([{ id: "a", createdAt: timestamp }]); });
  expect(result.current.data.events.map(event => event.id)).toEqual(["b"]);
});

test("a service change for the same account clears the previous snapshot", async () => {
  const { result, rerender } = renderHook(() => useGrowthRecords());
  await waitFor(() => expect(result.current.data.events[0]?.id).toBe("a"));
  let finish!: (value: { id: string; createdAt: string }[]) => void;
  const replacement = service("new");
  replacement.listRecords.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mockAccess = { ...mockAccess, service: replacement };
  rerender({});
  expect(result.current.data.events).toEqual([]);
  expect(result.current.loading).toBe(true);
  await act(async () => { finish([{ id: "new", createdAt: timestamp }]); });
  expect(result.current.data.events[0]?.id).toBe("new");
});

test("signed-out access stays locked and does not read repositories", () => {
  mockAuth = { status: "signedOut" };
  const read = mockAccess.service!.listRecords;
  const { result } = renderHook(() => useGrowthRecords());
  expect(result.current.locked).toBe(true);
  expect(result.current.loading).toBe(false);
  expect(read).not.toHaveBeenCalled();
});

test("AI updates recompute metadata without refetching journal sources", async () => {
  const read = mockAccess.service!.listRecords;
  const { result, rerender } = renderHook(() => useGrowthRecords());
  await waitFor(() => expect(result.current.loading).toBe(false));
  mockHistory = { ...mockHistory, conversations: [{
    id: "chat", turns: [{ question: "q", response: {}, createdAt: timestamp }],
  }] };
  rerender({});
  expect(result.current.data.events.filter(event => event.metric === "ai")).toHaveLength(1);
  expect(read).toHaveBeenCalledTimes(1);
});

test("account-clear notification removes a stale snapshot and reloads current records", async () => {
  const { result } = renderHook(() => useGrowthRecords());
  await waitFor(() => expect(result.current.data.events).toHaveLength(1));
  mockAccess.service!.listRecords.mockResolvedValue([]);
  const onClear = mockHistory.subscribeToClear.mock.calls[0]![0] as () => void;
  act(() => onClear());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data.events).toEqual([]);
});
