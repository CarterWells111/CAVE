import * as ExpoClipboard from "expo-clipboard";
import { useRouter } from "expo-router";

import { Screen } from "../../src/core/ui/Screen";
import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { PresetPracticePage } from "../../src/features/journey/ui/pages/PresetPracticePage";

export default function StandalonePracticeRoute() {
  const router = useRouter();
  const catalog = loadJourneyContentCatalog();
  return (
    <Screen>
      <PresetPracticePage
        catalog={catalog.practice}
        context="standalone"
        onComplete={async () => undefined}
        onCopySupportNumber={async (number) => { await ExpoClipboard.setStringAsync(number); }}
        onPracticeAgain={async () => { router.replace("/practice/session"); }}
      />
    </Screen>
  );
}
