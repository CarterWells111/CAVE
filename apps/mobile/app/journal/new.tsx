import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { useReadyJournalService } from "../../src/features/journal/runtime/JournalAccessProvider";
import type { JournalHighlight, JournalRecord, JournalSource } from "../../src/features/journal/domain/journal-record";
import { JournalEditorScreen } from "../../src/features/journal/ui/JournalEditorScreen";
import { JournalLoadingScreen } from "../../src/features/journal/ui/JournalLoadingScreen";
import { buildRetainedLocalDraftSections } from "../../src/features/shell/application/saved-card-edit";
import { backOrHome } from "../../src/features/shell/ui/safe-navigation";

type Initial = Readonly<{ title?: string; occurredAt?: string; highlight?: JournalHighlight; body?: string; source?: JournalSource; cardSnapshot?: JournalRecord["cardSnapshot"] }>;

export default function NewJournalRoute() {
  const router = useRouter();
  const { cardId, reviewId } = useLocalSearchParams<{ cardId?: string; reviewId?: string }>();
  const runtime = useJourneyRuntime();
  const journalService = useReadyJournalService();
  const [initial, setInitial] = useState<Initial | null>(cardId || reviewId ? null : {});
  useEffect(() => {
    let active = true;
    void (async () => {
      if (typeof cardId === "string") {
        const card = await runtime.cards.load(cardId);
        if (card === null) throw new Error("card-not-found");
        const retainedSections = buildRetainedLocalDraftSections(card);
        if (active) setInitial({
          title: "一次沟通准备", occurredAt: card.savedAt,
          highlight: { kind: "impression", text: "这张沟通卡记录了当时最想表达的内容" },
          source: { kind: "journey", journeyId: card.journeyId, cardId: card.id },
          cardSnapshot: { cardId: card.id, capturedAt: new Date().toISOString(), sections: retainedSections }
        });
      } else if (typeof reviewId === "string") {
        const review = await runtime.reviewHistory.loadDetail(reviewId);
        if (review === null) throw new Error("review-not-found");
        if (active) setInitial({
          title: review.title, occurredAt: review.createdAt,
          highlight: { kind: "impression", text: "这是由一次引导整理出的回顾，保存前可以修改" },
          body: review.payload.journal.text,
          source: { kind: "journey", journeyId: review.payload.id, reviewId: review.id }
        });
      }
    })().catch(() => { if (active) setInitial({}); });
    return () => { active = false; };
  }, [cardId, reviewId, runtime.cards, runtime.reviewHistory]);
  if (initial === null) return <JournalLoadingScreen message="正在从本机整理可编辑框架…" />;
  return <JournalEditorScreen initial={initial} service={journalService} onBack={() => backOrHome(router)} onSaved={(id) => router.replace({ pathname: "/journal/[id]", params: { id } })} />;
}
