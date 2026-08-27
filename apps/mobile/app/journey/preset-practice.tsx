import * as ExpoClipboard from "expo-clipboard";
import { Alert, Linking } from "react-native";

import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { PresetPracticePage } from "../../src/features/journey/ui/pages/PresetPracticePage";

export default function PresetPracticeRoute() {
  const catalog = loadJourneyContentCatalog();
  const runtime = useJourneyRuntime();
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
      {({ goTo, snapshot }) => {
        return <PresetPracticePage
          behaviorOptions={Object.entries(snapshot?.behaviorAttitudes ?? {}).map(([id, attitude]) => ({
            attitude,
            id,
            label: catalog.options.find((option) => option.id === id)?.label
              ?? snapshot?.customBehaviors.find((behavior) => behavior.id === id)?.label
              ?? "自定义行为"
          }))}
          catalog={catalog.practice}
          onComplete={(input) => runtime.runAndRefresh(async () => {
            await runtime.service.dispatch({
              type: "set-practice",
              practice: {
                ...(input.behaviorId ? { behaviorId: input.behaviorId } : {}),
                intent: input.intent,
                editedPhrase: input.phrase,
                ...(input.optionalBranch ? { partnerResponseBranch: input.optionalBranch } : {}),
                ...(input.optionalResponse ? { reflectionNote: input.optionalResponse } : {}),
                mirrorRehearsed: true,
                completed: true,
              },
            });
            if (input.pointEventKey) {
              await runtime.service.dispatch({ type: "record-point-event", key: input.pointEventKey });
            }
          }).then(() => goTo("final-preparation"))}
          onCopySupportNumber={async (number) => { await ExpoClipboard.setStringAsync(number); }}
          onOpenSources={openSources}
        />;
      }}
    </JourneyRouteScreen>
  );
}
