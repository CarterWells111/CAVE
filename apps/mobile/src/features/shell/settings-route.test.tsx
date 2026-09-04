import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SettingsRoute from "../../../app/settings/index";
import WelcomeRoute from "../../../app/journey/welcome";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRedirect = jest.fn();
const mockSetPreference = jest.fn(async () => undefined);
const mockDeleteAllData = jest.fn(async () => undefined);
const mockGetPrivacySettings = jest.fn(async () => ({ showLocalJournalSaveNotice: true }));
const mockSetPrivacySettings = jest.fn(async () => undefined);
const mockThemePreference = {
  preference: "system" as const,
  resolvedTheme: "dark" as const,
  saving: false,
  setPreference: mockSetPreference,
};
let mockRuntime: {
  deleteAllData(): Promise<void>;
  privacySettings: {
    getPrivacySettings(): Promise<{ showLocalJournalSaveNotice: boolean }>;
    setPrivacySettings(settings: { showLocalJournalSaveNotice: boolean }): Promise<void>;
  };
  snapshot: null;
} | null = null;
let mockAdultStatus: "public" | "authorized" = "public";
const mockClearLocalSession = jest.fn(async () => undefined);
const mockSaveDisplayName = jest.fn(async () => undefined);
const mockChooseAvatar = jest.fn(async () => undefined);
const mockRemoveAvatar = jest.fn(async () => undefined);
const mockRetryProfile = jest.fn();
let mockAccountProfile = {
  status: "signedOut" as "signedOut" | "loading" | "ready" | "error",
  email: undefined as string | undefined,
  profile: undefined as { displayName: string; avatarUri?: string } | undefined,
  error: null as "load" | "save" | "permission" | "picker" | null,
  saveDisplayName: mockSaveDisplayName,
  chooseAvatar: mockChooseAvatar,
  removeAvatar: mockRemoveAvatar,
  retry: mockRetryProfile,
};

jest.mock("../auth/runtime/AuthProvider", () => ({
  useOptionalAuth: () => ({ status: "signedOut", clearLocalSession: mockClearLocalSession }),
}));

jest.mock("../account/runtime/AccountProfileProvider", () => ({
  useAccountProfile: () => mockAccountProfile,
}));

jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props);
    return null;
  },
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock("../../core/design/theme-provider", () => ({
  ...jest.requireActual("../../core/design/theme-provider"),
  useThemePreference: () => mockThemePreference,
}));

jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useOptionalJourneyRuntime: () => mockRuntime,
  useAdultDeclaration: () => ({ status: mockAdultStatus }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRuntime = null;
  mockAdultStatus = "public";
  mockAccountProfile = {
    status: "signedOut",
    email: undefined,
    profile: undefined,
    error: null,
    saveDisplayName: mockSaveDisplayName,
    chooseAvatar: mockChooseAvatar,
    removeAvatar: mockRemoveAvatar,
    retry: mockRetryProfile,
  };
});

test("public settings keeps appearance and back controls without exposing private deletion", () => {
  render(<SettingsRoute />);

  expect(screen.getByRole("header", { name: "设置" })).toBeTruthy();
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "删除全部本机数据" })).toBeNull();
  expect(screen.queryByRole("switch", { name: "保存私人记录前显示本机提示" })).toBeNull();
  expect(mockRedirect).not.toHaveBeenCalled();
  expect(mockDeleteAllData).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("radio", { name: "亮色" }));
  fireEvent.press(screen.getByRole("button", { name: "返回" }));

  expect(mockSetPreference).toHaveBeenCalledWith("light");
  expect(mockBack).toHaveBeenCalledTimes(1);
});

test("authorized settings navigates to the public tabs as soon as deletion succeeds", async () => {
  mockRuntime = {
    deleteAllData: mockDeleteAllData,
    privacySettings: {
      getPrivacySettings: mockGetPrivacySettings,
      setPrivacySettings: mockSetPrivacySettings,
    },
    snapshot: null,
  };
  mockAdultStatus = "authorized";
  render(<SettingsRoute />);

  expect(await screen.findByRole("switch", { name: "保存私人记录前显示本机提示" })).toHaveProp("value", true);

  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  await screen.findByText("本机数据已删除。");
  expect(mockDeleteAllData).toHaveBeenCalledTimes(1);
  expect(mockClearLocalSession).toHaveBeenCalledTimes(1);
  expect(mockClearLocalSession.mock.invocationCallOrder[0])
    .toBeLessThan(mockDeleteAllData.mock.invocationCallOrder[0]!);
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
});

test("authorized signed-out settings opens email login from the single account card action", () => {
  mockAdultStatus = "authorized";
  render(<SettingsRoute />);

  expect(screen.getAllByRole("button", { name: "邮箱登录" })).toHaveLength(1);
  fireEvent.press(screen.getByRole("button", { name: "邮箱登录" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/auth/email", params: { returnTo: "/(tabs)/profile" } });
});

test("ready settings receives the local profile and keeps email read-only", () => {
  mockAdultStatus = "authorized";
  mockAccountProfile = {
    ...mockAccountProfile,
    status: "ready",
    email: "person@example.com",
    profile: { displayName: "阿岚", avatarUri: "file:///avatar.jpg" },
  };
  render(<SettingsRoute />);

  expect(screen.getByText("阿岚")).toBeTruthy();
  expect(screen.getByText("person@example.com")).toBeTruthy();
  expect(screen.queryByLabelText("更改邮箱")).toBeNull();
  expect(screen.getByRole("button", { name: "更改头像" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "更改昵称" })).toBeTruthy();
});

test("the journey welcome route exposes settings before authorization", () => {
  render(<WelcomeRoute />);

  fireEvent.press(screen.getByRole("button", { name: "设置" }));

  expect(mockPush).toHaveBeenCalledWith("/settings");
  expect(mockDeleteAllData).not.toHaveBeenCalled();
});

test("the standalone journey welcome keeps its brand content below the device top inset", () => {
  render(
    <SafeAreaProvider initialMetrics={{
      frame: { height: 844, width: 390, x: 0, y: 0 },
      insets: { bottom: 34, left: 0, right: 0, top: 47 },
    }}>
      <WelcomeRoute />
    </SafeAreaProvider>,
  );

  const contentStyle = StyleSheet.flatten(
    screen.getByTestId("journey-welcome-scroll").props.contentContainerStyle,
  );
  expect(contentStyle.paddingTop).toBe(47);
});
