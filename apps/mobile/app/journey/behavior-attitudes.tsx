import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { BehaviorAttitudesPage } from "../../src/features/journey/ui/pages/JourneyPages";
import { JourneyScreenShell } from "../../src/features/journey/ui/JourneyScreenShell";

export default function BehaviorAttitudesRoute() {
  return (
    <JourneyScreenShell pageId="behavior-attitudes">
      <BehaviorAttitudesPage
        behaviors={loadJourneyContentCatalog().options.filter(({ group }) => group === "behavior")}
        onSet={() => undefined}
      />
    </JourneyScreenShell>
  );
}
