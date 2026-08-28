import { useRouter } from "expo-router";

import { Screen } from "../../src/core/ui/Screen";
import { PracticeHubScreen } from "../../src/features/shell/ui/PracticeHubScreen";

export default function PracticeRoute() {
  const router = useRouter();
  const start = () => router.push("/practice/session");
  const startScenario = (id: string) => router.push({
    pathname: "/practice/session",
    params: { scenario: id },
  });
  return (
    <Screen>
      <PracticeHubScreen
        onStartPractice={start}
        onStartScenario={startScenario}
        scenarios={[
          { id: "pause", title: "说出暂停", statusLabel: "本机预设分支" },
          { id: "adjust", title: "调整靠近", statusLabel: "本机预设分支" }
        ]}
      />
    </Screen>
  );
}
