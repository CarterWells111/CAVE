import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { ErrorState } from "../../src/core/ui/ErrorState";
import { Screen } from "../../src/core/ui/Screen";
import { getSampleJourney } from "../../src/features/explore/catalog";
import { SampleJourneyScreen } from "../../src/features/explore/ui/sample-journey-screen";

export default function SampleJourneyRoute() {
  const router = useRouter();
  const { journeyId } = useLocalSearchParams<{ journeyId?: string }>();
  const journey = getSampleJourney(journeyId);
  const [focused, setFocused] = useState(false);
  const exit = useCallback(() => router.replace("/(tabs)"), [router]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  // Unmount the pager on blur: retained stack screens must neither preserve a
  // previous preview nor intercept hardware back on another screen.
  if (!focused) return null;
  if (journey === undefined) return (
    <Screen>
      <ErrorState title="找不到这段旅程" message="这段旅程暂时无法打开，可以返回地图重新选择。" actionLabel="返回地图" onAction={exit} />
    </Screen>
  );
  return <SampleJourneyScreen key={journey.id} journey={journey} onExit={exit} />;
}
