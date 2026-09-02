import { useRouter } from "expo-router";

import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { FinalPreparationPage } from "../../src/features/journey/ui/pages/FinalPreparationPage";

export default function FinalPreparationRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  return (
    <JourneyRouteScreen pageId="final-preparation">
      {({ controller, runAndRefresh, snapshot }) => (
        snapshot ? <FinalPreparationPage
          draft={snapshot}
          onDone={async () => {
            const cardId = await runAndRefresh(() => controller.completeInitialJourney());
            router.replace(`/cards/${cardId}`);
          }}
          onEdit={(sectionId, userText) => runAndRefresh(
            () => controller.editCommunicationCard(sectionId, userText)
          )}
          onFinish={() => runAndRefresh(() => controller.saveCommunicationCard())}
          onPractice={async (phrase) => {
            await runAndRefresh(() => controller.completeInitialJourney());
            router.replace({ pathname: "/practice", params: { phrase } });
          }}
          onSetVisibility={(sectionId, visibility) => runtime.runAndRefresh(
            () => runtime.service.dispatch({ type: "set-communication-card-visibility", sectionId, visibility })
          )}
        /> : null
      )}
    </JourneyRouteScreen>
  );
}
