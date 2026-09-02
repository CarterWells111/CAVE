import { loadMobileJourneyContentCatalog } from "@cave/content/mobile-journey";
import { useRef, useState } from "react";
import { AccessibilityInfo, Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { Button } from "../../../../core/ui/Button";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { MAX_STANDALONE_PRACTICE_PHRASE_LENGTH } from "../../application/standalone-practice-route";
import type { CommunicationSectionId, JourneyDraft, SharingVisibility } from "../../domain/types";
import { CommunicationDraftGrid, type CommunicationDraftGridSection } from "../components/CommunicationDraftGrid";

type Props = Readonly<{
  draft: JourneyDraft;
  onDone(cardId: string): void | Promise<void>;
  onEdit(sectionId: CommunicationSectionId, userText: string): void | Promise<void>;
  onFinish(): string | Promise<string>;
  onPractice(phrase: string): void | Promise<void>;
  onSetVisibility(sectionId: CommunicationSectionId, visibility: SharingVisibility): void | Promise<void>;
}>;

const sectionCatalog = [...loadMobileJourneyContentCatalog().uiCopy.communicationSections]
  .sort((left, right) => left.order - right.order);

type ActiveOperation = "finish" | "retry-writes";
type SavedAction = "done" | "practice";
const DEFAULT_PRACTICE_PHRASE = "先停一下，我现在不想继续。";

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

export function FinalPreparationPage({ draft, onDone, onEdit, onFinish, onPractice, onSetVisibility }: Props) {
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
  const [savedCardId, setSavedCardId] = useState<string>();
  const [savedAction, setSavedAction] = useState<SavedAction>();
  const [savedActionError, setSavedActionError] = useState(false);
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
      const cardId = await onFinish();
      setSavedCardId(cardId);
      reportStatus("沟通草稿已保存。", true);
    } catch {
      reportStatus("保存失败，请重试。", true);
    } finally {
      operationRef.current = undefined;
      setActiveOperation(undefined);
    }
  };

  const changedFeelingsField = draftRef.current.communicationCard["communication-changed-feelings"];
  const userAuthoredPhrase = changedFeelingsField.visibility === "deleted"
    ? ""
    : changedFeelingsField.userText?.trim() ?? "";
  const practicePhrase = userAuthoredPhrase.length > 0
    && userAuthoredPhrase.length <= MAX_STANDALONE_PRACTICE_PHRASE_LENGTH
    ? userAuthoredPhrase
    : DEFAULT_PRACTICE_PHRASE;

  const runSavedAction = async (action: SavedAction) => {
    if (savedCardId === undefined || savedAction !== undefined) return;
    setSavedAction(action);
    setSavedActionError(false);
    try {
      if (action === "practice") await onPractice(practicePhrase);
      else await onDone(savedCardId);
    } catch {
      setSavedActionError(true);
      AccessibilityInfo.announceForAccessibility("暂时无法完成旅程，请重试。");
    } finally {
      setSavedAction(undefined);
    }
  };

  if (savedCardId !== undefined) {
    return (
      <View style={{ gap: theme.space.lg, maxWidth: "100%", width: "100%" }} testID="page-5-content">
        <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>
          沟通草稿已保存
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          你可以直接带走这句话，也可以现在排练一次。
        </Text>
        <Text selectable style={{ ...theme.typography.display, color: theme.color.text }}>
          {practicePhrase}
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          拒绝不需要标准话术；这句简短示例只是一个可以带走的起点，不会改动你的草稿。
        </Text>
        {savedActionError ? (
          <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" selectable style={{ ...theme.typography.body, color: theme.color.danger }}>
            暂时无法完成旅程，请重试。
          </Text>
        ) : null}
        <Button
          disabled={savedAction !== undefined}
          label="排练一下这句话"
          loading={savedAction === "practice"}
          onPress={() => { void runSavedAction("practice"); }}
        />
        <SecondaryButton
          disabled={savedAction !== undefined}
          label="暂时不用，完成旅程"
          loading={savedAction === "done"}
          onPress={() => { void runSavedAction("done"); }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: theme.space.lg, maxWidth: "100%", width: "100%" }} testID="page-5-content">
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
