import { useRouter } from "expo-router";

import { useThemePreference } from "../../src/core/design/theme-provider";
import { useOptionalJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { SettingsScreen } from "../../src/features/shell/ui/SettingsScreen";

export default function SettingsRoute() {
  const runtime = useOptionalJourneyRuntime();
  const router = useRouter();
  const {
    preference,
    resolvedTheme,
    saving,
    setPreference,
  } = useThemePreference();
  return (
    <SettingsScreen
      appearancePreference={preference}
      appearanceSaving={saving}
      deletion={runtime ? {
        deleteAllData: async () => {
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
