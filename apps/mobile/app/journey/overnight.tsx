import { Linking } from "react-native";

import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { OvernightPage } from "../../src/features/journey/ui/pages/OvernightPage";

export default function OvernightRoute() {
  const catalog = loadJourneyContentCatalog();
  const runtime = useJourneyRuntime();
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
          onContinue={(input) => runAndRefresh(async () => {
            await runtime.service.dispatch({ type: "set-overnight-stage", stage: "concerns" });
            await controller.saveOvernight(input);
          })
            .then(() => goTo("body-knowledge"))}
          onSourceAction={(source) => Linking.openURL(source.url)}
          onStageChange={(stage) => {
            void runtime.runAndRefresh(
              () => runtime.service.dispatch({ type: "set-overnight-stage", stage }),
            ).catch(() => null);
          }}
        />
      )}
    </JourneyRouteScreen>
  );
}
