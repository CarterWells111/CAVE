import { render } from "@testing-library/react-native";

import ReviewDetailRoute from "../../../app/reviews/[id]";
import { createJourneyDraft } from "../journey/domain/types";

declare const __dirname: string;

const { readFileSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
const { resolve } = jest.requireActual<typeof import("node:path")>("node:path");

const mockReplace = jest.fn();
const mockRedirect = jest.fn();
const mockLoadShellState = jest.fn();
const mockLoadDetail = jest.fn();
const mockLoadBranchSeed = jest.fn();
const mockDeleteVersion = jest.fn();
const mockBranchFromReview = jest.fn();
const mockRunAndRefresh = jest.fn(async (action: () => Promise<unknown>) => action());

const reviewDraft = {
  ...createJourneyDraft({ id: "journey-1", now: "2026-08-27T12:00:00.000Z" }),
  currentPage: "reflection" as const,
  journal: {
    text: "只在授权后读取的本机日记",
    saveChoice: "device" as const
  }
};

const reviewDetail = {
  id: "review-1",
  rootId: "root-1",
  parentVersionId: null,
  title: "边界与表达",
  createdAt: "2026-08-27T12:00:00.000Z",
  status: "completed" as const,
  payload: reviewDraft
};

const authorizedRuntime = {
  shellState: { load: mockLoadShellState },
  reviewHistory: {
    loadDetail: mockLoadDetail,
    loadBranchSeed: mockLoadBranchSeed,
    deleteVersion: mockDeleteVersion
  },
  branchFromReview: mockBranchFromReview,
  runAndRefresh: mockRunAndRefresh
};

let mockOptionalRuntime: typeof authorizedRuntime | null = null;
const mockUseJourneyRuntime = jest.fn(() => authorizedRuntime);

jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props);
    return null;
  },
  useLocalSearchParams: () => ({ id: "review-1" }),
  useRouter: () => ({ replace: mockReplace })
}));

jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => {
    mockUseJourneyRuntime();
    return authorizedRuntime;
  },
  useOptionalJourneyRuntime: () => mockOptionalRuntime
}));

function routeSource(path: string) {
  return readFileSync(resolve(__dirname, "../../../app", path), "utf8");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOptionalRuntime = null;
  mockLoadShellState.mockReset();
  mockLoadShellState.mockResolvedValue(null);
  mockLoadDetail.mockReset();
  mockLoadDetail.mockResolvedValue(reviewDetail);
  mockLoadBranchSeed.mockReset();
  mockLoadBranchSeed.mockResolvedValue({
    rootId: "root-1",
    sourceVersionId: "review-1",
    suggestedTitle: "边界与表达",
    payload: reviewDraft
  });
  mockDeleteVersion.mockReset();
  mockDeleteVersion.mockResolvedValue(true);
  mockBranchFromReview.mockReset();
  mockBranchFromReview.mockResolvedValue(undefined);
});

test("keeps public layouts open while saved cards retain their route gate", () => {
  for (const path of ["(tabs)/_layout.tsx", "practice/_layout.tsx", "reviews/_layout.tsx"]) {
    expect(routeSource(path)).not.toContain("ShellRouteGate");
  }
  expect(routeSource("cards/_layout.tsx")).toContain("ShellRouteGate");
});

test("redirects a public review detail deep link without touching private history", () => {
  render(<ReviewDetailRoute />);

  expect(mockRedirect).toHaveBeenCalledWith({ href: "/journey/welcome" });
  expect(mockUseJourneyRuntime).not.toHaveBeenCalled();
  expect(mockLoadShellState).not.toHaveBeenCalled();
  expect(mockLoadDetail).not.toHaveBeenCalled();
});
