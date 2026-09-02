import { CONSENT_REMINDER_SEEN_POINT_EVENT_KEY } from "../../src/features/journey/application/journey-progress-markers";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { ConsentReminderPage } from "../../src/features/journey/ui/pages/ConsentReminderPage";

export default function ReflectionRoute() {
  const runtime = useJourneyRuntime();
  return (
    <JourneyRouteScreen pageId="reflection">
      {({ goTo, runAndRefresh }) => (
        <ConsentReminderPage
          onComplete={() => runAndRefresh(() => runtime.service.dispatch({
            type: "record-point-event",
            key: CONSENT_REMINDER_SEEN_POINT_EVENT_KEY,
          })).then(() => goTo("final-preparation"))}
        />
      )}
    </JourneyRouteScreen>
  );
}
