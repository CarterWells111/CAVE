import { fireEvent, render, screen } from "@testing-library/react-native";

import PracticeRoute from "../../../app/(tabs)/practice";
import ProfileRoute from "../../../app/(tabs)/profile";
import ReviewsRoute from "../../../app/(tabs)/reviews";
import { createJourneyDraft } from "../journey/domain/types";

const mockPush = jest.fn();
const mockCardsListMetadata = jest.fn();
const mockReviewsListMetadata = jest.fn();
const mockShellStateLoad = jest.fn();
const mockReplaceActiveReview = jest.fn(async () => undefined);
let mockRuntime: unknown | null = null;

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useOptionalJourneyRuntime: () => mockRuntime,
}));

jest.mock("../account/runtime/AccountProfileProvider", () => ({
  useAccountProfile: () => ({
    status: "signedOut",
    error: null,
    retry: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCardsListMetadata.mockReset();
  mockReviewsListMetadata.mockReset();
  mockShellStateLoad.mockReset();
  mockReplaceActiveReview.mockReset().mockResolvedValue(undefined);
  mockRuntime = null;
});

test("keeps public reviews useful without reading private shell state", () => {
  render(<ReviewsRoute />);

  expect(screen.getByRole("button", { name: "按主题回顾：身体感受" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "按主题回顾：边界与表达" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "按主题回顾：沟通练习" })).toBeTruthy();
  expect(mockShellStateLoad).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "按主题回顾：身体感受" }));
  fireEvent.press(screen.getByRole("button", { name: "按主题回顾：边界与表达" }));
  fireEvent.press(screen.getByRole("button", { name: "按主题回顾：沟通练习" }));
  fireEvent.press(screen.getByRole("button", { name: "选择旅程" }));

  expect(mockPush.mock.calls).toEqual([
    ["/reviews/topic/body"],
    ["/reviews/topic/boundaries"],
    ["/practice/session"],
    ["/(tabs)"],
  ]);
});

test("shows truthful public profile empty states without archive reads", () => {
  render(<ProfileRoute />);

  expect(screen.getByText("还没有沟通卡")).toBeTruthy();
  expect(screen.getByText("还没有历史回顾")).toBeTruthy();
  expect(mockCardsListMetadata).not.toHaveBeenCalled();
  expect(mockReviewsListMetadata).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "设置" }));
  expect(mockPush).toHaveBeenCalledWith("/settings");
});

test("keeps the authorized reviews completion error retryable", async () => {
  mockShellStateLoad
    .mockRejectedValueOnce(new Error("private shell failure"))
    .mockResolvedValueOnce(null);
  mockRuntime = {
    replaceActiveReview: mockReplaceActiveReview,
    shellState: { load: mockShellStateLoad },
    snapshot: null,
  };

  render(<ReviewsRoute />);

  expect(await screen.findByText("暂时无法读取本机回顾状态。")).toBeTruthy();
  expect(screen.queryByText(/private shell failure/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "重试" }));

  expect(await screen.findByRole("button", { name: "选择旅程" })).toBeTruthy();
  expect(mockShellStateLoad).toHaveBeenCalledTimes(2);
});

test("keeps the public preset-practice destinations session-only", () => {
  render(<PracticeRoute />);

  fireEvent.press(screen.getByRole("button", { name: "开始说出暂停" }));
  fireEvent.press(screen.getByRole("button", { name: "开始调整靠近" }));

  expect(mockPush.mock.calls).toEqual([
    [{ pathname: "/practice/session", params: { scenario: "pause" } }],
    [{ pathname: "/practice/session", params: { scenario: "adjust" } }],
  ]);
  expect(mockShellStateLoad).not.toHaveBeenCalled();
  expect(mockCardsListMetadata).not.toHaveBeenCalled();
  expect(mockReviewsListMetadata).not.toHaveBeenCalled();
});

test("selecting journeys with an active review only opens the map and preserves the draft", async () => {
  const snapshot = { ...createJourneyDraft({ id: "existing-review", now: "2026-09-04" }), ageConfirmed: true, addressPreference: "你" as const, prefaceRead: true };
  mockShellStateLoad.mockResolvedValue({ initialJourneyId: "older", initialJourneyCompletedAt: "2026-09-03" });
  mockRuntime = { snapshot, shellState: { load: mockShellStateLoad }, replaceActiveReview: mockReplaceActiveReview };
  render(<ReviewsRoute />);
  fireEvent.press(await screen.findByRole("button", { name: "选择旅程" }));
  expect(mockPush).toHaveBeenCalledWith("/(tabs)");
  expect(mockReplaceActiveReview).not.toHaveBeenCalled();
  expect(mockRuntime).toMatchObject({ snapshot });
  expect(screen.queryByRole("button", { name: "确认开始新回顾" })).toBeNull();
});
