import { fireEvent, render, screen } from "@testing-library/react-native";
import GrowthRoute from "../../../app/growth";

const mockPush = jest.fn(), mockBack = jest.fn(), mockStage = jest.fn();
let mockAuth: { accountId?: string } = { accountId: "account-a" };
const mockGrowth = { data: { events: [], undatedAiTurns: 0, notes: [] }, loading: false, locked: false, error: false, reload: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: mockBack, canGoBack: () => true, replace: mockPush }) }));
jest.mock("../auth/runtime/AuthProvider", () => ({ useOptionalAuth: () => mockAuth }));
jest.mock("../assistant/growth-review-entry", () => ({ stageGrowthReviewEntry: (...args: unknown[]) => mockStage(...args) }));
jest.mock("./use-growth-records", () => ({ useGrowthRecords: () => mockGrowth }));
beforeEach(() => { jest.clearAllMocks(); mockAuth = { accountId: "account-a" }; });

test("stages an account-bound request before opening the AI tab", () => {
  render(<GrowthRoute />);
  fireEvent.press(screen.getByRole("button", { name: "AI回顾我的成长" }));
  expect(mockStage).toHaveBeenCalledWith("account-a", "week");
  expect(mockPush).toHaveBeenCalledWith("/(tabs)/ai");
});

test("requires sign in if the account disappears before handoff", () => {
  mockAuth = {};
  render(<GrowthRoute />);
  fireEvent.press(screen.getByRole("button", { name: "AI回顾我的成长" }));
  expect(mockStage).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/auth/email", params: { returnTo: "/growth" } });
});

test("stages the selected review range before opening AI", () => {
  render(<GrowthRoute />);
  fireEvent.press(screen.getByRole("button", { name: "回顾区间，1周" }));
  fireEvent.press(screen.getByRole("radio", { name: "半年" }));
  fireEvent.press(screen.getByRole("button", { name: "AI回顾我的成长" }));
  expect(mockStage).toHaveBeenCalledWith("account-a", "halfYear");
  expect(mockPush).toHaveBeenCalledWith("/(tabs)/ai");
});
