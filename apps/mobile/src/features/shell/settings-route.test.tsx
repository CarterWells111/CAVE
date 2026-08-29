import { fireEvent, render, screen } from "@testing-library/react-native";

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
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRuntime = null;
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
  render(<SettingsRoute />);

  expect(await screen.findByRole("switch", { name: "保存私人记录前显示本机提示" })).toHaveProp("value", true);

  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  await screen.findByText("本机数据已删除。");
  expect(mockDeleteAllData).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
});

test("the journey welcome route exposes settings before authorization", () => {
  render(<WelcomeRoute />);

  fireEvent.press(screen.getByRole("button", { name: "设置" }));

  expect(mockPush).toHaveBeenCalledWith("/settings");
  expect(mockDeleteAllData).not.toHaveBeenCalled();
});
