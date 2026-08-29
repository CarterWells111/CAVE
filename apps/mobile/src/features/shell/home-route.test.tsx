import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import HomeRoute from "../../../app/(tabs)/index";
import { createJourneyDraft, type JourneyDraft } from "../journey/domain/types";

const mockPush = jest.fn();
const mockCardsListMetadata = jest.fn();
const mockShellStateLoad = jest.fn();
const mockReplaceActiveReview = jest.fn(async () => undefined);
const mockJournalListRecords = jest.fn();
let mockJournalAccess: {
  status: "locked" | "loading" | "ready" | "error";
  service?: { listRecords: typeof mockJournalListRecords };
} = { status: "locked" };
let mockAccountProfile: {
  status: "signedOut" | "loading" | "ready" | "error";
  profile?: { displayName: string; avatarUri?: string };
  email?: string;
} = { status: "signedOut" };

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

jest.mock("../journal/runtime/JournalAccessProvider", () => ({
  useJournalAccess: () => mockJournalAccess,
}));

jest.mock("../account/runtime/AccountProfileProvider", () => ({
  useAccountProfile: () => mockAccountProfile,
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
  mockJournalListRecords.mockReset().mockResolvedValue([]);
  mockJournalAccess = { status: "locked" };
  mockAccountProfile = { status: "signedOut" };
  mockRuntime = null;
});

test("does not read or expose recent journal metadata while signed out", async () => {
  mockShellStateLoad.mockResolvedValueOnce({
    initialJourneyId: "initial-journey",
    initialJourneyCompletedAt: "2026-08-28T12:00:00.000Z",
  });
  mockCardsListMetadata.mockResolvedValueOnce([]);
  mockRuntime = authorizedRuntime();

  render(<HomeRoute />);

  await screen.findByText("还没有最近手记");
  expect(mockJournalListRecords).not.toHaveBeenCalled();
});

test("shows only the signed-in account recent journal metadata", async () => {
  mockJournalAccess = { status: "ready", service: { listRecords: mockJournalListRecords } };
  mockJournalListRecords.mockResolvedValueOnce([{
    id: "journal-a",
    title: "账号 A 的事件",
    occurredAt: "2026-08-28T00:00:00.000Z",
    createdAt: "2026-08-28T10:00:00.000Z",
    highlight: { kind: "feeling", text: "安心" },
    topics: [],
  }]);
  mockShellStateLoad.mockResolvedValueOnce({
    initialJourneyId: "initial-journey",
    initialJourneyCompletedAt: "2026-08-28T12:00:00.000Z",
  });
  mockCardsListMetadata.mockResolvedValueOnce([]);
  mockRuntime = authorizedRuntime();

  render(<HomeRoute />);

  expect(await screen.findByText("账号 A 的事件")).toBeTruthy();
  expect(mockJournalListRecords).toHaveBeenCalledTimes(1);
});

test("discards an old account journal response after sign-out", async () => {
  const oldAccountJournal = deferred<Array<{
    id: string;
    title: string;
    occurredAt: string;
    createdAt: string;
    highlight: { kind: "feeling"; text: string };
    topics: never[];
  }>>();
  mockJournalAccess = { status: "ready", service: { listRecords: mockJournalListRecords } };
  mockJournalListRecords.mockReturnValueOnce(oldAccountJournal.promise);
  mockShellStateLoad.mockResolvedValue({
    initialJourneyId: "initial-journey",
    initialJourneyCompletedAt: "2026-08-28T12:00:00.000Z",
  });
  mockCardsListMetadata.mockResolvedValue([]);
  mockRuntime = authorizedRuntime();

  const view = render(<HomeRoute />);
  await waitFor(() => expect(mockJournalListRecords).toHaveBeenCalledTimes(1));
  mockJournalAccess = { status: "locked" };
  view.rerender(<HomeRoute />);
  await act(async () => oldAccountJournal.resolve([{
    id: "journal-a",
    title: "不应回写的账号 A 事件",
    occurredAt: "2026-08-28",
    createdAt: "2026-08-28T10:00:00.000Z",
    highlight: { kind: "feeling", text: "账号 A 的私密提要" },
    topics: [],
  }]));

  await screen.findByText("还没有最近手记");
  expect(screen.queryByText("不应回写的账号 A 事件")).toBeNull();
  expect(screen.queryByText("账号 A 的私密提要")).toBeNull();
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

test("keeps the first-entry brand page below the same device top inset as the journey route", () => {
  render(
    <SafeAreaProvider initialMetrics={{
      frame: { height: 844, width: 390, x: 0, y: 0 },
      insets: { bottom: 34, left: 0, right: 0, top: 47 },
    }}>
      <HomeRoute />
    </SafeAreaProvider>,
  );

  const contentStyle = ReactNative.StyleSheet.flatten(
    screen.getByTestId("first-run-home-scroll").props.contentContainerStyle,
  );
  expect(contentStyle.paddingTop).toBe(47);
});

test("keeps the resumable first-journey brand page below the same device top inset", async () => {
  const snapshot = {
    ...createJourneyDraft({ id: "initial-journey", now: "2026-08-28T12:00:00.000Z" }),
    ageConfirmed: true,
  };
  mockShellStateLoad.mockResolvedValueOnce(null);
  mockRuntime = authorizedRuntime(snapshot);

  render(
    <SafeAreaProvider initialMetrics={{
      frame: { height: 844, width: 390, x: 0, y: 0 },
      insets: { bottom: 34, left: 0, right: 0, top: 47 },
    }}>
      <HomeRoute />
    </SafeAreaProvider>,
  );

  await screen.findByRole("button", { name: "继续旅程" });
  const contentStyle = ReactNative.StyleSheet.flatten(
    screen.getByTestId("first-run-home-scroll").props.contentContainerStyle,
  );
  expect(contentStyle.paddingTop).toBe(47);
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

  expect(await screen.findAllByText("2026-08-28 · 已保存到本机")).toHaveLength(1);
  await waitFor(() => expect(mockCardsListMetadata).toHaveBeenCalledTimes(1));
  expect(mockShellStateLoad).toHaveBeenCalledTimes(1);
});

test("routes the completed signed-out home CTA directly to email login", async () => {
  mockShellStateLoad.mockResolvedValueOnce({
    initialJourneyId: "initial-journey",
    initialJourneyCompletedAt: "2026-08-28T12:00:00.000Z",
  });
  mockCardsListMetadata.mockResolvedValueOnce([]);
  mockRuntime = authorizedRuntime();

  render(<HomeRoute />);

  fireEvent.press(await screen.findByRole("button", { name: "去登录，享受更多功能" }));
  expect(mockPush).toHaveBeenCalledWith("/auth/email");
});

test("routes a ready account entry to profile without another login prompt", async () => {
  mockAccountProfile = { status: "ready", profile: { displayName: "阿岚" }, email: "person@example.com" };
  mockShellStateLoad.mockResolvedValueOnce({
    initialJourneyId: "initial-journey",
    initialJourneyCompletedAt: "2026-08-28T12:00:00.000Z",
  });
  mockCardsListMetadata.mockResolvedValueOnce([]);
  mockRuntime = authorizedRuntime();

  render(<HomeRoute />);

  expect(await screen.findByRole("button", { name: "查看阿岚的账号" })).toBeTruthy();
  expect(screen.queryByText("去登录，享受更多功能")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "查看阿岚的账号" }));
  expect(mockPush).toHaveBeenCalledWith("/(tabs)/profile");
});
