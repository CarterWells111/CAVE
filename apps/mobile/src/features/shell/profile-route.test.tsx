import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ProfileRoute from "../../../app/(tabs)/profile";

const mockPush = jest.fn();
const mockCardsListMetadata = jest.fn();
const mockReviewsListMetadata = jest.fn();
const mockCards = { listMetadata: mockCardsListMetadata };
const mockReviewHistory = { listMetadata: mockReviewsListMetadata };
let mockRuntime = { cards: mockCards, reviewHistory: mockReviewHistory };

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => mockRuntime,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRuntime = { cards: mockCards, reviewHistory: mockReviewHistory };
});

test("loads metadata-only card and review archives and opens their destinations", async () => {
  const cardRecords = [
    { id: "card-1", journeyId: "journey-1", savedAt: "2026-08-28T10:00:00.000Z" },
  ];
  const reviewRecords = [
    {
      id: "review-1",
      rootId: "root-1",
      parentVersionId: null,
      title: "最近回顾",
      createdAt: "2026-08-27T10:00:00.000Z",
      status: "completed",
    },
  ];
  const cardsPromise = Promise.resolve(cardRecords);
  const reviewsPromise = Promise.resolve(reviewRecords);
  mockCardsListMetadata.mockReturnValueOnce(cardsPromise);
  mockReviewsListMetadata.mockReturnValueOnce(reviewsPromise);

  render(<ProfileRoute />);

  await waitFor(() => expect(mockCardsListMetadata).toHaveBeenCalledTimes(1));
  expect(mockCardsListMetadata.mock.results[0]?.value).toBe(cardsPromise);
  expect(mockReviewsListMetadata.mock.results[0]?.value).toBe(reviewsPromise);
  expect(await screen.findByText("2026-08-28 · 仅存本机")).toBeTruthy();
  expect(await screen.findByText("2026-08-27 · 已完成")).toBeTruthy();
  expect(mockCardsListMetadata).toHaveBeenCalledTimes(1);
  expect(mockReviewsListMetadata).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByRole("button", { name: "设置" }));
  fireEvent.press(screen.getByRole("button", { name: "打开沟通卡，2026-08-28，仅存本机" }));
  fireEvent.press(screen.getByRole("button", { name: "打开最近回顾，2026-08-27，已完成" }));

  expect(mockPush.mock.calls).toEqual([
    ["/settings"],
    ["/cards/card-1"],
    ["/reviews/review-1"],
  ]);
});

test("keeps reviews usable when cards fail and retries only cards", async () => {
  mockCardsListMetadata
    .mockRejectedValueOnce(new Error("private card database path"))
    .mockResolvedValueOnce([
      { id: "card-2", journeyId: "journey-2", savedAt: "2026-08-26T10:00:00.000Z" },
    ]);
  mockReviewsListMetadata.mockResolvedValueOnce([
    {
      id: "review-2",
      rootId: "root-2",
      parentVersionId: null,
      title: "仍可查看的回顾",
      createdAt: "2026-08-25T10:00:00.000Z",
      status: "incomplete",
    },
  ]);

  render(<ProfileRoute />);

  expect(await screen.findByText("暂时无法读取本机沟通卡。")).toBeTruthy();
  expect(screen.getByText("仍可查看的回顾")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试读取卡片" }));

  await waitFor(() => expect(screen.getByText("2026-08-26 · 仅存本机")).toBeTruthy());
  expect(mockCardsListMetadata).toHaveBeenCalledTimes(2);
  expect(mockReviewsListMetadata).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/private card database path/u)).toBeNull();
});

test("ignores a stale card request after the card repository changes", async () => {
  let resolveOldCards!: (records: Array<{ id: string; journeyId: string; savedAt: string }>) => void;
  const oldCardsPromise = new Promise<Array<{ id: string; journeyId: string; savedAt: string }>>((resolve) => {
    resolveOldCards = resolve;
  });
  const newCardsListMetadata = jest.fn().mockResolvedValue([
    { id: "new-card", journeyId: "journey-new", savedAt: "2026-08-28T12:00:00.000Z" },
  ]);
  mockCardsListMetadata.mockReturnValueOnce(oldCardsPromise);
  mockReviewsListMetadata.mockResolvedValue([]);

  const view = render(<ProfileRoute />);
  await waitFor(() => expect(mockCardsListMetadata).toHaveBeenCalledTimes(1));

  mockRuntime = {
    cards: { listMetadata: newCardsListMetadata },
    reviewHistory: mockReviewHistory,
  };
  view.rerender(<ProfileRoute />);

  expect(await screen.findByText("2026-08-28 · 仅存本机")).toBeTruthy();
  await act(async () => {
    resolveOldCards([
      { id: "old-card", journeyId: "journey-old", savedAt: "2026-08-20T12:00:00.000Z" },
    ]);
  });

  expect(screen.queryByText("2026-08-20 · 仅存本机")).toBeNull();
  expect(mockReviewsListMetadata).toHaveBeenCalledTimes(1);
});
