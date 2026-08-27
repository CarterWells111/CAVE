import { Alert } from "react-native";

import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyContinueButton, JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { BodyKnowledgePage } from "../../src/features/journey/ui/pages/JourneyPages";

export default function BodyKnowledgeRoute() {
  const catalog = loadJourneyContentCatalog();
  return (
    <JourneyRouteScreen pageId="body-knowledge">
      {({ controller, goTo, runAndRefresh }) => (
        <>
          <BodyKnowledgePage
            cards={catalog.knowledge}
            onOpenDiagram={() => { void runAndRefresh(() => controller.openMedicalDiagram()); }}
            onOpenSources={(sourceIds) => {
              const titles = sourceIds.map((id) => catalog.sources.find((source) => source.id === id)?.title ?? id);
              Alert.alert("本地来源", titles.join("\n"));
            }}
            onRead={(cardId) => { void runAndRefresh(() => controller.readKnowledge(cardId)); }}
          />
          <JourneyContinueButton onPress={() => { void goTo("behavior-attitudes"); }} />
        </>
      )}
    </JourneyRouteScreen>
  );
}
