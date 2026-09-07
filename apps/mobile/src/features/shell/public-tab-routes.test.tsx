import { fireEvent, render, screen } from "@testing-library/react-native";

import PracticeRoute from "../../../app/(tabs)/practice";
import ProfileRoute from "../../../app/(tabs)/profile";
import ReviewsRoute from "../../../app/(tabs)/reviews";
import { Text as MockText } from "react-native";

const mockPush = jest.fn();
const mockCardsListMetadata = jest.fn();
const mockReviewsListMetadata = jest.fn();
const mockShellStateLoad = jest.fn();
const mockReplaceActiveReview = jest.fn(async () => undefined);
let mockRuntime: unknown | null = null;

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  Redirect: ({ href }: { href: string }) => <MockText>{href}</MockText>,
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

test("legacy reviews redirects to journal without reading private shell state", () => {
  render(<ReviewsRoute />);
  expect(screen.getByText("/(tabs)/journal")).toBeTruthy();
  expect(mockShellStateLoad).not.toHaveBeenCalled();
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

test("legacy reviews redirect does not replace an active draft", () => {
  mockRuntime = { shellState: { load: mockShellStateLoad }, replaceActiveReview: mockReplaceActiveReview };
  render(<ReviewsRoute />);
  expect(screen.getByText("/(tabs)/journal")).toBeTruthy();
  expect(mockReplaceActiveReview).not.toHaveBeenCalled();
  expect(mockShellStateLoad).not.toHaveBeenCalled();
});
