import { loadMobileJourneyContentCatalog } from "@cave/content/mobile-journey";
import { useRef, useState } from "react";
import { AccessibilityInfo, Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { Button } from "../../../../core/ui/Button";
import type { CommunicationSectionId, JourneyDraft, SharingVisibility } from "../../domain/types";
import { CommunicationDraftGrid, type CommunicationDraftGridSection } from "../components/CommunicationDraftGrid";

type Props = Readonly<{
  draft: JourneyDraft;
  onEdit(sectionId: CommunicationSectionId, userText: string): void | Promise<void>;
  onFinish(): string | Promise<string>;
  onSetVisibility(sectionId: CommunicationSectionId, visibility: SharingVisibility): void | Promise<void>;
}>;

const sectionCatalog = [...loadMobileJourneyContentCatalog().uiCopy.communicationSections]
  .sort((left, right) => left.order - right.order);

type ActiveOperation = "finish" | "retry-writes";

function cloneDraft(draft: JourneyDraft): JourneyDraft {
  return {
    ...draft,
    communicationCard: Object.fromEntries(
      Object.entries(draft.communicationCard).map(([id, field]) => [id, { ...field }])
    ) as JourneyDraft["communicationCard"]
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
  const draftRef = useRef(cloneDraft(draft));
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWritesRef = useRef(0);
  const failedWritesRef = useRef<Array<() => void | Promise<void>>>([]);
  const [, renderVersion] = useState(0);
  const [status, setStatus] = useState<string>();
  const operationRef = useRef<ActiveOperation | undefined>(undefined);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation>();
  const [hasPendingWrites, setHasPendingWrites] = useState(false);
  const [hasFailedWrites, setHasFailedWrites] = useState(false);

  const reportStatus = (message: string, announce = false) => {
    setStatus(message);
    if (announce) AccessibilityInfo.announceForAccessibility(message);
  };

  const updateLocal = (update: (current: JourneyDraft) => JourneyDraft) => {
    draftRef.current = update(draftRef.current);
    renderVersion((version) => version + 1);
  };

  const enqueue = (operation: () => void | Promise<void>) => {
    pendingWritesRef.current += 1;
    setHasPendingWrites(true);
    const run = async () => {
      try {
        await operation();
      } catch {
        failedWritesRef.current.push(operation);
        setHasFailedWrites(true);
        reportStatus("保存更改失败，请重试。", true);
      } finally {
        pendingWritesRef.current -= 1;
        setHasPendingWrites(pendingWritesRef.current > 0);
      }
    };
    const next = queueRef.current.then(run, run);
    queueRef.current = next;
    return next;
  };

  const editSection = (sectionId: CommunicationSectionId, userText: string) => {
    if (operationRef.current !== undefined || pendingWritesRef.current > 0 || failedWritesRef.current.length > 0) return;
    updateLocal((current) => ({
      ...current,
      communicationCard: {
        ...current.communicationCard,
        [sectionId]: {
          ...current.communicationCard[sectionId],
          userText,
          visibility: current.communicationCard[sectionId].visibility === "included"
            ? "pending"
            : current.communicationCard[sectionId].visibility,
          needsReview: false
        }
      }
    }));
    return enqueue(() => onEdit(sectionId, userText));
  };

  const setDeleted = (sectionId: CommunicationSectionId, deleted: boolean) => {
    if (operationRef.current !== undefined || pendingWritesRef.current > 0 || failedWritesRef.current.length > 0) return;
    const visibility = deleted ? "deleted" : "pending";
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
    reportStatus("正在重试保存更改…");
    const writes = failedWritesRef.current.splice(0);
    setHasFailedWrites(false);
    try {
      for (const write of writes) await enqueue(write);
      await queueRef.current;
      reportStatus(
        failedWritesRef.current.length > 0 ? "保存更改失败，请重试。" : "更改已保存。",
        true,
      );
    } finally {
      operationRef.current = undefined;
      setActiveOperation(undefined);
    }
  };

  const finish = async () => {
    if (operationRef.current !== undefined || failedWritesRef.current.length > 0) return;
    operationRef.current = "finish";
    setActiveOperation("finish");
    reportStatus("正在保存沟通草稿…");
    try {
      await queueRef.current;
      if (failedWritesRef.current.length > 0) {
        reportStatus("保存更改失败，请重试。", true);
        return;
      }
      await onFinish();
      reportStatus("已保存，正在打开我的沟通草稿。");
    } catch {
      reportStatus("保存失败，请重试。", true);
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
        七段内容排成一列。你可以编辑，也可以暂时删除；删除后的内容会变灰，确认前随时可以恢复。
      </Text>

      <CommunicationDraftGrid
        dense
        disabled={activeOperation !== undefined || hasPendingWrites || hasFailedWrites}
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
      <View style={{ gap: theme.space.sm }}>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          保存后，所有未删除的段落会进入“我的沟通草稿”，只保存在本机。
        </Text>
        <Button
          disabled={activeOperation !== undefined || hasFailedWrites}
          label={activeOperation === "finish" ? "正在保存沟通草稿…" : "保存并查看我的沟通草稿"}
          loading={activeOperation === "finish"}
          onPress={() => { void finish(); }}
        />
      </View>
    </View>
  );
}
