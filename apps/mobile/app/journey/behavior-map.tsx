import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { BehaviorAttitudesPage } from "../../src/features/journey/ui/pages/JourneyPages";

export default function BehaviorMapRoute() {
  return (
    <JourneyRouteScreen pageId="behavior-map">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <BehaviorAttitudesPage
          behaviors={loadJourneyContentCatalog().options.filter(({ group }) => group === "behavior")}
          currentAttitudes={snapshot?.behaviorAttitudes ?? {}}
          onContinue={() => goTo("reflection")}
          onSet={(behaviorId, attitude) => runAndRefresh(
            () => controller.setBehaviorAttitude(behaviorId, attitude)
          )}
        />
      )}
    </JourneyRouteScreen>
  );
}
