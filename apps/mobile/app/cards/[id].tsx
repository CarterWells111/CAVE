import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { ErrorState } from "../../src/core/ui/ErrorState";
import { Screen } from "../../src/core/ui/Screen";
import { selectConfirmedCommunicationCard } from "../../src/features/journey/domain/derive-communication-card";
import type { SavedCommunicationCardRecord } from "../../src/features/journey/domain/types";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { CardDetailScreen } from "../../src/features/shell/ui/CardDetailScreen";
import { SavedCardEditScreen } from "../../src/features/shell/ui/SavedCardEditScreen";
import { ShellLoading } from "../../src/features/shell/ui/shell-ui-components";

const sectionTitles: Record<string, string> = {
  "communication-night-expectations": "对这次相处的期待",
  "communication-possible-closeness": "可能愿意的靠近",
  "communication-decide-in-moment": "希望当下再决定",
  "communication-not-this-time": "这次不想做的事",
  "communication-comfort": "让我更安心的方式",
  "communication-changed-feelings": "感受变化时怎么说",
  "communication-mutual-boundaries": "共同边界",
};

export default function SavedCardRoute() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const runtime = useJourneyRuntime();
  const [record, setRecord] = useState<SavedCommunicationCardRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    if (typeof id !== "string") {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const saved = await runtime.cards.load(id);
      setRecord(saved);
      setStatus(saved === null ? "error" : "ready");
    } catch {
      setStatus("error");
    }
  }, [id, runtime.cards]);

  useEffect(() => { void load(); }, [load]);

  if (status === "loading") return <Screen><ShellLoading /></Screen>;
  if (status === "error" || record === null) {
    return (
      <Screen>
        <ErrorState
          actionLabel="重试"
          message="暂时无法读取这张本机沟通卡。"
          onAction={() => { void load(); }}
          title="无法打开沟通卡"
        />
      </Screen>
    );
  }

  const confirmed = selectConfirmedCommunicationCard({ communicationCard: record.card });
  const sections = confirmed.sections.map((section) => ({
    ...section,
    title: sectionTitles[section.id] ?? "确认内容",
  }));
  const metadata = {
    id: record.id,
    title: "沟通卡",
    dateLabel: record.savedAt.slice(0, 10),
    statusLabel: "仅存本机",
  };
  if (mode === "edit") {
    return (
      <SavedCardEditScreen
        confirmedSections={sections}
        metadata={metadata}
        onCancel={() => router.replace(`/cards/${record.id}`)}
        onSave={async (updatedSections) => {
          const textById = new Map(updatedSections.map(({ id: sectionId, text }) => [sectionId, text]));
          await runtime.cards.save({
            ...record,
            card: Object.fromEntries(Object.entries(record.card).map(([sectionId, field]) => {
              const text = textById.get(sectionId);
              return [sectionId, text === undefined ? field : {
                ...field,
                generatedText: text,
                userText: undefined,
                needsReview: false,
              }];
            })) as SavedCommunicationCardRecord["card"],
          });
          await load();
        }}
      />
    );
  }
  return (
    <CardDetailScreen
      confirmedSections={sections}
      metadata={metadata}
      mode={mode === "fullscreen" ? "fullscreen" : "normal"}
      onBack={() => router.replace("/(tabs)/profile")}
      onCopy={async () => {
        const result = await runtime.controller.copyConfirmedCommunicationCard(confirmed);
        if (result.status === "error") throw new Error(result.code);
      }}
      onEdit={async () => { router.replace(`/cards/${record.id}?mode=edit`); }}
      onFullscreen={() => router.replace(`/cards/${record.id}${mode === "fullscreen" ? "" : "?mode=fullscreen"}`)}
    />
  );
}
