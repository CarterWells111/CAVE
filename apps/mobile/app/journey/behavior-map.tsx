import { useState } from "react";

import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { BehaviorMapPage } from "../../src/features/journey/ui/pages/behavior-map-page";

export default function BehaviorMapRoute() {
  const runtime = useJourneyRuntime();
  const [cardOpen, setCardOpen] = useState(false);
  return (
    <JourneyRouteScreen immersiveContent={cardOpen} pageId="behavior-map">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <BehaviorMapPage
          initialAttitudes={snapshot?.behaviorAttitudes ?? {}}
          initialCustomBehaviors={snapshot?.customBehaviors ?? []}
          initialSensitiveContentConsent={snapshot?.explicitContentConsent ?? null}
          onCardVisibilityChange={setCardOpen}
          onAddCustomBehavior={(behavior) => runtime.runAndRefresh(
            () => runtime.service.dispatch({ type: "add-custom-behavior", behavior })
          )}
          onComplete={() => runAndRefresh(() => controller.completeBehaviorMap())
            .then(() => goTo("reflection"))}
          onSetAttitudes={(behaviorIds, attitude) => runAndRefresh(
            () => controller.setBehaviorAttitudes(behaviorIds, attitude)
          )}
          onSetSensitiveContentConsent={(consented) => runAndRefresh(
            () => controller.setExplicitContentConsent(consented)
          )}
        />
      )}
    </JourneyRouteScreen>
  );
}
