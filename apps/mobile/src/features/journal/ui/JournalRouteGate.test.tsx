import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Text } from "react-native";

import { InMemoryAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { JournalRouteGate } from "./JournalRouteGate";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockRetry = jest.fn();
const mockAlert = jest.fn();
let mockParams: { cardId?: string; reviewId?: string } = {};
let mockAccess: {
  status: "locked" | "loading" | "ready" | "error";
  journalPersistence: "memory-only" | "plaintext-sqlite" | "sqlcipher";
  retry: typeof mockRetry;
} = { status: "locked", journalPersistence: "sqlcipher", retry: mockRetry };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
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
  mockParams = {};
  mockAccess = { status: "locked", journalPersistence: "sqlcipher", retry: mockRetry };
});

test("shows one accurate local-only login prompt and routes back to the intended journal page", async () => {
  renderGate();

  expect(screen.queryByText("私密手记内容")).toBeNull();
  await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));
  const [title, message, actions] = mockAlert.mock.calls[0]!;
  expect(title).toBe("登录后使用内界手记");
  expect(message).toContain("仍只保存在本机，不会上传");
  expect(message).toContain("本机加密保存");
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

test("preserves only supported source identifiers across login", async () => {
  mockParams = { cardId: "card / 私密", reviewId: "review-1" };
  renderGate();
  await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));

  fireEvent.press(screen.getByRole("button", { name: "去登录" }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/auth/email",
    params: {
      returnTo: "/journal/new?cardId=card%20%2F%20%E7%A7%81%E5%AF%86&reviewId=review-1",
    },
  });
});

test("renders children only after account ownership is ready", async () => {
  mockAccess = { status: "ready", journalPersistence: "sqlcipher", retry: mockRetry };
  renderGate();

  expect(await screen.findByText("私密手记内容")).toBeTruthy();
  expect(mockAlert).not.toHaveBeenCalled();
});

test("warns once that Expo Go journals persist across restarts without SQLCipher", async () => {
  mockAccess = { status: "ready", journalPersistence: "plaintext-sqlite", retry: mockRetry };
  renderGate();

  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith(
      "Expo Go 明文存储提示",
      expect.stringContaining("会在此安装中跨重启保留"),
    ));
  expect(mockAlert.mock.calls[0]![1]).toContain("未使用 SQLCipher 加密");
  expect(mockAlert.mock.calls[0]![1]).toContain("仅适合开发预览");
  expect(mockAlert.mock.calls[0]![1]).toContain("请勿录入真实敏感内容");
  expect(mockAlert.mock.calls[0]![1]).toContain("卸载 Expo Go、清除项目数据或主动删除后不可恢复");
  expect(screen.getByText("私密手记内容")).toBeTruthy();
});

test("explains the Expo Go plaintext boundary before login", async () => {
  mockAccess = { status: "locked", journalPersistence: "plaintext-sqlite", retry: mockRetry };
  renderGate();

  await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));
  const message = mockAlert.mock.calls[0]![1];
  expect(message).toContain("会在此安装中跨重启保留");
  expect(message).toContain("未使用 SQLCipher 加密");
  expect(message).toContain("卸载 Expo Go、清除项目数据或主动删除后不可恢复");
  expect(message).not.toContain("关闭后不会保留记录");
});

test("offers retry when local ownership initialization fails", async () => {
  mockAccess = { status: "error", journalPersistence: "sqlcipher", retry: mockRetry };
  renderGate();

  fireEvent.press(await screen.findByRole("button", { name: "重试读取手记" }));
  expect(mockRetry).toHaveBeenCalledTimes(1);
});
