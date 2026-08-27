import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

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
  useEffect(() => {
    let active = true;
    void runtime.shellState.load().then(
      (state) => { if (active) setInitialJourneyId(state?.initialJourneyId ?? null); },
      () => { if (active) setInitialJourneyId(null); },
    );
    return () => { active = false; };
  }, [runtime.shellState]);
  const completion = initialJourneyId === null ? null : { initialJourneyId, initialJourneyCompletedAt: "" };
  const activeReview = isActiveLongTermReview(runtime.snapshot, completion) && runtime.snapshot
    ? { id: runtime.snapshot.id, title: "本次回顾", dateLabel: runtime.snapshot.updatedAt.slice(0, 10), statusLabel: "进行中" }
    : null;
  const startFullReview = () => {
    void runtime.restart().then(() => router.push("/journey/welcome"));
  };

  return (
    <Screen>
      <ReviewsHubScreen
        activeReview={activeReview}
        onContinueReview={() => router.push(`/journey/${runtime.snapshot?.currentPage ?? "welcome"}`)}
        onStartFullReview={startFullReview}
        onStartTopic={(id) => router.push(id === "practice" ? "/practice/session" : `/reviews/topic/${id}`)}
        reviews={[]}
        topics={topics}
      />
    </Screen>
  );
}
