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
  const [reviews, setReviews] = useState<Array<{ id: string; title: string; dateLabel: string; statusLabel: string }>>([]);
  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const [state, metadata] = await Promise.all([runtime.shellState.load(), runtime.reviewHistory.listMetadata()]);
      setInitialJourneyId(state?.initialJourneyId ?? null);
      setReviews(metadata.map((item) => ({ id: item.id, title: item.title, dateLabel: item.createdAt.slice(0, 10), statusLabel: item.status === "completed" ? "已完成" : "未完成" })));
      setLoadState("ready");
    } catch { setLoadState("error"); }
  }, [runtime.reviewHistory, runtime.shellState]);
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
        onOpenReview={(id) => router.push(`/reviews/${id}`)}
        onRetry={() => { void load(); }}
        reviews={reviews}
        topics={topics}
      />
    </Screen>
  );
}
