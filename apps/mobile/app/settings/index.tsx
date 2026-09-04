import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";

import { useThemePreference } from "../../src/core/design/theme-provider";
import { DEFAULT_PRIVACY_SETTINGS, type PrivacySettings } from "../../src/core/storage/types";
import { useAccountProfile } from "../../src/features/account/runtime/AccountProfileProvider";
import { useOptionalAuth } from "../../src/features/auth/runtime/AuthProvider";
import { useAdultDeclaration, useOptionalJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { SettingsScreen } from "../../src/features/shell/ui/SettingsScreen";

export default function SettingsRoute() {
  const runtime = useOptionalJourneyRuntime();
  const auth = useOptionalAuth();
  const accountProfile = useAccountProfile();
  const adult = useAdultDeclaration();
  const router = useRouter();
  const { preference, resolvedTheme, saving, setPreference } = useThemePreference();
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({ ...DEFAULT_PRIVACY_SETTINGS });
  const [privacySettingsStatus, setPrivacySettingsStatus] = useState<"loading" | "ready" | "error">("loading");
  const loadPrivacySettings = useCallback(async () => {
    if (runtime === null) return;
    setPrivacySettingsStatus("loading");
    try {
      setPrivacySettings(await runtime.privacySettings.getPrivacySettings());
      setPrivacySettingsStatus("ready");
    } catch {
      setPrivacySettings({ ...DEFAULT_PRIVACY_SETTINGS });
      setPrivacySettingsStatus("error");
    }
  }, [runtime]);

  useEffect(() => {
    if (runtime !== null) void loadPrivacySettings();
  }, [loadPrivacySettings, runtime]);

  const changeJournalSaveNotice = async (enabled: boolean) => {
    if (runtime === null) throw new Error("journey-runtime-unavailable");
    const current = await runtime.privacySettings.getPrivacySettings();
    const next = { ...current, showLocalJournalSaveNotice: enabled };
    await runtime.privacySettings.setPrivacySettings(next);
    setPrivacySettings(next);
    setPrivacySettingsStatus("ready");
  };

  return (
    <SettingsScreen
      account={{
        status: accountProfile.status,
        ...(accountProfile.email === undefined ? {} : { email: accountProfile.email }),
        ...(accountProfile.profile === undefined ? {} : { profile: accountProfile.profile }),
        ...(accountProfile.status === "signedOut" ? {
          onSignIn: () => router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/profile" } }),
        } : {}),
        ...(accountProfile.status === "ready" ? {
          onManageAccount: () => router.push("/auth/email"),
          chooseAvatar: accountProfile.chooseAvatar,
          removeAvatar: accountProfile.removeAvatar,
          saveDisplayName: accountProfile.saveDisplayName,
        } : {}),
        ...(accountProfile.status === "error" ? { onRetry: accountProfile.retry } : {}),
        error: accountProfile.error,
      }}
      appearancePreference={preference}
      appearanceSaving={saving}
      deletion={runtime === null && adult.deleteAllData === undefined ? undefined : {
        deleteAllData: async () => {
          await auth?.clearLocalSession();
          if (runtime !== null) await runtime.deleteAllData();
          else await adult.deleteAllData?.();
          router.replace("/(tabs)");
        },
        onContinue: () => router.replace("/(tabs)"),
      }}
      onAppearancePreferenceChange={setPreference}
      onBack={() => router.back()}
      onAdultRevoked={() => router.replace("/journey/adult-gate")}
      privacy={runtime === null ? undefined : {
        changeJournalSaveNotice,
        retry: () => { void loadPrivacySettings(); },
        showLocalJournalSaveNotice: privacySettings.showLocalJournalSaveNotice,
        status: privacySettingsStatus,
      }}
      resolvedTheme={resolvedTheme}
    />
  );
}
