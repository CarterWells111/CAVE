import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { JourneyLongTermNav } from "./JourneyLongTermNav";

const mockReplace = jest.fn();
const mockLoad = jest.fn();
const mockRouter = { replace: mockReplace };
const mockShellState = { load: mockLoad };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../journey/runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => ({ shellState: mockShellState })
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => jest.clearAllMocks());

test("renders no long-term navigation while completion is loading or absent", async () => {
  const pending = deferred<null>();
  mockLoad.mockReturnValueOnce(pending.promise);
  render(<JourneyLongTermNav activeTab="home" />);

  expect(screen.queryAllByRole("tab")).toHaveLength(0);
  await act(async () => pending.resolve(null));
  expect(screen.queryAllByRole("tab")).toHaveLength(0);
  expect(mockReplace).not.toHaveBeenCalled();
});

test("reveals the four tabs only after a completion marker and routes each destination", async () => {
  mockLoad.mockResolvedValueOnce({
    initialJourneyId: "journey-1",
    initialJourneyCompletedAt: "2026-08-27T12:00:00.000Z"
  });
  render(<JourneyLongTermNav activeTab="practice" />);

  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(4));
  fireEvent.press(screen.getByRole("tab", { name: "首页" }));
  fireEvent.press(screen.getByRole("tab", { name: "回顾" }));
  fireEvent.press(screen.getByRole("tab", { name: "练习" }));
  fireEvent.press(screen.getByRole("tab", { name: "我的" }));

  expect(mockReplace.mock.calls).toEqual([
    ["/(tabs)"],
    ["/(tabs)/reviews"],
    ["/(tabs)/practice"],
    ["/(tabs)/profile"]
  ]);
});

test("fails closed when the completion marker cannot be read", async () => {
  mockLoad.mockRejectedValueOnce(new Error("private storage unavailable"));
  render(<JourneyLongTermNav activeTab="profile" />);

  await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1));
  await act(async () => undefined);
  expect(screen.queryAllByRole("tab")).toHaveLength(0);
  expect(mockReplace).not.toHaveBeenCalled();
});
