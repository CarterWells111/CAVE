import { useRouter } from "expo-router";

import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { cardImagePermissionRecovery, saveCardImageToLibrary } from "../../src/features/journey/infrastructure/expo-card-image-adapter";
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
          onCopy={async (model) => {
            const result = await controller.copyConfirmedCommunicationCard({
              consentFooter: model.consentFooter,
              sections: model.sections.map(({ id, text }) => ({ id, text })),
            });
            if (result.status === "error") throw new Error("clipboard-write-failed");
          }}
          onEdit={(sectionId, userText) => runAndRefresh(
            () => controller.editCommunicationCard(sectionId, userText)
          )}
          onFinish={async () => {
            const cardId = await runAndRefresh(() => controller.completeInitialJourney());
            router.replace(`/cards/${cardId}`);
            return cardId;
          }}
          onSaveDraft={async () => { await controller.saveCommunicationCard(); }}
          onSaveImage={(_model, imageUri) => saveCardImageToLibrary(imageUri)}
          onOpenImageSettings={cardImagePermissionRecovery.openSettings}
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
