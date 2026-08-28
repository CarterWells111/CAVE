import { useRouter } from "expo-router";

import { useThemePreference } from "../../src/core/design/theme-provider";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { SettingsScreen } from "../../src/features/shell/ui/SettingsScreen";

export default function SettingsRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const {
    preference,
    reloadPreference,
    resolvedTheme,
    saving,
    setPreference,
  } = useThemePreference();
  return (
    <SettingsScreen
      appearancePreference={preference}
      appearanceSaving={saving}
      onAppearancePreferenceChange={setPreference}
      onBack={() => router.back()}
      onContinueAfterDelete={() => router.replace("/journey/welcome")}
      onDeleteAllData={async () => {
        await runtime.deleteAllData();
        await reloadPreference();
      }}
      resolvedTheme={resolvedTheme}
    />
  );
}
