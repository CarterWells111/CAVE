import { useRouter } from "expo-router";

import { useThemePreference } from "../../src/core/design/theme-provider";
import { useAccountProfile } from "../../src/features/account/runtime/AccountProfileProvider";
import { SettingsScreen } from "../../src/features/shell/ui/SettingsScreen";

export default function SettingsRoute() {
  const accountProfile = useAccountProfile();
  const router = useRouter();
  const { preference, resolvedTheme, saving, setPreference } =
    useThemePreference();
  return (
    <SettingsScreen
      account={{
        status: accountProfile.status,
        ...(accountProfile.email === undefined
          ? {}
          : { email: accountProfile.email }),
        ...(accountProfile.profile === undefined
          ? {}
          : { profile: accountProfile.profile }),
        ...(accountProfile.status === "signedOut"
          ? {
              onSignIn: () =>
                router.push({
                  pathname: "/auth/email",
                  params: { returnTo: "/(tabs)/profile" },
                }),
            }
          : {}),
        ...(accountProfile.status === "ready"
          ? {
              chooseAvatar: accountProfile.chooseAvatar,
              removeAvatar: accountProfile.removeAvatar,
              saveDisplayName: accountProfile.saveDisplayName,
            }
          : {}),
        ...(accountProfile.status === "error"
          ? { onRetry: accountProfile.retry }
          : {}),
        error: accountProfile.error,
      }}
      appearancePreference={preference}
      appearanceSaving={saving}
      onOpenAccountPrivacy={() => router.push("/settings/account-privacy")}
      onAppearancePreferenceChange={setPreference}
      onBack={() => router.back()}
      onAdultRevoked={() => router.replace("/journey/adult-gate")}
      resolvedTheme={resolvedTheme}
    />
  );
}
