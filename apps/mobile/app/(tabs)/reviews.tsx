import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { Screen } from "../../src/core/ui/Screen";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { ReviewsHubScreen } from "../../src/features/shell/ui/ReviewsHubScreen";
import { isActiveLongTermReview } from "../../src/features/shell/application/app-shell-service";

const topics = [
  { id: "body", label: "身体感受" },
  { id: "boundaries", label: "边界与表达" },
  { id: "practice", label: "沟通练习" }
];

export default function ReviewsRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const [initialJourneyId, setInitialJourneyId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const state = await runtime.shellState.load();
      setInitialJourneyId(state?.initialJourneyId ?? null);
      setLoadState("ready");
    } catch { setLoadState("error"); }
  }, [runtime.shellState]);
  useEffect(() => {
    void load();
  }, [load]);
  const completion = initialJourneyId === null ? null : { initialJourneyId, initialJourneyCompletedAt: "" };
  const activeReview = isActiveLongTermReview(runtime.snapshot, completion) && runtime.snapshot
    ? { id: runtime.snapshot.id, title: "本次回顾", dateLabel: runtime.snapshot.updatedAt.slice(0, 10), statusLabel: "进行中" }
    : null;
  const startFullReview = () => {
    void runtime.replaceActiveReview().then(() => router.push("/journey/welcome"));
  };

  return (
    <Screen>
      <ReviewsHubScreen
        activeReview={activeReview}
        loadState={loadState}
        onContinueReview={() => router.push(`/journey/${runtime.snapshot?.currentPage ?? "welcome"}`)}
        onStartFullReview={startFullReview}
        onStartTopic={(id) => router.push(id === "practice" ? "/practice/session" : `/reviews/topic/${id}`)}
        onRetry={() => { void load(); }}
        topics={topics}
      />
    </Screen>
  );
}
