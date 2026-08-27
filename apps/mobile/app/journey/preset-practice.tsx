import { Alert } from "react-native";

import { loadJourneyContentCatalog } from "../../src/features/journey/infrastructure/journey-content-catalog";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { PresetPracticePage } from "../../src/features/journey/ui/pages/JourneyPages";

export default function PresetPracticeRoute() {
  const phrase = loadJourneyContentCatalog().practice.phrases.find(({ intent }) => intent === "slow-down");
  return (
    <JourneyRouteScreen pageId="preset-practice">
      {({ controller, goTo, runAndRefresh, snapshot }) => (
        <PresetPracticePage
          phrase={snapshot?.practice.editedPhrase ?? phrase?.text ?? "先暂停一下。"}
          onComplete={(editedPhrase) => {
            const behaviorId = Object.keys(snapshot?.behaviorAttitudes ?? {})[0]
              ?? snapshot?.customBehaviors[0]?.id;
            if (behaviorId === undefined || phrase === undefined) {
              Alert.alert("先完成上一页", "请选择一项当前态度后再开始预设练习。");
              return;
            }
            void runAndRefresh(() => controller.completePractice({
              behaviorId,
              intent: "slow-down",
              phraseId: phrase.id,
              editedPhrase,
              branch: "supportive"
            })).then(() => goTo("checklist"));
          }}
        />
      )}
    </JourneyRouteScreen>
  );
}
