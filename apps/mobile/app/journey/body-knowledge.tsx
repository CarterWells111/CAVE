import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { BodyKnowledgePage } from "../../src/features/journey/ui/pages/JourneyPages";
import { JourneyScreenShell } from "../../src/features/journey/ui/JourneyScreenShell";

export default function BodyKnowledgeRoute() {
  return (
    <JourneyScreenShell pageId="body-knowledge">
      <BodyKnowledgePage
        cards={loadJourneyContentCatalog().knowledge}
        onOpenDiagram={() => undefined}
        onOpenSources={() => undefined}
        onRead={() => undefined}
      />
    </JourneyScreenShell>
  );
}
