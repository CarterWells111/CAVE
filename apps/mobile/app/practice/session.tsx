import * as ExpoClipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "../../src/core/ui/Screen";
import { SecondaryButton } from "../../src/core/ui/secondary-button";
import { backOrHome } from "../../src/features/shell/ui/safe-navigation";
import {
  parseStandalonePracticeScenario,
  parseStandalonePracticePhrase,
  standaloneScenarioIntent,
} from "../../src/features/journey/application/standalone-practice-route";
import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { openJourneySources } from "../../src/features/journey/ui/open-journey-sources";
import { PresetPracticePage } from "../../src/features/journey/ui/pages/PresetPracticePage";

export default function StandalonePracticeRoute() {
  const router = useRouter();
  const { phrase: routePhrase, scenario: routeScenario } = useLocalSearchParams<{
    phrase?: string | string[];
    scenario?: string | string[];
  }>();
  const catalog = loadJourneyContentCatalog();
  const scenario = parseStandalonePracticeScenario(routeScenario);
  const initialIntent = standaloneScenarioIntent(scenario);
  const initialPhrase = parseStandalonePracticePhrase(routePhrase);

  return (
    <Screen>
      <SecondaryButton label="返回练习入口" onPress={() => backOrHome(router)} />
      <PresetPracticePage
        catalog={catalog.practice}
        context="standalone"
        {...(initialIntent ? { initialIntent } : {})}
        {...(initialPhrase ? { initialPhrase } : {})}
        onComplete={async () => undefined}
        onCopySupportNumber={async (number) => { await ExpoClipboard.setStringAsync(number); }}
        onOpenSources={openJourneySources}
        onPracticeAgain={async () => { router.replace("/practice/session"); }}
      />
    </Screen>
  );
}
