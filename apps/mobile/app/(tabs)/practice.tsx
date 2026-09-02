import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "../../src/core/ui/Screen";
import { parseStandalonePracticePhrase } from "../../src/features/journey/application/standalone-practice-route";
import { PracticeHubScreen } from "../../src/features/shell/ui/PracticeHubScreen";

export default function PracticeRoute() {
  const router = useRouter();
  const { phrase: routePhrase } = useLocalSearchParams<{ phrase?: string | string[] }>();
  const recentPhrase = parseStandalonePracticePhrase(routePhrase);
  const start = () => router.push("/practice/session");
  const startScenario = (id: string) => router.push({
    pathname: "/practice/session",
    params: { scenario: id },
  });
  return (
    <Screen>
      <PracticeHubScreen
        onStartPhrase={(phrase) => router.push({
          pathname: "/practice/session",
          params: { phrase, scenario: "pause" },
        })}
        onStartPractice={start}
        onStartScenario={startScenario}
        scenarios={[
          { id: "pause", title: "说出暂停", statusLabel: "本机预设分支" },
          { id: "adjust", title: "调整靠近", statusLabel: "本机预设分支" }
        ]}
        {...(recentPhrase ? { recentPhrase } : {})}
      />
    </Screen>
  );
}
