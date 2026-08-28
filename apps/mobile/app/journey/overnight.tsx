import { Linking } from "react-native";

import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { OvernightPage } from "../../src/features/journey/ui/pages/OvernightPage";

export default function OvernightRoute() {
  const catalog = loadJourneyContentCatalog();
  const consentSource = catalog.sources.find(({ id }) => id === "SRC-003");
  return (
    <JourneyRouteScreen pageId="overnight">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <OvernightPage
          options={catalog.options}
          initialConcernIds={snapshot?.concernIds ?? []}
          initialCustomNote={snapshot?.overnightCustomNote ?? ""}
          initialExpectationIds={snapshot?.expectationIds ?? []}
          initialStage={snapshot?.overnight.resumeStage ?? "expectations"}
          {...(consentSource ? { consentSource } : {})}
          onContinue={(input) => runAndRefresh(() => controller.saveOvernight(input))
            .then(() => goTo("behavior-map"))}
          onProgress={(input) => runAndRefresh(() => controller.saveOvernightProgress(input))}
          onSourceAction={(source) => Linking.openURL(source.url)}
        />
      )}
    </JourneyRouteScreen>
  );
}
