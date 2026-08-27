import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { ReflectionPage } from "../../src/features/journey/ui/pages/JourneyPages";

export default function ReflectionRoute() {
  const options = loadJourneyContentCatalog().options;
  return (
    <JourneyRouteScreen pageId="reflection">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <ReflectionPage
          comfortNeedOptions={options.filter(({ group }) => group === "comfort")}
          initialComfortNeedIds={snapshot?.comfortNeedIds ?? []}
          initialExpressionSupportNeeded={snapshot?.expressionSupportNeeded ?? null}
          initialJournalSaveChoice={snapshot?.journalSaveChoice ?? "device"}
          initialMotivationIds={snapshot?.motivationIds ?? []}
          motivationOptions={options.filter(({ group }) => group === "motivation")}
          onComplete={(input) => {
            void runAndRefresh(() => controller.saveReflection(input))
              .then(() => goTo("preset-practice"));
          }}
        />
      )}
    </JourneyRouteScreen>
  );
}
