import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Text } from "react-native";

import { getResumePath } from "../../src/features/journey/application/journey-navigation";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { JourneyRouteScreen } from "../../src/features/journey/ui/JourneyRouteScreen";
import { WelcomePage } from "../../src/features/journey/ui/pages/WelcomePage";

export default function WelcomeRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const restartOpenRef = useRef(false);
  const [restartStatus, setRestartStatus] = useState<"idle" | "pending" | "error">("idle");
  const restart = () => {
    if (restartOpenRef.current) return Promise.resolve();
    restartOpenRef.current = true;
    setRestartStatus("pending");
    return new Promise<void>((resolve) => {
      const settle = (status: "idle" | "error") => {
        restartOpenRef.current = false;
        setRestartStatus(status);
        resolve();
      };
      Alert.alert("确认重新开始", "当前旅程草稿会被清除。", [
        { text: "取消", style: "cancel", onPress: () => settle("idle") },
        {
          text: "确认重新开始",
          style: "destructive",
          onPress: () => {
            void runtime.restart()
              .then(() => router.replace("/journey/welcome"))
              .then(() => settle("idle"), () => settle("error"));
          }
        }
      ]);
    });
  };

  return (
    <JourneyRouteScreen pageId="welcome">
      {({ controller, runAndRefresh, snapshot }) => (
        <>
          <WelcomePage
            onAddressPreferenceChange={(preference) => runAndRefresh(async () => {
              await runtime.service.confirmAdult();
              await controller.setAddressPreference(preference);
            })}
            onAdult={() => runAndRefresh(() => controller.enterWelcome({ adult: true, prefaceRead: true }))
              .then(() => router.replace("/journey/overnight"))}
            onUnderage={() => controller.enterWelcome({ adult: false, prefaceRead: false })
              .then(() => router.replace("/journey/underage-exit"))}
            onRestart={restart}
            onResume={() => router.replace(getResumePath(snapshot))}
            resumeAvailable={snapshot?.ageConfirmed === true}
          />
          {restartStatus === "pending" ? <Text accessibilityLiveRegion="polite">正在重新开始…</Text> : null}
          {restartStatus === "error" ? <Text accessibilityRole="alert">操作失败，请重试。</Text> : null}
        </>
      )}
    </JourneyRouteScreen>
  );
}
