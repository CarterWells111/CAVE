import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import HomeRoute from "../../../app/(tabs)/index";
import { createJourneyDraft, type JourneyDraft } from "../journey/domain/types";

const mockPush = jest.fn();
const mockCardsListMetadata = jest.fn();
const mockShellStateLoad = jest.fn();
const mockReplaceActiveReview = jest.fn(async () => undefined);

type MockRuntime = {
  cards: { listMetadata: typeof mockCardsListMetadata };
  replaceActiveReview: typeof mockReplaceActiveReview;
  shellState: { load: typeof mockShellStateLoad };
  snapshot: JourneyDraft | null;
};

let mockRuntime: MockRuntime | null = null;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useOptionalJourneyRuntime: () => mockRuntime,
}));

function authorizedRuntime(snapshot: JourneyDraft | null = null): MockRuntime {
  return {
    cards: { listMetadata: mockCardsListMetadata },
    replaceActiveReview: mockReplaceActiveReview,
    shellState: { load: mockShellStateLoad },
    snapshot,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCardsListMetadata.mockReset();
  mockShellStateLoad.mockReset();
  mockReplaceActiveReview.mockReset().mockResolvedValue(undefined);
  mockRuntime = null;
});

test("renders the public first-run home without reading private repositories", () => {
  render(<HomeRoute />);

  expect(screen.getByRole("button", { name: "开启旅程" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "设置" })).toBeTruthy();
  expect(mockShellStateLoad).not.toHaveBeenCalled();
  expect(mockCardsListMetadata).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "开启旅程" }));
  fireEvent.press(screen.getByRole("button", { name: "设置" }));

  expect(mockPush.mock.calls).toEqual([["/journey/adult-gate"], ["/settings"]]);

  const scroll = screen.getByTestId("first-run-home-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.alwaysBounceVertical).toBe(false);
  expect(scroll.props.scrollEnabled).toBe(false);
  expect(typeof scroll.props.onLayout).toBe("function");
  expect(
    ReactNative.StyleSheet.flatten(screen.getByTestId("first-run-home-scroll").props.contentContainerStyle)
      .paddingVertical,
  ).toBe(0);
});

test("wires the real tab viewport measurement while keeping scroll disabled", () => {
  render(<HomeRoute />);

  const scroll = screen.getByTestId("first-run-home-scroll");

  expect(scroll.props.scrollEnabled).toBe(false);
  expect(typeof scroll.props.onLayout).toBe("function");
  expect(
    ReactNative.StyleSheet.flatten(screen.getByTestId("first-run-home-scroll").props.contentContainerStyle)
      .paddingVertical,
  ).toBe(0);
  expect(ReactNative.StyleSheet.flatten(screen.getByTestId("welcome-brand").props.style).paddingTop).toBe(0);
  expect(ReactNative.StyleSheet.flatten(screen.getByTestId("welcome-brand-names").props.style).flexDirection).toBe("row");
});

test("keeps the authorized home in its page-local loading state until completion resolves", async () => {
  const completion = deferred<null>();
  mockShellStateLoad.mockReturnValueOnce(completion.promise);
  mockRuntime = authorizedRuntime();

  render(<HomeRoute />);

  expect(screen.getByRole("status")).toBeTruthy();
  expect(mockCardsListMetadata).not.toHaveBeenCalled();

  await act(async () => completion.resolve(null));
  expect(await screen.findByRole("button", { name: "开启旅程" })).toBeTruthy();
});

test("shows a retryable completion error and recovers without loading cards", async () => {
  mockShellStateLoad
    .mockRejectedValueOnce(new Error("private completion failure"))
    .mockResolvedValueOnce(null);
  mockRuntime = authorizedRuntime();

  render(<HomeRoute />);

  expect(await screen.findByText("暂时无法读取本机首页内容。你的记录没有因此被删除。")).toBeTruthy();
  expect(screen.queryByText(/private completion failure/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "重试" }));

  expect(await screen.findByRole("button", { name: "开启旅程" })).toBeTruthy();
  expect(mockShellStateLoad).toHaveBeenCalledTimes(2);
  expect(mockCardsListMetadata).not.toHaveBeenCalled();
});

test("resumes an adult-confirmed unfinished journey through the preface", async () => {
  const snapshot = {
    ...createJourneyDraft({ id: "initial-journey", now: "2026-08-28T12:00:00.000Z" }),
    ageConfirmed: true,
  };
  mockShellStateLoad.mockResolvedValueOnce(null);
  mockRuntime = authorizedRuntime(snapshot);

  render(<HomeRoute />);

  fireEvent.press(await screen.findByRole("button", { name: "继续旅程" }));
  expect(mockPush).toHaveBeenCalledWith("/journey/preface");
  expect(mockCardsListMetadata).not.toHaveBeenCalled();
});

test("renders the long-term home and metadata-only cards after completion", async () => {
  mockShellStateLoad.mockResolvedValueOnce({
    initialJourneyId: "initial-journey",
    initialJourneyCompletedAt: "2026-08-28T12:00:00.000Z",
  });
  mockCardsListMetadata.mockResolvedValueOnce([
    { id: "card-1", journeyId: "initial-journey", savedAt: "2026-08-28T12:00:00.000Z" },
  ]);
  mockRuntime = authorizedRuntime();

  render(<HomeRoute />);

  expect(await screen.findAllByText("2026-08-28 · 已保存到本机")).toHaveLength(2);
  await waitFor(() => expect(mockCardsListMetadata).toHaveBeenCalledTimes(1));
  expect(mockShellStateLoad).toHaveBeenCalledTimes(1);
});
