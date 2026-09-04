import { fireEvent, render, screen } from "@testing-library/react-native";

import { InMemoryAppearancePreferencesRepository } from "../../../core/design/appearance-preferences";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { darkTheme, lightTheme } from "../../../core/design/theme";
import { LoginSaveHint, PreferenceSyncNotice } from "./PreferenceSyncNotice";

const mockRetry = jest.fn();
jest.mock("../runtime/AccountPreferencesProvider", () => ({
  useOptionalAccountPreferences: () => ({ error: false, syncStatus: "error", retry: mockRetry }),
}));

test.each(["light", "dark"] as const)("login hint has muted underlined text and a full touch target in %s mode", async (mode) => {
  const repository = new InMemoryAppearancePreferencesRepository();
  await repository.save(mode);
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const onPress = jest.fn();
  render(<ThemeProvider repository={repository}><LoginSaveHint onPress={onPress} /></ThemeProvider>);
  const link = await screen.findByRole("link", { name: "登录后保存现有选择" });
  expect(link).toHaveStyle({ minHeight: theme.size.minimumTouchTarget });
  expect(screen.getByText("登录后保存现有选择")).toHaveStyle({ color: theme.color.textMuted, textDecorationLine: "underline", textAlign: "center" });
  fireEvent.press(link);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("failed synchronization clearly says local-only and provides retry", () => {
  render(<PreferenceSyncNotice />);
  expect(screen.getByText("已保存到本机，尚未同步")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试同步设置" }));
  expect(mockRetry).toHaveBeenCalledTimes(1);
});
