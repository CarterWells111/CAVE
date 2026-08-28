import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import { Pressable, Text } from "react-native";

import type { AppearancePreferencesRepository } from "./appearance-preferences";
import { ThemeProvider, resolveTheme, useTheme, useThemePreference } from "./theme-provider";

let mockColorScheme: "light" | "dark" | null = "light";

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: () => mockColorScheme,
}));
jest.mock("expo-system-ui", () => ({ setBackgroundColorAsync: jest.fn(async () => undefined) }));

beforeEach(() => {
  mockColorScheme = "light";
  jest.clearAllMocks();
});

function Probe() {
  const theme = useTheme();
  const { preference, resolvedTheme, saving, setPreference } = useThemePreference();
  return (
    <>
      <Text>{`preference:${preference}`}</Text>
      <Text>{`resolved:${resolvedTheme}`}</Text>
      <Text>{`theme:${theme.name}`}</Text>
      <Text>{`saving:${String(saving)}`}</Text>
      <Pressable accessibilityRole="button" onPress={() => { void setPreference("light").catch(() => undefined); }}>
        <Text>switch-light</Text>
      </Pressable>
    </>
  );
}

test("resolves explicit preferences and treats a missing system scheme as light", () => {
  expect(resolveTheme("dark", "light")).toBe("dark");
  expect(resolveTheme("light", "dark")).toBe("light");
  expect(resolveTheme("system", "dark")).toBe("dark");
  expect(resolveTheme("system", null)).toBe("light");
});

test("keeps isolated component tests on the established dark theme without a provider", () => {
  function IsolatedThemeProbe() {
    const theme = useTheme();
    return <Text>{`isolated:${theme.name}`}</Text>;
  }

  render(<IsolatedThemeProbe />);

  expect(screen.getByText("isolated:dark")).toBeTruthy();
});

test("loads a persisted preference before rendering themed children", async () => {
  const repository: AppearancePreferencesRepository = {
    load: jest.fn(async () => "dark"),
    save: jest.fn(async () => undefined),
  };

  render(<ThemeProvider repository={repository}><Probe /></ThemeProvider>);

  expect(screen.queryByText("theme:dark")).toBeNull();
  expect(await screen.findByText("preference:dark")).toBeTruthy();
  expect(screen.getByText("theme:dark")).toBeTruthy();
});

test("follows system changes and synchronizes native background and status bar", async () => {
  const repository: AppearancePreferencesRepository = {
    load: jest.fn(async () => "system"),
    save: jest.fn(async () => undefined),
  };
  const view = render(<ThemeProvider repository={repository}><Probe /></ThemeProvider>);
  await screen.findByText("theme:light");
  expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith("#FBF4F0");
  expect(screen.UNSAFE_getByType(StatusBar).props.style).toBe("dark");

  mockColorScheme = "dark";
  view.rerender(<ThemeProvider repository={repository}><Probe /></ThemeProvider>);

  expect(screen.getByText("theme:dark")).toBeTruthy();
  await waitFor(() => expect(SystemUI.setBackgroundColorAsync).toHaveBeenLastCalledWith("#171217"));
  expect(screen.UNSAFE_getByType(StatusBar).props.style).toBe("light");
});

test("updates immediately and rolls back when persistence fails", async () => {
  const pending = Promise.withResolvers<void>();
  const repository: AppearancePreferencesRepository = {
    load: jest.fn(async () => "dark"),
    save: jest.fn(() => pending.promise),
  };
  render(<ThemeProvider repository={repository}><Probe /></ThemeProvider>);
  await screen.findByText("preference:dark");

  fireEvent.press(screen.getByRole("button", { name: "switch-light" }));
  expect(screen.getByText("preference:light")).toBeTruthy();
  expect(screen.getByText("saving:true")).toBeTruthy();

  await act(async () => { pending.reject(new Error("private storage error")); });
  await waitFor(() => expect(screen.getByText("preference:dark")).toBeTruthy());
  expect(screen.getByText("saving:false")).toBeTruthy();
});

test("falls back to the system preference when the initial read fails", async () => {
  const repository: AppearancePreferencesRepository = {
    load: jest.fn(async () => { throw new Error("private storage error"); }),
    save: jest.fn(async () => undefined),
  };

  render(<ThemeProvider repository={repository}><Probe /></ThemeProvider>);

  expect(await screen.findByText("preference:system")).toBeTruthy();
  expect(screen.getByText("theme:light")).toBeTruthy();
});
