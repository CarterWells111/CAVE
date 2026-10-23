import { fireEvent, render, screen } from "@testing-library/react-native";
import ProfileRoute from "../../../app/(tabs)/profile";

const mockPush = jest.fn();
const mockReload = jest.fn();
let mockGrowth = { data: { events: [], undatedAiTurns: 0, notes: [] }, loading: false, error: false, locked: false, reload: mockReload };
let mockAccount = { status: "signedOut" as "signedOut" | "ready", email: undefined as string | undefined, profile: undefined as { displayName: string } | undefined };
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../account/runtime/AccountProfileProvider", () => ({ useAccountProfile: () => mockAccount }));
jest.mock("../growth/use-growth-records", () => ({ useGrowthRecords: () => mockGrowth }));
beforeEach(() => {
  jest.clearAllMocks();
  mockGrowth = { data: { events: [], undatedAiTurns: 0, notes: [] }, loading: false, error: false, locked: false, reload: mockReload };
  mockAccount = { status: "signedOut", email: undefined, profile: undefined };
});

test("opens the new growth summary and existing settings", () => {
  render(<ProfileRoute />);
  fireEvent.press(screen.getByRole("button", { name: "打开关键事件与阶段回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "设置" }));
  expect(mockPush.mock.calls).toEqual([["/growth"], ["/settings"]]);
});

test("retains account sign in and display name", () => {
  const view = render(<ProfileRoute />);
  fireEvent.press(screen.getByRole("button", { name: "邮箱登录" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/auth/email", params: { returnTo: "/(tabs)/profile" } });
  mockAccount = { status: "ready", email: "person@example.com", profile: { displayName: "阿岚" } };
  view.rerender(<ProfileRoute />);
  expect(screen.getByText("阿岚")).toBeTruthy();
});

test("retries the growth source after a read failure", () => {
  mockGrowth.error = true;
  render(<ProfileRoute />);
  fireEvent.press(screen.getByRole("button", { name: "重试读取成长记录" }));
  expect(mockReload).toHaveBeenCalledTimes(1);
});
