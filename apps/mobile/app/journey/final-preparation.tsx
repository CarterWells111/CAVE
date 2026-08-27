import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { FinalPreparationPage } from "../../src/features/journey/ui/pages/FinalPreparationPage";

export default function FinalPreparationRoute() {
  const runtime = useJourneyRuntime();
  return (
    <JourneyRouteScreen pageId="final-preparation">
      {({ controller, runAndRefresh, snapshot }) => (
        snapshot ? <FinalPreparationPage
          draft={snapshot}
          onCopy={async () => {
            const result = await controller.copyCommunicationCard();
            if (result.status === "error") throw new Error(result.code);
          }}
          onEdit={(sectionId, userText) => runAndRefresh(
            () => controller.editCommunicationCard(sectionId, userText)
          )}
          onFinish={() => controller.saveCommunicationCard()}
          onSaveDraft={() => controller.saveCommunicationCard()}
          onSaveImage={() => Promise.reject(new Error("image-export-unavailable"))}
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
