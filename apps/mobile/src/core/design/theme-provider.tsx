import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Text, useColorScheme } from "react-native";

import type { AppearancePreferencesRepository } from "./appearance-preferences";
import {
  darkTheme,
  lightTheme,
  type AppTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  saving: boolean;
  setPreference(preference: ThemePreference): Promise<void>;
  reloadPreference(): Promise<void>;
};

type ThemeProviderProps = PropsWithChildren<{
  repository: AppearancePreferencesRepository;
}>;

const ThemeContext = createContext<AppTheme>(darkTheme);
const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function resolveTheme(
  preference: ThemePreference,
  systemScheme: ResolvedTheme | null | undefined,
): ResolvedTheme {
  if (preference !== "system") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children, repository }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const loadPreference = useCallback(async () => {
    try {
      setPreferenceState(await repository.load());
    } catch {
      setPreferenceState("system");
    }
  }, [repository]);

  useEffect(() => {
    let active = true;
    void loadPreference().finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [loadPreference]);

  const resolvedTheme = resolveTheme(preference, systemScheme);
  const theme = resolvedTheme === "dark" ? darkTheme : lightTheme;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.color.background).catch(() => undefined);
  }, [theme]);

  const setPreference = useCallback((nextPreference: ThemePreference): Promise<void> => {
    if (savePromiseRef.current !== null) return savePromiseRef.current;
    const previousPreference = preference;
    setPreferenceState(nextPreference);
    setSaving(true);
    const savePromise = repository.save(nextPreference).catch((error: unknown) => {
      setPreferenceState(previousPreference);
      throw error;
    }).finally(() => {
      savePromiseRef.current = null;
      setSaving(false);
    });
    savePromiseRef.current = savePromise;
    return savePromise;
  }, [preference, repository]);

  const reloadPreference = useCallback(async () => {
    await loadPreference();
  }, [loadPreference]);

  const preferenceValue = useMemo<ThemePreferenceContextValue>(() => ({
    preference,
    resolvedTheme,
    saving,
    setPreference,
    reloadPreference,
  }), [preference, reloadPreference, resolvedTheme, saving, setPreference]);

  if (!ready) {
    return (
      <>
        <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
        <Text accessibilityLiveRegion="polite" style={{ color: theme.color.text }}>
          正在读取外观设置…
        </Text>
      </>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <ThemePreferenceContext.Provider value={preferenceValue}>
        <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
        {children}
      </ThemePreferenceContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}

export function useThemePreference(): ThemePreferenceContextValue {
  const context = useContext(ThemePreferenceContext);
  if (context === null) throw new Error("ThemeProvider is required");
  return context;
}
