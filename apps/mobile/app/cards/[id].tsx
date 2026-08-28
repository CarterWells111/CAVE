import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { ErrorState } from "../../src/core/ui/ErrorState";
import { Screen } from "../../src/core/ui/Screen";
import type { SavedCommunicationCardRecord } from "../../src/features/journey/domain/types";
import { selectConfirmedSavedCommunicationCard } from "../../src/features/journey/domain/derive-communication-card";
import { saveCardImageToLibrary } from "../../src/features/journey/infrastructure/expo-card-image-adapter";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import {
  applySavedCardSectionUpdates,
  buildEditableSavedCardSections,
  confirmSavedCardSharingPolicy,
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
          message="暂时无法读取这份本机沟通草稿。"
          onAction={() => { void load(); }}
          title="无法打开沟通草稿"
        />
      </Screen>
    );
  }

  const editableSections = buildEditableSavedCardSections(record);
  const retainedSections = editableSections
    .filter(({ text, visibility }) => visibility !== "deleted" && text.trim().length > 0)
    .map(({ id: sectionId, text, title }) => ({ id: sectionId, text, title }));
  const metadata = {
    id: record.id,
    title: "沟通草稿",
    dateLabel: record.savedAt.slice(0, 10),
    statusLabel: "仅存本机",
  };

  if (mode === "edit") {
    return (
      <SavedCardEditScreen
        metadata={metadata}
        sections={editableSections}
        onCancel={() => router.replace(`/cards/${record.id}`)}
        onSave={async (updates) => {
          const updatedRecord = applySavedCardSectionUpdates(record, updates);
          await runtime.cards.save(updatedRecord);
          setRecord(updatedRecord);
        }}
      />
    );
  }

  const confirmedCard = selectConfirmedSavedCommunicationCard(record);

  return (
    <CardDetailScreen
      metadata={metadata}
      exportEligible={confirmedCard !== null}
      sections={retainedSections}
      onBack={() => router.replace("/(tabs)/profile")}
      onEdit={async () => { router.replace(`/cards/${record.id}?mode=edit`); }}
      onReconfirm={async () => {
        const confirmedRecord = confirmSavedCardSharingPolicy(record);
        await runtime.cards.save(confirmedRecord);
        setRecord(confirmedRecord);
      }}
      {...(confirmedCard === null ? {} : {
        onCopy: async () => {
          const result = await runtime.controller.copyConfirmedCommunicationCard(confirmedCard);
          if (result.status !== "success") throw new Error(result.code);
        },
        onSaveImage: (imageUri: string) => saveCardImageToLibrary(imageUri),
      })}
    />
  );
}
