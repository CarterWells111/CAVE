import { Redirect, useRouter } from "expo-router";

import { useThemePreference } from "../../src/core/design/theme-provider";
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
  return (
    <SettingsScreen
      appearancePreference={preference}
      appearanceSaving={saving}
      onAppearancePreferenceChange={setPreference}
      onBack={() => router.back()}
      onContinueAfterDelete={() => router.replace("/journey/welcome")}
      onDeleteAllData={async () => {
        await runtime.deleteAllData();
      }}
      resolvedTheme={resolvedTheme}
    />
  );
}
