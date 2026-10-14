import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";

import {
  DEFAULT_PRIVACY_SETTINGS,
  type PrivacySettings,
} from "../../src/core/storage/types";
import { useOptionalAuth } from "../../src/features/auth/runtime/AuthProvider";
import {
  useAdultDeclaration,
  useOptionalJourneyRuntime,
} from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { AccountPrivacyScreen } from "../../src/features/shell/ui/AccountPrivacyScreen";

export default function AccountPrivacyRoute() {
  const runtime = useOptionalJourneyRuntime();
  const auth = useOptionalAuth();
  const adult = useAdultDeclaration();
  const router = useRouter();
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    ...DEFAULT_PRIVACY_SETTINGS,
  });
  const [privacySettingsStatus, setPrivacySettingsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
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
    <AccountPrivacyScreen
      signedIn={auth?.status === "signedIn" || auth?.status === "offline"}
      onSignIn={() =>
        router.push({
          pathname: "/auth/email",
          params: { returnTo: "/(tabs)/profile" },
        })
      }
      onLogout={
        auth === null
          ? undefined
          : async () => {
              await auth.logout();
              router.replace("/settings");
            }
      }
      onDeleteAccount={() => router.push("/auth/delete-account")}
      deletion={
        runtime === null && adult.deleteAllData === undefined
          ? undefined
          : {
              deleteAllData: async () => {
                await auth?.clearLocalSession();
                if (runtime !== null) await runtime.deleteAllData();
                else await adult.deleteAllData?.();
                router.replace("/(tabs)");
              },
              onContinue: () => router.replace("/(tabs)"),
            }
      }
      onBack={() => router.back()}
      privacy={
        runtime === null
          ? undefined
          : {
              changeJournalSaveNotice,
              retry: () => {
                void loadPrivacySettings();
              },
              showLocalJournalSaveNotice:
                privacySettings.showLocalJournalSaveNotice,
              status: privacySettingsStatus,
            }
      }
    />
  );
}
