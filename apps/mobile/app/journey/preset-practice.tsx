import * as ExpoClipboard from "expo-clipboard";
import { Alert, Linking } from "react-native";

import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { PresetPracticePage } from "../../src/features/journey/ui/pages/PresetPracticePage";

export default function PresetPracticeRoute() {
  const catalog = loadJourneyContentCatalog();
  const openSources = (sourceIds: string[]) => {
    const sources = sourceIds.flatMap((id) => catalog.sources.filter((source) => source.id === id));
    if (sources.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      Alert.alert("信息来源", "请选择要查看的来源。", [
        ...sources.map((source) => ({
          text: source.organization,
          onPress: () => { void Linking.openURL(source.url).finally(resolve); },
        })),
        { text: "取消", style: "cancel", onPress: () => resolve() },
      ]);
    });
  };
  return (
    <JourneyRouteScreen pageId="preset-practice">
      {({ controller, goTo, runAndRefresh, snapshot }) => {
        return <PresetPracticePage
          behaviorOptions={Object.entries(snapshot?.behaviorAttitudes ?? {}).map(([id, attitude]) => ({
            attitude,
            id,
            label: catalog.options.find((option) => option.id === id)?.label
              ?? snapshot?.customBehaviors.find((behavior) => behavior.id === id)?.label
              ?? "自定义行为"
          }))}
          catalog={catalog.practice}
          onComplete={(input) => runAndRefresh(() => controller.completePractice({
            behaviorId: input.behaviorId,
            intent: input.intent,
            phrase: input.phrase,
            aftercareId: input.aftercareId,
            completed: true,
            ...(input.pointEventKey === undefined ? {} : { pointEventKey: input.pointEventKey }),
            ...(input.optionalBranch === undefined ? {} : { optionalBranch: input.optionalBranch }),
            ...(input.optionalResponse === undefined ? {} : { optionalResponse: input.optionalResponse }),
          }))
            .then(() => goTo("final-preparation"))}
          onCopySupportNumber={async (number) => { await ExpoClipboard.setStringAsync(number); }}
          onOpenSources={openSources}
        />;
      }}
    </JourneyRouteScreen>
  );
}
