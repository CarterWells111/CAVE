import { Linking } from "react-native";

// Metro resolves this checked-in review asset at bundle time.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const medicalDiagram = require("../../../../assets/medical/vulva-anatomy-review-current.png");

import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { BodyKnowledgePage } from "../../src/features/journey/ui/pages/BodyKnowledgePage";

export default function BodyKnowledgeRoute() {
  const catalog = loadJourneyContentCatalog();
  return (
    <JourneyRouteScreen pageId="body-knowledge">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <BodyKnowledgePage
          addressPreference={snapshot?.addressPreference ?? "你"}
          cards={catalog.knowledge}
          diagramSource={medicalDiagram}
          onContinue={() => goTo("overnight")}
          onOpenDiagram={() => runAndRefresh(() => controller.openMedicalDiagram())}
          onRead={(cardId) => runAndRefresh(() => controller.readKnowledge(cardId))}
          onSourceAction={(source) => Linking.openURL(source.url)}
          sources={catalog.sources}
        />
      )}
    </JourneyRouteScreen>
  );
}
