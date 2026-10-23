import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useOptionalAssistantHistory } from "../assistant/AssistantHistoryProvider";
import { useOptionalAuth } from "../auth/runtime/AuthProvider";
import { useOptionalJournalAccess } from "../journal/runtime/JournalAccessProvider";
import type { JournalPeriodReview, JournalRecordSummary } from "../journal/infrastructure/journal-repository";
import { useOptionalJourneyRuntime } from "../journey/runtime/JourneyRuntimeProvider";
import type { ReviewVersionMetadata } from "../reviews/infrastructure/review-history-repository";
import { createGrowthData, emptyGrowthData, type GrowthData } from "./growth-records";

type Records = {
  journalRecords: readonly Pick<JournalRecordSummary, "id" | "createdAt">[];
  periodReviews: readonly Pick<JournalPeriodReview, "id" | "createdAt">[];
  journeyReviews: readonly Pick<ReviewVersionMetadata, "id" | "createdAt" | "status">[];
};
type LoadSnapshot = { scope: object; status: "loading" | "ready" | "error"; records?: Records };

export function useGrowthRecords(): {
  data: GrowthData; loading: boolean; error: boolean; reload(): void; locked: boolean;
} {
  const auth = useOptionalAuth();
  const access = useOptionalJournalAccess();
  const runtime = useOptionalJourneyRuntime();
  const history = useOptionalAssistantHistory();
  const accountId = auth?.accountId;
  const authenticated = auth?.status === "signedIn" || auth?.status === "offline";
  const journalService = access?.status === "ready" && access.accountId === accountId ? access.service : undefined;
  const reviewHistory = runtime?.reviewHistory;
  const scope = useMemo(() => ({}), [accountId, journalService, reviewHistory]);
  const [snapshot, setSnapshot] = useState<LoadSnapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);
  const historyRef = useRef(history);
  const accessRef = useRef(access);
  historyRef.current = history;
  accessRef.current = access;
  const authLoading = auth?.status === "loading";
  const locked = !authLoading && (!authenticated || !accountId || runtime === null || access?.status === "locked");
  const providerError = !locked && (access?.status === "error" || Boolean(history?.error)
    || (authenticated && (!access || !history)));
  const providerLoading = authLoading || access?.status === "loading" || Boolean(history?.loading)
    || (!locked && !providerError && authenticated && (!journalService || !reviewHistory));
  const canLoad = !locked && !providerError && !providerLoading && Boolean(journalService && reviewHistory && history);

  const reload = useCallback(() => {
    setAttempt(value => value + 1);
    if (accessRef.current?.status === "error") accessRef.current.retry();
    if (historyRef.current?.error) void historyRef.current.retry();
  }, []);

  useEffect(() => history?.subscribeToClear(() => {
    requestId.current += 1;
    setSnapshot(null);
    setAttempt(value => value + 1);
  }), [history?.subscribeToClear]);

  useFocusEffect(useCallback(() => {
    let active = true;
    const currentRequest = ++requestId.current;
    if (canLoad && journalService && reviewHistory) {
      setSnapshot({ scope, status: "loading" });
      void Promise.all([
        journalService.listRecords(), journalService.listPeriodReviews(), reviewHistory.listMetadata(),
      ]).then(([journalRecords, periodReviews, journeyReviews]) => {
        if (!active || currentRequest !== requestId.current) return;
        setSnapshot({ scope, status: "ready", records: {
          journalRecords: journalRecords.map(({ id, createdAt }) => ({ id, createdAt })),
          periodReviews: periodReviews.map(({ id, createdAt }) => ({ id, createdAt })),
          journeyReviews: journeyReviews.map(({ id, createdAt, status }) => ({ id, createdAt, status })),
        } });
      }, () => {
        if (active && currentRequest === requestId.current) setSnapshot({ scope, status: "error" });
      });
    }
    return () => { active = false; };
  }, [attempt, canLoad, journalService, reviewHistory, scope]));

  const visible = snapshot?.scope === scope ? snapshot : null;
  const error = !locked && (providerError || visible?.status === "error");
  const loading = !locked && !error && (providerLoading || (canLoad && visible?.status !== "ready"));
  const data = useMemo(() => {
    if (locked || error || loading || visible?.status !== "ready" || !visible.records) return emptyGrowthData();
    return createGrowthData({ ...visible.records, conversations: history?.conversations ?? [] });
  }, [error, history?.conversations, loading, locked, visible]);
  return { data, loading, error, reload, locked };
}
