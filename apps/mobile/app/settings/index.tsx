import { useRouter } from "expo-router";

import { useThemePreference } from "../../src/core/design/theme-provider";
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
  const {
    preference,
    resolvedTheme,
    saving,
    setPreference,
  } = useThemePreference();
  return (
    <SettingsScreen
      account={{
        status: accountProfile.status,
        ...(accountProfile.email === undefined ? {} : { email: accountProfile.email }),
        ...(accountProfile.profile === undefined ? {} : { profile: accountProfile.profile }),
        ...(accountProfile.status === "signedOut" ? {
          onSignIn: () => router.push(
            adult.status === "authorized" ? "/auth/email" : "/journey/adult-gate",
          ),
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
      deletion={runtime ? {
        deleteAllData: async () => {
          await auth?.clearLocalSession();
          await runtime.deleteAllData();
          router.replace("/(tabs)");
        },
        onContinue: () => router.replace("/(tabs)"),
      } : undefined}
      onAppearancePreferenceChange={setPreference}
      onBack={() => router.back()}
      resolvedTheme={resolvedTheme}
    />
  );
}
