import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { OvernightPage } from "../../src/features/journey/ui/pages/JourneyPages";

export default function OvernightRoute() {
  const options = loadJourneyContentCatalog().options;
  return (
    <JourneyRouteScreen pageId="overnight">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <OvernightPage
          concernOptions={options.filter(({ group }) => group === "concern")}
          expectationOptions={options.filter(({ group }) => group === "expectation")}
          initialConcernIds={snapshot?.concernIds ?? []}
          initialCustomNote={snapshot?.overnightCustomNote ?? ""}
          initialExpectationIds={snapshot?.expectationIds ?? []}
          onContinue={(input) => {
            void runAndRefresh(() => controller.saveOvernight(input))
              .then(() => goTo("body-knowledge"));
          }}
        />
      )}
    </JourneyRouteScreen>
  );
}
