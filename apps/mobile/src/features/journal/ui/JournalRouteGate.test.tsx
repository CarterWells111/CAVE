import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Text } from "react-native";

import { InMemoryAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalRouteGate } from "./JournalRouteGate";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockRetry = jest.fn();
const mockAlert = jest.fn();
let mockAccess: {
  status: "locked" | "loading" | "ready" | "error";
  temporaryPreview: boolean;
  retry: typeof mockRetry;
} = { status: "locked", temporaryPreview: false, retry: mockRetry };

jest.mock("expo-router", () => ({
  usePathname: () => "/journal/new",
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock("../runtime/JournalAccessProvider", () => ({
  useJournalAccess: () => mockAccess,
}));

function renderGate() {
  return render(
    <ThemeProvider repository={new InMemoryAppearancePreferencesRepository()}>
      <JournalRouteGate><Text>私密手记内容</Text></JournalRouteGate>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(mockAlert);
  mockAccess = { status: "locked", temporaryPreview: false, retry: mockRetry };
});

test("shows one accurate local-only login prompt and routes back to the intended journal page", async () => {
  renderGate();

  expect(screen.queryByText("私密手记内容")).toBeNull();
  await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));
  const [title, message, actions] = mockAlert.mock.calls[0]!;
  expect(title).toBe("登录后使用内界手记");
  expect(message).toContain("仍只保存在本机，不会上传");
  expect(message).toContain("卸载 App 或清除本机数据仍会丢失");

  act(() => actions.find(({ text }: { text: string }) => text === "去登录").onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/auth/email", params: { returnTo: "/journal/new" } });
});

test("returns to the previous page when the login prompt is cancelled", async () => {
  renderGate();
  await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));
  const actions = mockAlert.mock.calls[0]![2];

  act(() => actions.find(({ text }: { text: string }) => text === "取消").onPress());
  expect(mockBack).toHaveBeenCalledTimes(1);
});

test("keeps visible login and back actions when returning from login still signed out", async () => {
  renderGate();
  await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));

  fireEvent.press(screen.getByRole("button", { name: "去登录" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/auth/email", params: { returnTo: "/journal/new" } });
  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  expect(mockBack).toHaveBeenCalledTimes(1);
});

test("renders children only after account ownership is ready", async () => {
  mockAccess = { status: "ready", temporaryPreview: false, retry: mockRetry };
  renderGate();

  expect(await screen.findByText("私密手记内容")).toBeTruthy();
  expect(mockAlert).not.toHaveBeenCalled();
});

test("keeps the Expo Go persistence limitation visible after login", async () => {
  mockAccess = { status: "ready", temporaryPreview: true, retry: mockRetry };
  renderGate();

  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith(
      "Expo Go 临时预览",
      "关闭 App 后，本次手记记录不会保留。请使用正式安装包保存手记。",
    ));
  expect(screen.getByText("私密手记内容")).toBeTruthy();
});

test("offers retry when local ownership initialization fails", async () => {
  mockAccess = { status: "error", temporaryPreview: false, retry: mockRetry };
  renderGate();

  fireEvent.press(await screen.findByRole("button", { name: "重试读取手记" }));
  expect(mockRetry).toHaveBeenCalledTimes(1);
});
