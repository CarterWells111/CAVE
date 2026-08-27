import { ChecklistPage } from "../../src/features/journey/ui/pages/JourneyPages";
import { JourneyScreenShell } from "../../src/features/journey/ui/JourneyScreenShell";

export default function ChecklistRoute() {
  return (
    <JourneyScreenShell pageId="checklist">
      <ChecklistPage items={[]} onFinish={() => undefined} onUpdate={() => undefined} />
    </JourneyScreenShell>
  );
}
