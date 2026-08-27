import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { getResumePath } from "../../src/features/journey/application/journey-navigation";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { WelcomePage } from "../../src/features/journey/ui/pages/JourneyPages";

export default function WelcomeRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const [prefaceRead, setPrefaceRead] = useState(false);

  const restart = () => {
    Alert.alert("确认重新开始", "当前旅程草稿会被清除。", [
      { text: "取消", style: "cancel" },
      {
        text: "确认重新开始",
        style: "destructive",
        onPress: () => {
          void runtime.restart().then(() => router.replace("/journey/welcome"));
        }
      }
    ]);
  };

  return (
    <JourneyRouteScreen pageId="welcome">
      {({ controller, runAndRefresh, snapshot }) => (
        <WelcomePage
          onAdult={() => {
            void runAndRefresh(() => controller.enterWelcome({ adult: true, prefaceRead }))
              .then(() => router.replace("/journey/overnight"));
          }}
          onOpenPreface={() => {
            setPrefaceRead(true);
            router.push("/journey/preface");
          }}
          onUnderage={() => {
            void controller.enterWelcome({ adult: false, prefaceRead })
              .then(() => router.replace("/journey/underage-exit"));
          }}
          onRestart={restart}
          onResume={() => router.replace(getResumePath(snapshot))}
          resumeAvailable={snapshot?.ageConfirmed === true}
        />
      )}
    </JourneyRouteScreen>
  );
}
