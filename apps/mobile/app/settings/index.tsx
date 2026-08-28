import { useRouter } from "expo-router";

import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { SettingsScreen } from "../../src/features/shell/ui/SettingsScreen";

export default function SettingsRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  return (
    <SettingsScreen
      onContinueAfterDelete={() => router.replace("/journey/welcome")}
      onDeleteAllData={() => runtime.deleteAllData()}
    />
  );
}
