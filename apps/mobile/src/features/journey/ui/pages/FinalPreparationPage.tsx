import { loadCatalog } from "@cave/content";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { paperTheme } from "../../../../core/design/theme";
import { useTheme } from "../../../../core/design/theme-provider";
import { Button } from "../../../../core/ui/Button";
import { Card } from "../../../../core/ui/Card";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { TextAction } from "../../../../core/ui/text-action";
import { createCommunicationCardExportModel, type CommunicationCardExportModel } from "../../domain/communication-card-export";
import type { ChecklistItemStatus, CommunicationSectionId, JourneyDraft, SharingVisibility } from "../../domain/types";
import {
  CommunicationDraftGrid,
  type CommunicationDraftGridSection
} from "../components/CommunicationDraftGrid";

type Props = {
  draft: JourneyDraft;
  onEdit(sectionId: CommunicationSectionId, userText: string): void | Promise<void>;
  onFinish(): string | Promise<string>;
  onSetVisibility(sectionId: CommunicationSectionId, visibility: SharingVisibility): void | Promise<void>;
  onCopy?(model: CommunicationCardExportModel): void | Promise<void>;
  onSaveImage?(model: CommunicationCardExportModel, imageUri: string): void | Promise<void>;
  onOpenImageSettings?(): void | Promise<void>;
  onSaveDraft?(): void | Promise<void>;
  onUpdatePreparation?(itemId: string, status: ChecklistItemStatus): void | Promise<void>;
};

export type { CommunicationCardExportModel } from "../../domain/communication-card-export";

const sectionCatalog = [...loadCatalog().journey.uiCopy.communicationSections]
  .sort((left, right) => left.order - right.order);

type ActiveOperation = "finish" | "retry-writes" | "save-draft" | "save-image";

function cloneDraft(draft: JourneyDraft): JourneyDraft {
  return {
    ...draft,
    privatePreparation: { ...draft.privatePreparation, items: draft.privatePreparation.items.map((item) => ({ ...item, sourceIds: [...item.sourceIds] })) },
    communicationCard: Object.fromEntries(Object.entries(draft.communicationCard).map(([id, field]) => [id, { ...field }])) as JourneyDraft["communicationCard"]
  };
}

const PREPARATION_LABELS: Record<JourneyDraft["privatePreparation"]["items"][number]["category"], string> = {
  attitude: "靠近与边界", expression: "表达与暂停", comfort: "让我更安心的条件", communication: "沟通准备", logistics: "这个夜晚的安排", health: "健康准备", aftercare: "结束之后"
};

function privatePreparationDetails(draft: JourneyDraft) {
  const answers = Object.values(draft.reflection)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const phrase = draft.practice.editedPhrase?.trim() || draft.practice.phrase?.trim();
  return [
    ["只给自己的回答", answers.join("；")],
    ["表达句", phrase ?? "尚未写下"],
    ["安心需要", draft.comfortNeedIds.join("、") || "尚未选择"],
    ["条件式健康准备", draft.privatePreparation.items.filter((item) => item.category === "health").map((item) => item.id).join("、") || "本次未出现"],
    ["事后照顾", draft.privatePreparation.aftercareIds.join("、") || "尚未选择"],
  ] as const;
}

function exportModel(draft: JourneyDraft): CommunicationCardExportModel {
  return createCommunicationCardExportModel(sectionCatalog.flatMap((section) => {
      const id = section.id as CommunicationSectionId;
      const field = draft.communicationCard[id];
      return field.visibility === "included" && !field.needsReview
        ? [{ id, title: section.title, text: field.userText ?? field.generatedText }]
        : [];
    }));
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

export function FinalPreparationPage({ draft, onCopy, onEdit, onFinish, onOpenImageSettings, onSaveDraft, onSaveImage, onSetVisibility, onUpdatePreparation }: Props) {
  const theme = useTheme();
  const draftRef = useRef(cloneDraft(draft));
  const previewRef = useRef<View>(null);
  const exportModelRef = useRef<CommunicationCardExportModel | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const failedWritesRef = useRef<Array<() => void | Promise<void>>>([]);
  const [, renderVersion] = useState(0);
  const [status, setStatus] = useState<string>();
  const operationRef = useRef<ActiveOperation | undefined>(undefined);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation | undefined>(undefined);
  const [hasFailedWrites, setHasFailedWrites] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [copyConfirmationVisible, setCopyConfirmationVisible] = useState(false);
  const [imageConfirmationVisible, setImageConfirmationVisible] = useState(false);
  const [imageSettingsRecoveryVisible, setImageSettingsRecoveryVisible] = useState(false);
  const [handwritingVisible, setHandwritingVisible] = useState(false);

  const updateLocal = (update: (current: JourneyDraft) => JourneyDraft) => {
    draftRef.current = update(draftRef.current);
    // Any local change invalidates an already reviewed export snapshot. The
    // next copy/image action must render and confirm the new immutable model.
    exportModelRef.current = null;
    setPreviewVisible(false);
    setCopyConfirmationVisible(false);
    setImageConfirmationVisible(false);
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
        [sectionId]: {
          ...current.communicationCard[sectionId],
          userText,
          visibility: current.communicationCard[sectionId].visibility === "included" ? "pending" : current.communicationCard[sectionId].visibility,
          needsReview: false
        }
      }
    }));
    return enqueue(() => onEdit(sectionId, userText));
  };
  const setDeleted = (sectionId: CommunicationSectionId, deleted: boolean) => {
    if (operationRef.current !== undefined || failedWritesRef.current.length > 0) return;
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
  const setVisibility = (sectionId: CommunicationSectionId, visibility: SharingVisibility) => {
    if (operationRef.current !== undefined || failedWritesRef.current.length > 0) return;
    updateLocal((current) => ({ ...current, communicationCard: { ...current.communicationCard, [sectionId]: { ...current.communicationCard[sectionId], visibility } } }));
    void enqueue(() => onSetVisibility(sectionId, visibility));
  };
  const updatePreparation = (itemId: string, status: ChecklistItemStatus) => {
    if (onUpdatePreparation === undefined || operationRef.current !== undefined || hasFailedWrites) return;
    updateLocal((current) => ({ ...current, privatePreparation: { ...current.privatePreparation, items: current.privatePreparation.items.map((item) => item.id === itemId ? { ...item, status } : item) } }));
    void enqueue(() => onUpdatePreparation(itemId, status));
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
  const showPreview = () => {
    exportModelRef.current ??= exportModel(draftRef.current);
    setPreviewVisible(true);
  };
  const model = exportModelRef.current;
  const requestCopy = () => {
    if (onCopy === undefined || operationRef.current !== undefined) return;
    showPreview();
    setCopyConfirmationVisible(true);
    setStatus("请确认：复制会将内容写入系统剪贴板；只有确认后才会写入。");
  };
  const copy = async () => {
    if (onCopy === undefined || operationRef.current !== undefined || model === null) return;
    operationRef.current = "finish"; setActiveOperation("finish");
    try { await queueRef.current; if (failedWritesRef.current.length > 0) throw new Error(); await onCopy(model); setStatus("已复制。文字会进入系统剪贴板，请自行选择粘贴位置。"); } catch { setStatus("复制失败，请重试或手写记录。"); } finally { operationRef.current = undefined; setActiveOperation(undefined); }
  };
  const saveImage = async () => {
    if (onSaveImage === undefined || previewRef.current === null || operationRef.current !== undefined || model === null) return;
    operationRef.current = "save-image"; setActiveOperation("save-image");
    try {
      await queueRef.current;
      if (failedWritesRef.current.length > 0) throw new Error("pending-write-failed");
      const imageUri = await captureRef(previewRef, { format: "png", quality: 1, result: "tmpfile" });
      await onSaveImage(model, imageUri);
      setStatus("图片已保存。相册或 iCloud 的后续处理由设备设置决定。");
    } catch (error) {
      if ((error as { recovery?: unknown }).recovery === "open-settings") setImageSettingsRecoveryVisible(true);
      setStatus("图片保存失败，请检查权限后重试。");
    } finally { operationRef.current = undefined; setActiveOperation(undefined); }
  };
  const saveDraft = async () => {
    if (onSaveDraft === undefined || operationRef.current !== undefined) return;
    operationRef.current = "save-draft"; setActiveOperation("save-draft");
    try {
      await queueRef.current;
      if (failedWritesRef.current.length > 0) throw new Error("pending-write-failed");
      await onSaveDraft();
      setStatus("已保存给自己。");
    } catch { setStatus("保存给自己失败，请先重试未完成的更改。"); }
    finally { operationRef.current = undefined; setActiveOperation(undefined); }
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

      <Card accessible={false} variant="muted">
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>只给自己看的准备</Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>这些准备只留在本机，不会进入沟通卡或导出内容。</Text>
        {privatePreparationDetails(draftRef.current).map(([title, detail]) => (
          <View key={title} style={{ gap: theme.space.xs }}>
            <Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: theme.color.text }}>{title}</Text>
            <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{detail}</Text>
          </View>
        ))}
        {draftRef.current.privatePreparation.items.map((item) => (
          <View key={item.id} style={{ gap: theme.space.xs }}>
            <Text style={{ ...theme.typography.body, color: theme.color.text }}>{PREPARATION_LABELS[item.category]}</Text>
            {(["considered", "prepare-more", "not-relevant"] as ChecklistItemStatus[]).map((choice) => (
              <Button accessibilityLabel={`${PREPARATION_LABELS[item.category]}：${choice}`} key={choice} label={choice === "considered" ? "已经想到" : choice === "prepare-more" ? "想再准备" : "这次不需要"} onPress={() => updatePreparation(item.id, choice)} role="radio" selected={item.status === choice} disabled={onUpdatePreparation === undefined} />
            ))}
          </View>
        ))}
      </Card>

      <View style={{ gap: theme.space.md }}>
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>逐段确认沟通内容</Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>七段内容从待确认开始；只有“已加入分享”且不需要复查的段落会进入预览、复制和图片。</Text>
        {sectionCatalog.map((section) => {
          const id = section.id as CommunicationSectionId;
          const field = draftRef.current.communicationCard[id];
          return <View key={id} style={{ gap: theme.space.xs }}>
            <Text style={{ ...theme.typography.cardTitle, color: theme.color.text }}>{section.title}</Text>
            <Text style={{ ...theme.typography.caption, color: field.needsReview ? theme.color.warning : theme.color.textSecondary }}>{field.needsReview ? "上游内容已变化，需要重新确认" : field.visibility === "pending" ? "待确认" : field.visibility === "included" ? "已加入分享" : "仅自己可见"}</Text>
            <Button accessibilityLabel={`加入分享：${section.title}`} label="加入分享" onPress={() => setVisibility(id, "included")} role="radio" selected={field.visibility === "included"} />
            <SecondaryButton accessibilityLabel={`保持私密：${section.title}`} label="只留给自己" onPress={() => setVisibility(id, "private")} />
          </View>;
        })}
      </View>

      <Button label="预览分享卡" onPress={showPreview} />
      {previewVisible && model !== null ? <View ref={previewRef} collapsable={false} style={{ backgroundColor: paperTheme.color.canvas, borderRadius: theme.radius.lg, gap: theme.space.md, padding: theme.space.lg }} testID="communication-card-export-preview"><Text accessibilityRole="header" style={{ ...theme.typography.heading, color: paperTheme.color.text }}>{model.title}</Text>{model.sections.map((section) => <View key={section.id}><Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: paperTheme.color.text }}>{section.title}</Text><Text style={{ ...theme.typography.body, color: paperTheme.color.text }}>{section.text}</Text></View>)}<Text style={{ ...theme.typography.caption, color: paperTheme.color.secondary }}>{model.consentFooter}</Text></View> : null}
      <Button disabled={onCopy === undefined} label={activeOperation === "finish" ? "正在复制…" : "复制已确认内容"} loading={activeOperation === "finish"} onPress={requestCopy} />
      {copyConfirmationVisible ? <View style={{ gap: theme.space.sm }}><Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>复制会写入系统剪贴板。请只在你愿意粘贴到的位置使用它。</Text><Button label="确认复制到剪贴板" onPress={() => { void copy(); }} /></View> : null}
      <SecondaryButton disabled={onSaveImage === undefined} label="保存为图片" onPress={() => { showPreview(); setImageConfirmationVisible(true); }} />
      {imageConfirmationVisible ? <View style={{ gap: theme.space.sm }}><Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>保存前请确认：图片会进入系统相册；设备如开启 iCloud 相册同步，图片也可能同步到你的云端账户。</Text><Button label="确认并保存图片" onPress={() => { void saveImage(); }} /></View> : null}
      {imageSettingsRecoveryVisible && onOpenImageSettings !== undefined ? <Button label="打开系统设置" onPress={() => { void onOpenImageSettings(); }} /> : null}
      <TextAction label="我想手写" onPress={() => setHandwritingVisible(true)} />
      {handwritingVisible ? <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>可以把确认后的内容抄写到纸上；CAVE 不会自动分享。</Text> : null}
      <SecondaryButton disabled={onSaveDraft === undefined || activeOperation !== undefined || hasFailedWrites} label={activeOperation === "save-draft" ? "正在保存给自己…" : "保存给自己"} onPress={() => { void saveDraft(); }} />

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
