import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { OvernightPage } from "../../src/features/journey/ui/pages/JourneyPages";
import { JourneyScreenShell } from "../../src/features/journey/ui/JourneyScreenShell";

export default function OvernightRoute() {
  const options = loadJourneyContentCatalog().options;
  return (
    <JourneyScreenShell pageId="overnight">
      <OvernightPage
        concernOptions={options.filter(({ group }) => group === "concern")}
        expectationOptions={options.filter(({ group }) => group === "expectation")}
        onContinue={() => undefined}
      />
    </JourneyScreenShell>
  );
}
