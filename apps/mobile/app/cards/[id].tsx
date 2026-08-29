import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { ErrorState } from "../../src/core/ui/ErrorState";
import { Screen } from "../../src/core/ui/Screen";
import { selectConfirmedCommunicationCard } from "../../src/features/journey/domain/derive-communication-card";
import type { SavedCommunicationCardRecord } from "../../src/features/journey/domain/types";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import {
  applySavedCardSectionUpdates,
  buildEditableSavedCardSections,
} from "../../src/features/shell/application/saved-card-edit";
import { CardDetailScreen } from "../../src/features/shell/ui/CardDetailScreen";
import { SavedCardEditScreen } from "../../src/features/shell/ui/SavedCardEditScreen";
import { ShellLoading } from "../../src/features/shell/ui/shell-ui-components";

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
  const editableSections = buildEditableSavedCardSections(record);
  const titlesById = new Map(editableSections.map(({ id: sectionId, title }) => [sectionId, title]));
  const confirmedSections = confirmed.sections.map((section) => ({
    ...section,
    title: titlesById.get(section.id) ?? "确认内容",
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
        sections={editableSections}
        metadata={metadata}
        onCancel={() => router.replace(`/cards/${record.id}`)}
        onSave={async (updates) => {
          const updatedRecord = applySavedCardSectionUpdates(record, updates);
          await runtime.cards.save(updatedRecord);
          setRecord(updatedRecord);
        }}
      />
    );
  }
  return (
    <CardDetailScreen
      confirmedSections={confirmedSections}
      metadata={metadata}
      mode={mode === "fullscreen" ? "fullscreen" : "normal"}
      onBack={() => router.replace("/(tabs)/profile")}
      onCopy={async () => {
        const result = await runtime.controller.copyConfirmedCommunicationCard(confirmed);
        if (result.status === "error") throw new Error(result.code);
      }}
      onEdit={async () => { router.replace(`/cards/${record.id}?mode=edit`); }}
      onFullscreen={() => router.replace(`/cards/${record.id}${mode === "fullscreen" ? "" : "?mode=fullscreen"}`)}
      onSaveToJournal={() => router.push({ pathname: "/journal/new", params: { cardId: record.id } })}
    />
  );
}
