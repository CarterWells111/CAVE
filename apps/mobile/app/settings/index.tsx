import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";

import { useThemePreference } from "../../src/core/design/theme-provider";
import { DEFAULT_PRIVACY_SETTINGS, type PrivacySettings } from "../../src/core/storage/types";
import {
  type JourneyRuntimeContextValue,
  useOptionalJourneyRuntime,
} from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { SettingsScreen } from "../../src/features/shell/ui/SettingsScreen";

export default function SettingsRoute() {
  const runtime = useOptionalJourneyRuntime();
  return runtime ? <AuthorizedSettingsRoute runtime={runtime} /> : <PublicSettingsRoute />;
}

function PublicSettingsRoute() {
  const router = useRouter();
  const { preference, resolvedTheme, saving, setPreference } = useThemePreference();
  return (
    <SettingsScreen
      appearancePreference={preference}
      appearanceSaving={saving}
      onAppearancePreferenceChange={setPreference}
      onBack={() => router.back()}
      resolvedTheme={resolvedTheme}
    />
  );
}

function AuthorizedSettingsRoute({ runtime }: { runtime: JourneyRuntimeContextValue }) {
  const router = useRouter();
  const { preference, resolvedTheme, saving, setPreference } = useThemePreference();
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({ ...DEFAULT_PRIVACY_SETTINGS });
  const [privacySettingsStatus, setPrivacySettingsStatus] = useState<"loading" | "ready" | "error">("loading");
  const loadPrivacySettings = useCallback(async () => {
    setPrivacySettingsStatus("loading");
    try {
      setPrivacySettings(await runtime.privacySettings.getPrivacySettings());
      setPrivacySettingsStatus("ready");
    } catch {
      setPrivacySettings({ ...DEFAULT_PRIVACY_SETTINGS });
      setPrivacySettingsStatus("error");
    }
  }, [runtime.privacySettings]);

  useEffect(() => { void loadPrivacySettings(); }, [loadPrivacySettings]);

  const changeJournalSaveNotice = async (enabled: boolean) => {
    const current = await runtime.privacySettings.getPrivacySettings();
    const next = { ...current, showLocalJournalSaveNotice: enabled };
    await runtime.privacySettings.setPrivacySettings(next);
    setPrivacySettings(next);
    setPrivacySettingsStatus("ready");
  };

  return (
    <SettingsScreen
      appearancePreference={preference}
      appearanceSaving={saving}
      deletion={{
        deleteAllData: async () => {
          await runtime.deleteAllData();
          router.replace("/(tabs)");
        },
        onContinue: () => router.replace("/(tabs)"),
      }}
      onAppearancePreferenceChange={setPreference}
      onBack={() => router.back()}
      privacy={{
        changeJournalSaveNotice,
        retry: () => { void loadPrivacySettings(); },
        showLocalJournalSaveNotice: privacySettings.showLocalJournalSaveNotice,
        status: privacySettingsStatus,
      }}
      resolvedTheme={resolvedTheme}
    />
  );
}
