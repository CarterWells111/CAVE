import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import EmailAuthRoute from "../../../app/auth/email";
import { InMemoryAppearancePreferencesRepository } from "../../core/design/appearance-preferences";
import { ThemeProvider } from "../../core/design/theme-provider";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRequest = jest.fn(async () => ({ challengeId: "challenge-1", expiresInSeconds: 600, resendAfterSeconds: 60 }));
const mockVerify = jest.fn(async () => undefined);
let mockReturnTo: string | undefined = "/journal/new";
let mockAuthStatus: "signedOut" | "signedIn" = "signedOut";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ returnTo: mockReturnTo }),
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock("./runtime/AuthProvider", () => ({
  useAuth: () => ({
    status: mockAuthStatus,
    requestEmailChallenge: mockRequest,
    verifyEmailChallenge: mockVerify,
    logout: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));

jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useAdultDeclaration: () => ({ status: "authorized" }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockReturnTo = "/journal/new";
  mockAuthStatus = "signedOut";
});

async function completeLogin() {
  fireEvent.changeText(await screen.findByLabelText("邮箱地址"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));
  await screen.findByText(/验证码已发送/u);
  fireEvent.changeText(screen.getByLabelText("6 位验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "登录" }));
  await waitFor(() => expect(mockVerify).toHaveBeenCalledWith(
    "challenge-1",
    "123456",
    "person@example.com",
  ));
}

test("returns to the intended protected journal route after login", async () => {
  render(<ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}><EmailAuthRoute /></ThemeProvider>);

  await completeLogin();

  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/journal/new" });
});

test("falls back to My page instead of honoring an unsupported return path", async () => {
  mockReturnTo = "/settings";
  render(<ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}><EmailAuthRoute /></ThemeProvider>);

  await completeLogin();

  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/profile");
});

test("returns to My page after an ordinary login without a return path", async () => {
  mockReturnTo = undefined;
  render(<ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}><EmailAuthRoute /></ThemeProvider>);
  await completeLogin();
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/profile");
});

test("honors an explicit My return path even when login remounts the route", async () => {
  mockReturnTo = "/(tabs)/profile";
  mockAuthStatus = "signedIn";
  render(<ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}><EmailAuthRoute /></ThemeProvider>);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)/profile"));
  expect(mockVerify).not.toHaveBeenCalled();
});

test("an already signed-in user can still open account management without being redirected", async () => {
  mockReturnTo = undefined;
  mockAuthStatus = "signedIn";
  render(<ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}><EmailAuthRoute /></ThemeProvider>);
  await screen.findByRole("button", { name: "从这台设备退出登录" });
  expect(mockReplace).not.toHaveBeenCalled();
});
