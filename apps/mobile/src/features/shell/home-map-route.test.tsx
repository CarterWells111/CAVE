import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useEffect as mockUseEffect } from "react";
import HomeRoute from "../../../app/(tabs)/index";
import { createJourneyDraft, type JourneyDraft } from "../journey/domain/types";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockCards = jest.fn();
const mockJournal = jest.fn();
const mockShellLoad = jest.fn();
const mockReplaceReview = jest.fn();
const mockConfirmAdult = jest.fn();
const mockGetSnapshot = jest.fn();
const mockRunAndRefresh = jest.fn(async (action: () => Promise<unknown>) => action());
let mockRuntime: ReturnType<typeof runtime> | null = null;
let mockAccount = { status: "signedOut" as "signedOut" | "ready" | "loading", profile: { displayName: "阿岚" } };
let mockBlur: (() => void) | undefined;
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useFocusEffect: (callback: () => (() => void) | undefined) => mockUseEffect(() => { const cleanup = callback(); mockBlur = cleanup; return cleanup; }, [callback]) }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({ useOptionalJourneyRuntime: () => mockRuntime }));
jest.mock("../account/runtime/AccountProfileProvider", () => ({ useAccountProfile: () => mockAccount }));
jest.mock("../journal/runtime/JournalAccessProvider", () => ({ useJournalAccess: () => ({ status: "ready", service: { listRecords: mockJournal } }) }));

function runtime(snapshot: JourneyDraft | null = null) {
  mockGetSnapshot.mockReturnValue(snapshot);
  return { snapshot, shellState: { load: mockShellLoad }, cards: { listMetadata: mockCards },
    replaceActiveReview: mockReplaceReview, runAndRefresh: mockRunAndRefresh,
    service: { confirmAdult: mockConfirmAdult, getSnapshot: mockGetSnapshot } };
}
function onboarded() {
  return { ...createJourneyDraft({ id: "existing", now: "2026-09-04T12:00:00.000Z" }), ageConfirmed: true, addressPreference: "妳" as const, prefaceRead: true };
}
const completed = { initialJourneyId: "completed", initialJourneyCompletedAt: "2026-09-04T12:00:00.000Z" };
beforeEach(() => {
  jest.clearAllMocks(); mockRuntime = null;
  mockAccount = { status: "signedOut", profile: { displayName: "阿岚" } };
  mockShellLoad.mockReset().mockResolvedValue(null);
  mockConfirmAdult.mockReset().mockResolvedValue(undefined);
  mockRunAndRefresh.mockImplementation(async (action) => action());
});

test("onboarding unlocks the map without completing the scenario or loading private records", async () => {
  mockRuntime = runtime(onboarded()); render(<HomeRoute />);
  expect(await screen.findByText("旅程 01")).toBeTruthy();
  expect(screen.getByText("旅程 06")).toBeTruthy();
  expect(screen.getByText("第一次过夜")).toBeTruthy();
  expect(screen.queryByText("当前沟通草稿")).toBeNull();
  expect(mockCards).not.toHaveBeenCalled(); expect(mockJournal).not.toHaveBeenCalled();
  expect(mockReplaceReview).not.toHaveBeenCalled();
});
test("completed users see map with no active draft", async () => {
  mockRuntime = runtime(); mockShellLoad.mockResolvedValue(completed); render(<HomeRoute />);
  expect(await screen.findByText("旅程 01")).toBeTruthy();
  expect(mockConfirmAdult).not.toHaveBeenCalled(); expect(mockCards).not.toHaveBeenCalled(); expect(mockJournal).not.toHaveBeenCalled();
});
test("opening a sample never replaces or initializes scenario data", async () => {
  const draft = onboarded(); mockRuntime = runtime(draft); render(<HomeRoute />);
  fireEvent.press(await screen.findByRole("button", { name: "打开旅程 04，样板" }));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/explore/[journeyId]", params: { journeyId: "journey-04" } });
  expect(mockConfirmAdult).not.toHaveBeenCalled(); expect(mockReplaceReview).not.toHaveBeenCalled(); expect(mockRuntime.snapshot).toBe(draft);
});
test("scenario entry continues an existing draft without initialization", async () => {
  mockRuntime = runtime(onboarded()); render(<HomeRoute />);
  fireEvent.press(await screen.findByRole("button", { name: "体验第一次过夜" }));
  await act(async () => undefined);
  expect(mockRouter.push).toHaveBeenCalledWith("/journey/body-knowledge");
  expect(mockConfirmAdult).not.toHaveBeenCalled(); expect(mockReplaceReview).not.toHaveBeenCalled();
});
test("scenario entry deliberately initializes only when no draft exists", async () => {
  mockRuntime = runtime(); mockShellLoad.mockResolvedValue(completed);
  mockConfirmAdult.mockImplementation(async () => { mockGetSnapshot.mockReturnValue({ ...onboarded(), prefaceRead: false }); });
  render(<HomeRoute />); fireEvent.press(await screen.findByRole("button", { name: "体验第一次过夜" }));
  await act(async () => undefined);
  expect(mockConfirmAdult).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/journey/preface", params: { entry: "first-overnight" } });
  expect(mockReplaceReview).not.toHaveBeenCalled();
});
test("scenario initialization failure is retryable without losing map or displaying raw errors", async () => {
  mockRuntime = runtime(); mockShellLoad.mockResolvedValue(completed); mockConfirmAdult.mockRejectedValueOnce(new Error("private failure"));
  render(<HomeRoute />); fireEvent.press(await screen.findByRole("button", { name: "体验第一次过夜" }));
  await act(async () => undefined);
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(screen.getByText("旅程 01")).toBeTruthy(); expect(screen.queryByText("private failure")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "体验第一次过夜" })); await act(async () => undefined);
  expect(mockConfirmAdult).toHaveBeenCalledTimes(2);
});
test("ignores scenario completion after home unmounts and prevents duplicate initialization", async () => {
  let resolve!: () => void; mockRuntime = runtime(); mockShellLoad.mockResolvedValue(completed);
  mockConfirmAdult.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
  const view = render(<HomeRoute />); fireEvent.press(await screen.findByRole("button", { name: "体验第一次过夜" }));
  fireEvent.press(screen.getByRole("button", { name: "体验第一次过夜" })); expect(mockConfirmAdult).toHaveBeenCalledTimes(1);
  view.unmount(); await act(async () => resolve()); expect(mockRouter.push).not.toHaveBeenCalled();
});
test("revocation hides an already displayed map", async () => {
  mockRuntime = runtime(onboarded()); const view = render(<HomeRoute />); await screen.findByText("旅程 01");
  mockRuntime = null; view.rerender(<HomeRoute />);
  expect(screen.queryByText("旅程 01")).toBeNull(); expect(screen.getByRole("button", { name: "开启旅程" })).toBeTruthy();
});
test("compact account action keeps login and profile destinations", async () => {
  mockRuntime = runtime(onboarded()); const view = render(<HomeRoute />);
  fireEvent.press(await screen.findByRole("button", { name: "登录" })); expect(mockRouter.push).toHaveBeenCalledWith("/auth/email");
  mockAccount = { status: "ready", profile: { displayName: "阿岚" } }; view.rerender(<HomeRoute />);
  fireEvent.press(screen.getByRole("button", { name: "查看阿岚的账号" })); expect(mockRouter.push).toHaveBeenCalledWith("/(tabs)/profile");
});
test("does not navigate from a retained home tab after focus is lost", async () => {
  let resolve!: () => void;
  mockRuntime = runtime(); mockShellLoad.mockResolvedValue(completed);
  mockConfirmAdult.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
  render(<HomeRoute />);
  fireEvent.press(await screen.findByRole("button", { name: "体验第一次过夜" }));
  act(() => { mockBlur?.(); });
  await act(async () => resolve());
  expect(mockRouter.push).not.toHaveBeenCalled();
});
