import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { ChecklistPage } from "../../src/features/journey/ui/pages/JourneyPages";

export default function ChecklistRoute() {
  return (
    <JourneyRouteScreen pageId="checklist">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <ChecklistPage
          items={(snapshot?.checklistItems ?? []).map((item) => ({
            id: item.id,
            label: item.id,
            status: item.status,
            userNote: item.userNote ?? ""
          }))}
          onFinish={async () => {
            await runAndRefresh(() => controller.finishChecklistReview());
            await goTo("communication-card");
          }}
          onUpdate={(itemId, status, userNote) => runAndRefresh(
            () => controller.updateChecklist(itemId, status, userNote)
          )}
        />
      )}
    </JourneyRouteScreen>
  );
}
