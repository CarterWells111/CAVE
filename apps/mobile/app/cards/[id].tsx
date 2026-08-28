import { loadCatalog } from "@cave/content";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { ErrorState } from "../../src/core/ui/ErrorState";
import { Screen } from "../../src/core/ui/Screen";
import type { CommunicationSectionId, SavedCommunicationCardRecord } from "../../src/features/journey/domain/types";
import { useJourneyRuntime } from "../../src/features/journey/runtime/JourneyRuntimeProvider";
import { CardDetailScreen } from "../../src/features/shell/ui/CardDetailScreen";
import { SavedCardEditScreen } from "../../src/features/shell/ui/SavedCardEditScreen";
import { ShellLoading } from "../../src/features/shell/ui/shell-ui-components";

const sectionCatalog = [...loadCatalog().journey.uiCopy.communicationSections]
  .sort((left, right) => left.order - right.order);

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

  const sections = sectionCatalog.map((section) => {
    const sectionId = section.id as CommunicationSectionId;
    const field = record.card[sectionId];
    return {
      id: sectionId,
      title: section.title,
      text: field.userText ?? field.generatedText,
      deleted: field.visibility === "deleted",
      needsReview: field.needsReview
    };
  });
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
        sections={sections}
        onCancel={() => router.replace(`/cards/${record.id}`)}
        onSave={async (updatedSections) => {
          const updatedById = new Map(updatedSections.map((section) => [section.id, section]));
          const updatedRecord: SavedCommunicationCardRecord = {
            ...record,
            card: Object.fromEntries(Object.entries(record.card).map(([sectionId, field]) => {
              const updated = updatedById.get(sectionId as CommunicationSectionId);
              return [sectionId, updated === undefined ? field : {
                ...field,
                userText: updated.text,
                needsReview: false,
                visibility: updated.deleted ? "deleted" as const : "included" as const
              }];
            })) as SavedCommunicationCardRecord["card"],
          };
          await runtime.cards.save(updatedRecord);
          setRecord(updatedRecord);
        }}
      />
    );
  }
  return (
    <CardDetailScreen
      metadata={metadata}
      sections={sections.filter((section) => !section.deleted && section.text.trim().length > 0)}
      onBack={() => router.replace("/(tabs)/cards")}
      onEdit={async () => { router.replace(`/cards/${record.id}?mode=edit`); }}
    />
  );
}
