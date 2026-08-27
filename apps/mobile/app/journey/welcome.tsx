import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { getResumePath } from "../../src/features/journey/application/journey-navigation";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { WelcomePage } from "../../src/features/journey/ui/pages/WelcomePage";

export default function WelcomeRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const restart = () => new Promise<void>((resolve, reject) => {
    Alert.alert("确认重新开始", "当前旅程草稿会被清除。", [
      { text: "取消", style: "cancel", onPress: () => resolve() },
      {
        text: "确认重新开始",
        style: "destructive",
        onPress: () => runtime.restart()
          .then(() => router.replace("/journey/welcome"))
          .then(() => resolve(), reject)
      }
    ]);
  });

  return (
    <JourneyRouteScreen pageId="welcome">
      {({ controller, runAndRefresh, snapshot }) => (
        <WelcomePage
          onAdult={() => runAndRefresh(() => controller.enterWelcome({ adult: true, prefaceRead: true }))
            .then(() => router.replace("/journey/overnight"))}
          onUnderage={() => controller.enterWelcome({ adult: false, prefaceRead: false })
            .then(() => router.replace("/journey/underage-exit"))}
          onRestart={restart}
          onResume={() => router.replace(getResumePath(snapshot))}
          resumeAvailable={snapshot?.ageConfirmed === true}
        />
      )}
    </JourneyRouteScreen>
  );
}
