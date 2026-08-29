import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { ErrorState } from "../../src/core/ui/ErrorState";
import { Screen } from "../../src/core/ui/Screen";
import { selectConfirmedCommunicationCard } from "../../src/features/journey/domain/derive-communication-card";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { ReviewDetailScreen, type ReviewDetailSection } from "../../src/features/reviews/ui/ReviewDetailScreen";
import { ShellRouteGate } from "../../src/features/shell/ui/ShellRouteGate";
import { ShellLoading } from "../../src/features/shell/ui/shell-ui-components";

export default function ReviewDetailRoute() {
  return (
    <ShellRouteGate>
      <AuthorizedReviewDetailRoute />
    </ShellRouteGate>
  );
}

function AuthorizedReviewDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof runtime.reviewHistory.loadDetail>>>(null);
  const load = useCallback(async () => {
    if (typeof id !== "string") { setState("error"); return; }
    setState("loading");
    try { const value = await runtime.reviewHistory.loadDetail(id); setDetail(value); setState(value ? "ready" : "error"); }
    catch { setState("error"); }
  }, [id, runtime.reviewHistory]);
  useEffect(() => { void load(); }, [load]);
  if (state === "loading") return <Screen><ShellLoading /></Screen>;
  if (state === "error" || detail === null) return <Screen><ErrorState actionLabel="重试" message="暂时无法读取这条本机回顾。" onAction={() => { void load(); }} title="无法打开回顾" /></Screen>;
  const confirmed = selectConfirmedCommunicationCard(detail.payload);
  const sections: ReviewDetailSection[] = [
    ...(detail.payload.journal.text ? [{ id: "journal", title: "本地日记", text: detail.payload.journal.text }] : []),
    ...confirmed.sections.map((section) => ({ id: section.id, title: "已确认沟通内容", text: section.text })),
  ];
  return <ReviewDetailScreen
    metadata={{ id: detail.id, title: detail.title, dateLabel: detail.createdAt.slice(0, 10), statusLabel: detail.status === "completed" ? "已完成" : "未完成" }}
    sections={sections}
    onBack={() => router.replace("/(tabs)/profile")}
    onBranch={async () => {
      const seed = await runtime.reviewHistory.loadBranchSeed(detail.id);
      if (seed === null) throw new Error("review-not-found");
      const now = new Date().toISOString();
      const branch = { ...seed.payload, id: `${seed.payload.id}:branch:${Date.now()}`, createdAt: now, updatedAt: now };
      await runtime.runAndRefresh(async () => {
        await runtime.branchFromReview(branch, {
          rootId: seed.rootId,
          sourceVersionId: seed.sourceVersionId,
          title: `基于 ${seed.suggestedTitle} 的新版本`,
        });
      });
      router.replace(`/journey/${branch.currentPage}`);
    }}
    onContinueAfterDelete={() => router.replace("/(tabs)/profile")}
    onDelete={async (reviewId) => { await runtime.reviewHistory.deleteVersion(reviewId); }}
    onSaveToJournal={() => router.push({ pathname: "/journal/new", params: { reviewId: detail.id } })}
  />;
}
