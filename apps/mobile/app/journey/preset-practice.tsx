import * as ExpoClipboard from "expo-clipboard";

import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { openJourneySources } from "../../src/features/journey/ui/open-journey-sources";
import { PresetPracticePage } from "../../src/features/journey/ui/pages/PresetPracticePage";

export default function PresetPracticeRoute() {
  const catalog = loadJourneyContentCatalog();
  return (
    <JourneyRouteScreen pageId="preset-practice">
      {({ controller, goTo, runAndRefresh }) => {
        return <PresetPracticePage
          catalog={catalog.practice}
          onComplete={(input) => runAndRefresh(() => controller.completePractice({
            behaviorId: input.behaviorId,
            intent: input.intent,
            phrase: input.phrase,
            aftercareId: input.aftercareId,
            completed: true,
            ...(input.pointEventKey === undefined ? {} : { pointEventKey: input.pointEventKey }),
            ...(input.optionalBranch === undefined ? {} : { optionalBranch: input.optionalBranch }),
            ...(input.optionalResponse === undefined ? {} : { optionalResponse: input.optionalResponse }),
          }))
            .then(() => goTo("final-preparation"))}
          onCopySupportNumber={async (number) => { await ExpoClipboard.setStringAsync(number); }}
          onOpenSources={openJourneySources}
        />;
      }}
    </JourneyRouteScreen>
  );
}
