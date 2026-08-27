import { useRouter } from "expo-router";

import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import {
  cardImagePermissionRecovery,
  saveCardImageToLibrary
} from "../../src/features/journey/infrastructure/expo-card-image-adapter";
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
          onCompleted={() => router.replace("/")}
          onCopy={async () => {
            const result = await controller.copyCommunicationCard();
            if (result.status === "error") throw new Error(result.code);
          }}
          onEdit={(sectionId, userText) => runAndRefresh(
            () => controller.editCommunicationCard(sectionId, userText)
          )}
          onFinish={(card) => controller.completeInitialJourney(card)}
          onOpenImageSettings={() => cardImagePermissionRecovery.openSettings()}
          onSaveDraft={() => controller.saveCommunicationCard()}
          onSaveImage={(_card, imageUri) => saveCardImageToLibrary(imageUri)}
          onSetVisibility={(sectionId, visibility) => runtime.runAndRefresh(
            () => runtime.service.dispatch({ type: "set-communication-card-visibility", sectionId, visibility })
          )}
          onUpdatePreparation={(itemId, status) => runAndRefresh(
            () => controller.updateChecklist(itemId, status)
          )}
        /> : null
      )}
    </JourneyRouteScreen>
  );
}
