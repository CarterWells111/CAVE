import { Linking } from "react-native";

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
          onContinue={() => goTo("behavior-map")}
          onOpenDiagram={() => runAndRefresh(() => controller.openMedicalDiagram())}
          onRead={(cardId) => runAndRefresh(() => controller.readKnowledge(cardId))}
          onSourceAction={(source) => Linking.openURL(source.url)}
          sources={catalog.sources}
        />
      )}
    </JourneyRouteScreen>
  );
}
