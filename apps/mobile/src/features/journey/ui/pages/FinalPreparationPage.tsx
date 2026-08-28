import { loadCatalog } from "@cave/content";
import { useRef, useState } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { Button } from "../../../../core/ui/Button";
import type { CommunicationSectionId, JourneyDraft, SharingVisibility } from "../../domain/types";
import {
  CommunicationDraftGrid,
  type CommunicationDraftGridSection
} from "../components/CommunicationDraftGrid";

type Props = {
  draft: JourneyDraft;
  onEdit(sectionId: CommunicationSectionId, userText: string): void | Promise<void>;
  onFinish(): string | Promise<string>;
  onSetVisibility(sectionId: CommunicationSectionId, visibility: SharingVisibility): void | Promise<void>;
};

const sectionCatalog = [...loadCatalog().journey.uiCopy.communicationSections]
  .sort((left, right) => left.order - right.order);

type ActiveOperation = "finish" | "retry-writes";

function normalizedDraft(draft: JourneyDraft): JourneyDraft {
  return {
    ...draft,
    communicationCard: Object.fromEntries(Object.entries(draft.communicationCard).map(([id, field]) => [id, {
      ...field,
      visibility: field.visibility === "deleted" ? "deleted" : "included"
    }])) as JourneyDraft["communicationCard"]
  };
}

function gridSections(draft: JourneyDraft): CommunicationDraftGridSection[] {
  return sectionCatalog.map((section) => {
    const id = section.id as CommunicationSectionId;
    const field = draft.communicationCard[id];
    return {
      id,
      title: section.title,
      text: field.userText ?? field.generatedText,
      deleted: field.visibility === "deleted",
      needsReview: field.needsReview
    };
  });
}

export function FinalPreparationPage({ draft, onEdit, onFinish, onSetVisibility }: Props) {
  const theme = useTheme();
  const draftRef = useRef(normalizedDraft(draft));
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const failedWritesRef = useRef<Array<() => void | Promise<void>>>([]);
  const [, renderVersion] = useState(0);
  const [status, setStatus] = useState<string>();
  const operationRef = useRef<ActiveOperation | undefined>(undefined);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation | undefined>(undefined);
  const [hasFailedWrites, setHasFailedWrites] = useState(false);

  const updateLocal = (update: (current: JourneyDraft) => JourneyDraft) => {
    draftRef.current = update(draftRef.current);
    renderVersion((version) => version + 1);
  };
  const enqueue = (operation: () => void | Promise<void>) => {
    const run = async () => {
      try {
        await operation();
      } catch {
        failedWritesRef.current.push(operation);
        setHasFailedWrites(true);
        setStatus("保存更改失败，请重试。");
      }
    };
    const next = queueRef.current.then(run, run);
    queueRef.current = next;
    return next;
  };
  const editSection = (sectionId: CommunicationSectionId, userText: string) => {
    if (operationRef.current !== undefined || failedWritesRef.current.length > 0) return;
    updateLocal((current) => ({
      ...current,
      communicationCard: {
        ...current.communicationCard,
        [sectionId]: { ...current.communicationCard[sectionId], userText, needsReview: false }
      }
    }));
    return enqueue(() => onEdit(sectionId, userText));
  };
  const setDeleted = (sectionId: CommunicationSectionId, deleted: boolean) => {
    if (operationRef.current !== undefined || failedWritesRef.current.length > 0) return;
    const visibility = deleted ? "deleted" : "included";
    updateLocal((current) => ({
      ...current,
      communicationCard: {
        ...current.communicationCard,
        [sectionId]: { ...current.communicationCard[sectionId], visibility }
      }
    }));
    return enqueue(() => onSetVisibility(sectionId, visibility));
  };
  const retryFailedWrites = async () => {
    if (operationRef.current !== undefined || failedWritesRef.current.length === 0) return;
    operationRef.current = "retry-writes";
    setActiveOperation("retry-writes");
    setStatus("正在重试保存更改…");
    const writes = failedWritesRef.current.splice(0);
    setHasFailedWrites(false);
    try {
      for (const write of writes) await enqueue(write);
      await queueRef.current;
      setStatus(failedWritesRef.current.length > 0 ? "保存更改失败，请重试。" : "更改已保存。");
    } finally {
      operationRef.current = undefined;
      setActiveOperation(undefined);
    }
  };
  const finish = async () => {
    if (operationRef.current !== undefined || failedWritesRef.current.length > 0) return;
    operationRef.current = "finish";
    setActiveOperation("finish");
    setStatus("正在保存沟通草稿…");
    try {
      await queueRef.current;
      if (failedWritesRef.current.length > 0) {
        setStatus("保存更改失败，请重试。");
        return;
      }
      await onFinish();
      setStatus("沟通草稿已保存到本机。");
    } catch {
      setStatus("沟通草稿保存失败，请重试。");
    } finally {
      operationRef.current = undefined;
      setActiveOperation(undefined);
    }
  };

  return (
    <View style={{ gap: theme.space.lg, maxWidth: "100%", width: "100%" }} testID="page-6-content">
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>整理草稿</Text>
      </View>
      <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>
        回顾一下，留下想保存的内容
      </Text>
      <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
        七段内容默认都会保存在沟通草稿箱。你可以编辑，也可以暂时删除；删除后的内容会变灰，保存前后都能恢复。
      </Text>

      <CommunicationDraftGrid
        disabled={activeOperation !== undefined || hasFailedWrites}
        onEdit={editSection}
        onSetDeleted={setDeleted}
        sections={gridSections(draftRef.current)}
      />

      {status ? (
        <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.body, color: theme.color.text }}>
          {status}
        </Text>
      ) : null}
      {hasFailedWrites ? (
        <Button
          label="重试保存更改"
          loading={activeOperation === "retry-writes"}
          onPress={() => { void retryFailedWrites(); }}
        />
      ) : null}
      <Button
        disabled={activeOperation !== undefined || hasFailedWrites}
        label={activeOperation === "finish" ? "正在保存沟通草稿…" : "保存沟通草稿"}
        loading={activeOperation === "finish"}
        onPress={() => { void finish(); }}
      />
    </View>
  );
}
