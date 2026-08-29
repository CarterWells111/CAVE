import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { openJourneySources } from "../../src/features/journey/ui/open-journey-sources";
import { OvernightPage } from "../../src/features/journey/ui/pages/OvernightPage";

export default function OvernightRoute() {
  const catalog = loadJourneyContentCatalog();
  return (
    <JourneyRouteScreen pageId="overnight">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <OvernightPage
          options={catalog.options}
          initialConcernIds={snapshot?.concernIds ?? []}
          initialCustomNote={snapshot?.overnightCustomNote ?? ""}
          initialExpectationIds={snapshot?.expectationIds ?? []}
          initialStage={snapshot?.overnight.resumeStage ?? "expectations"}
          onContinue={(input) => runAndRefresh(() => controller.saveOvernight(input))
            .then(() => goTo("behavior-map"))}
          onProgress={(input) => runAndRefresh(() => controller.saveOvernightProgress(input))}
          onOpenSources={openJourneySources}
        />
      )}
    </JourneyRouteScreen>
  );
}
