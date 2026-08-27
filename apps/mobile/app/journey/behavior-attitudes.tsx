import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyContinueButton, JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { BehaviorAttitudesPage } from "../../src/features/journey/ui/pages/JourneyPages";

export default function BehaviorAttitudesRoute() {
  return (
    <JourneyRouteScreen pageId="behavior-attitudes">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <>
          <BehaviorAttitudesPage
            behaviors={loadJourneyContentCatalog().options.filter(({ group }) => group === "behavior")}
            currentAttitudes={snapshot?.behaviorAttitudes ?? {}}
            onSet={(behaviorId, attitude) => {
              void runAndRefresh(() => controller.setBehaviorAttitude(behaviorId, attitude));
            }}
          />
          <JourneyContinueButton onPress={() => { void goTo("reflection"); }} />
        </>
      )}
    </JourneyRouteScreen>
  );
}
