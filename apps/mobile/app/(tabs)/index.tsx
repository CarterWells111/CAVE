import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { Screen } from "../../src/core/ui/Screen";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { HomeScreen } from "../../src/features/shell/ui/HomeScreen";
import { isActiveLongTermReview } from "../../src/features/shell/application/app-shell-service";
import type { ShellMetadataItem } from "../../src/features/shell/ui/shell-ui-components";

export default function HomeRoute() {
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [cards, setCards] = useState<ShellMetadataItem[]>([]);
  const [initialJourneyId, setInitialJourneyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const [records, completion] = await Promise.all([
        runtime.cards.listMetadata(),
        runtime.shellState.load(),
      ]);
      setCards(records.map((record) => ({
        id: record.id,
        title: "沟通卡",
        dateLabel: record.savedAt.slice(0, 10),
        statusLabel: "已保存到本机"
      })));
      setInitialJourneyId(completion?.initialJourneyId ?? null);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [runtime.cards, runtime.shellState]);

  useEffect(() => { void load(); }, [load]);

  const completion = initialJourneyId === null
    ? null
    : { initialJourneyId, initialJourneyCompletedAt: "" };
  const activeReview = isActiveLongTermReview(runtime.snapshot, completion) && runtime.snapshot
    ? {
        id: runtime.snapshot.id,
        title: "本次回顾",
        dateLabel: runtime.snapshot.updatedAt.slice(0, 10),
        statusLabel: "进行中"
      }
    : null;

  return (
    <Screen>
      <HomeScreen
        activeReview={activeReview}
        currentCard={cards[0] ?? null}
        loadState={loadState}
        onContinueReview={() => router.push(`/journey/${runtime.snapshot?.currentPage ?? "welcome"}`)}
        onOpenCurrentCard={(id) => router.push(`/cards/${id}`)}
        onOpenRecord={(id) => router.push(`/cards/${id}`)}
        onOpenSettings={() => router.push("/settings")}
        onRetry={() => { void load(); }}
        onStartPractice={() => router.push("/practice/session")}
        onStartReview={() => {
          void runtime.replaceActiveReview().then(() => router.push("/journey/welcome"));
        }}
        recentRecords={cards}
      />
    </Screen>
  );
}
