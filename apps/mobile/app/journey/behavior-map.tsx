import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { BehaviorMapPage } from "../../src/features/journey/ui/pages/behavior-map-page";

export default function BehaviorMapRoute() {
  const runtime = useJourneyRuntime();
  return (
    <JourneyRouteScreen pageId="behavior-map">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <BehaviorMapPage
          initialAttitudes={snapshot?.behaviorAttitudes ?? {}}
          initialCustomBehaviors={snapshot?.customBehaviors ?? []}
          initialSensitiveContentConsent={snapshot?.explicitContentConsent ?? null}
          onAddCustomBehavior={(behavior) => runtime.runAndRefresh(
            () => runtime.service.dispatch({ type: "add-custom-behavior", behavior })
          )}
          onComplete={() => goTo("reflection")}
          onSetAttitude={(behaviorId, attitude) => runAndRefresh(
            () => controller.setBehaviorAttitude(behaviorId, attitude)
          )}
        />
      )}
    </JourneyRouteScreen>
  );
}
