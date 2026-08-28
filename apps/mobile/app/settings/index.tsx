import { useCallback, useEffect, useState } from "react";
import { Redirect, useRouter } from "expo-router";

import { useThemePreference } from "../../src/core/design/theme-provider";
import { DEFAULT_PRIVACY_SETTINGS, type PrivacySettings } from "../../src/core/storage/types";
import {
  type JourneyRuntimeContextValue,
  useOptionalJourneyRuntime
} from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { SettingsScreen } from "../../src/features/shell/ui/SettingsScreen";

export default function SettingsRoute() {
  const runtime = useOptionalJourneyRuntime();
  if (runtime === null) return <Redirect href="/journey/welcome" />;

  return <AuthorizedSettingsRoute runtime={runtime} />;
}

function AuthorizedSettingsRoute({ runtime }: { runtime: JourneyRuntimeContextValue }) {
  const router = useRouter();
  const {
    preference,
    resolvedTheme,
    saving,
    setPreference,
  } = useThemePreference();
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
      onAppearancePreferenceChange={setPreference}
      onBack={() => router.back()}
      onChangeJournalSaveNotice={changeJournalSaveNotice}
      onContinueAfterDelete={() => router.replace("/journey/welcome")}
      onDeleteAllData={async () => { await runtime.deleteAllData(); }}
      onRetryPrivacySettings={() => { void loadPrivacySettings(); }}
      privacySettingsStatus={privacySettingsStatus}
      resolvedTheme={resolvedTheme}
      showLocalJournalSaveNotice={privacySettings.showLocalJournalSaveNotice}
    />
  );
}
