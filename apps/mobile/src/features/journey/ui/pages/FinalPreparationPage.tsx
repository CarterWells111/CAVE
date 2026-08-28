import { loadCatalog } from "@cave/content";
import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { paperTheme, theme } from "../../../../core/design/theme";
import { Button } from "../../../../core/ui/Button";
import { Card } from "../../../../core/ui/Card";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { TextAction } from "../../../../core/ui/text-action";
import {
  selectConfirmedCommunicationCard,
  type ConfirmedCommunicationCard
} from "../../domain/derive-communication-card";
import type {
  ChecklistItemStatus,
  CommunicationSectionId,
  JourneyDraft,
  SharingVisibility
} from "../../domain/types";

type Props = {
  draft: JourneyDraft;
  onCompleted?(): void;
  onEdit(sectionId: CommunicationSectionId, userText: string): void | Promise<void>;
  onSetVisibility(sectionId: CommunicationSectionId, visibility: SharingVisibility): void | Promise<void>;
  onCopy(card: ConfirmedCommunicationCard): void | Promise<void>;
  onSaveImage(card: ConfirmedCommunicationCard, imageUri: string): void | Promise<void>;
  onFinish(card: ConfirmedCommunicationCard): void | Promise<void>;
  onOpenImageSettings?(): void | Promise<void>;
  onSaveDraft?(): void | Promise<void>;
  onUpdatePreparation?(itemId: string, status: ChecklistItemStatus): void | Promise<void>;
};

const sectionCatalog = [...loadCatalog().journey.uiCopy.communicationSections]
  .sort((left, right) => left.order - right.order);

const VISIBILITY_LABELS: Record<SharingVisibility, string> = {
  pending: "待确认",
  included: "已加入分享",
  private: "仅自己可见",
  deleted: "已删除"
};

const PREPARATION_LABELS: Record<JourneyDraft["privatePreparation"]["items"][number]["category"], string> = {
  attitude: "靠近与边界",
  expression: "表达与暂停",
  comfort: "让我安心的条件",
  communication: "沟通准备",
  logistics: "这个夜晚的安排",
  health: "健康准备",
  aftercare: "结束之后"
};

const PREPARATION_STATUSES: Array<{ label: string; value: ChecklistItemStatus }> = [
  { label: "已经想到", value: "considered" },
  { label: "想再准备", value: "prepare-more" },
  { label: "这次不需要", value: "not-relevant" }
];

type ActiveOperation = "copy" | "image" | "finish" | "save-draft" | "retry-writes";

function cloneDraft(draft: JourneyDraft): JourneyDraft {
  return {
    ...draft,
    privatePreparation: {
      ...draft.privatePreparation,
      items: draft.privatePreparation.items.map((item) => ({ ...item, sourceIds: [...item.sourceIds] }))
    },
    communicationCard: Object.fromEntries(Object.entries(draft.communicationCard).map(([id, field]) => [id, { ...field }])) as JourneyDraft["communicationCard"]
  };
}

function SharePreview({ card }: { card: ConfirmedCommunicationCard }) {
  return (
    <View
      accessibilityLabel="沟通卡分享预览"
      style={{ backgroundColor: paperTheme.color.canvas, borderRadius: theme.radius.lg, gap: theme.space.md, padding: theme.space.lg }}
      testID="share-preview"
    >
      <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: paperTheme.color.text }}>靠近之前，我想告诉你</Text>
      {card.sections.length === 0 ? (
        <Text style={{ ...theme.typography.body, color: paperTheme.color.secondary }}>还没有加入可分享的段落。</Text>
      ) : card.sections.map(({ id, text }) => (
        <Text key={id} selectable style={{ ...theme.typography.body, color: paperTheme.color.text }}>{text}</Text>
      ))}
      <Text selectable style={{ ...theme.typography.caption, color: paperTheme.color.secondary }}>{card.consentFooter}</Text>
    </View>
  );
}

export function FinalPreparationPage({
  draft,
  onCompleted,
  onCopy,
  onEdit,
  onFinish,
  onOpenImageSettings,
  onSaveDraft,
  onSaveImage,
  onSetVisibility,
  onUpdatePreparation
}: Props) {
  const draftRef = useRef(cloneDraft(draft));
  const previewRef = useRef<View>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const failedWritesRef = useRef<Array<() => void | Promise<void>>>([]);
  const [, renderVersion] = useState(0);
  const [editingId, setEditingId] = useState<CommunicationSectionId>();
  const [editingText, setEditingText] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [imageConfirmationVisible, setImageConfirmationVisible] = useState(false);
  const [imageSettingsRecoveryVisible, setImageSettingsRecoveryVisible] = useState(false);
  const [handwritingVisible, setHandwritingVisible] = useState(false);
  const [status, setStatus] = useState<string>();
  const operationRef = useRef<ActiveOperation | undefined>(undefined);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation | undefined>(undefined);
  const [hasFailedWrites, setHasFailedWrites] = useState(false);
  const finishSucceededRef = useRef(false);
  const [finishSucceeded, setFinishSucceeded] = useState(false);

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
      }
    };
    const next = queueRef.current.then(run, run);
    queueRef.current = next;
    return next;
  };
  const setVisibility = (sectionId: CommunicationSectionId, visibility: SharingVisibility) => {
    if (operationRef.current !== undefined || failedWritesRef.current.length > 0 || finishSucceededRef.current) return;
    updateLocal((current) => ({
      ...current,
      communicationCard: {
        ...current.communicationCard,
        [sectionId]: { ...current.communicationCard[sectionId], visibility }
      }
    }));
    void enqueue(() => onSetVisibility(sectionId, visibility));
  };
  const updatePreparation = (itemId: string, nextStatus: ChecklistItemStatus) => {
    if (onUpdatePreparation === undefined || operationRef.current !== undefined || failedWritesRef.current.length > 0 || finishSucceededRef.current) return;
    updateLocal((current) => ({
      ...current,
      privatePreparation: {
        ...current.privatePreparation,
        items: current.privatePreparation.items.map((item) => item.id === itemId
          ? { ...item, status: nextStatus }
          : item)
      }
    }));
    void enqueue(() => onUpdatePreparation(itemId, nextStatus));
  };
  const saveEdit = () => {
    if (operationRef.current !== undefined || failedWritesRef.current.length > 0 || finishSucceededRef.current || editingId === undefined || editingText.trim().length === 0) return;
    const sectionId = editingId;
    const userText = editingText.trim();
    updateLocal((current) => ({
      ...current,
      communicationCard: {
        ...current.communicationCard,
        [sectionId]: { ...current.communicationCard[sectionId], userText, needsReview: false }
      }
    }));
    setEditingId(undefined);
    void enqueue(() => onEdit(sectionId, userText));
  };
  const afterFlush = async (
    kind: ActiveOperation,
    operation: (card: ConfirmedCommunicationCard) => void | Promise<void>,
    success: string,
    failure: string
  ) => {
    if (operationRef.current !== undefined) return;
    operationRef.current = kind;
    setActiveOperation(kind);
    setStatus("正在处理…");
    try {
      await queueRef.current;
      if (failedWritesRef.current.length > 0) {
        setStatus("保存更改失败，请重试。");
        return;
      }
      await operation(selectConfirmedCommunicationCard(draftRef.current));
      if (kind === "finish") {
        finishSucceededRef.current = true;
        setFinishSucceeded(true);
      }
      setStatus(success);
    } catch (error) {
      if (
        kind === "image"
        && typeof error === "object"
        && error !== null
        && "recovery" in error
        && error.recovery === "open-settings"
      ) {
        setImageSettingsRecoveryVisible(true);
      }
      setStatus(failure);
    } finally {
      operationRef.current = undefined;
      setActiveOperation(undefined);
    }
  };

  const retryFailedWrites = async () => {
    if (operationRef.current !== undefined || failedWritesRef.current.length === 0) return;
    operationRef.current = "retry-writes";
    setActiveOperation("retry-writes");
    setStatus("正在重试保存更改…");
    const writes = failedWritesRef.current.splice(0);
    setHasFailedWrites(false);
    try {
      for (const write of writes) {
        await enqueue(write);
      }
      await queueRef.current;
      if (failedWritesRef.current.length > 0) {
        setStatus("保存更改失败，请重试。");
      } else {
        setStatus("更改已保存，请再次选择复制或保存。");
      }
    } finally {
      operationRef.current = undefined;
      setActiveOperation(undefined);
    }
  };

  const requestCopy = () => {
    if (!previewVisible) {
      setPreviewVisible(true);
      setStatus("请先查看最终预览，再次确认后复制。");
      return;
    }
    void afterFlush("copy", onCopy, "已复制。", "复制失败，请重试或手写记录。");
  };

  const requestImageConfirmation = () => {
    setImageSettingsRecoveryVisible(false);
    setPreviewVisible(true);
    setImageConfirmationVisible(true);
    setStatus("请先查看最终预览和相册提示，再确认保存图片。");
  };

  const confirmed = selectConfirmedCommunicationCard(draftRef.current);
  return (
    <View style={{ gap: theme.space.lg, maxWidth: "100%", width: "100%" }} testID="page-6-content">
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>最终整理</Text>
        <Text accessibilityLabel="第 6 屏，共 6 屏" style={{ ...theme.typography.caption, color: theme.color.textMuted }}>6 / 6</Text>
      </View>
      <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>先留给自己，再决定分享什么</Text>

      <Card accessible={false} variant="muted">
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>只给自己看的准备</Text>
        <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>这部分只给你自己看。这不是一张必须完成的清单；只有你主动加入的内容，才会出现在沟通卡里。设备被他人解锁时，本机内容仍可能被看到。</Text>
        {draftRef.current.privatePreparation.items.length === 0 ? (
          <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>目前没有必须完成的准备项，你仍然可以继续。</Text>
        ) : draftRef.current.privatePreparation.items.map((item) => (
          <View key={item.id} style={{ borderColor: theme.color.border, borderRadius: theme.radius.control, borderWidth: theme.border.width, gap: theme.space.xs, padding: theme.space.md }}>
            <Text style={{ ...theme.typography.body, color: theme.color.text }}>{PREPARATION_LABELS[item.category]}</Text>
            {item.userNote ? <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{item.userNote}</Text> : null}
            {PREPARATION_STATUSES.map((option) => (
              <Button
                accessibilityLabel={`${PREPARATION_LABELS[item.category]}：${option.label}`}
                key={option.value}
                label={option.label}
                onPress={() => updatePreparation(item.id, option.value)}
                role="radio"
                selected={item.status === option.value}
                disabled={onUpdatePreparation === undefined || activeOperation !== undefined || hasFailedWrites || finishSucceeded}
              />
            ))}
          </View>
        ))}
      </Card>

      <View style={{ gap: theme.space.md }}>
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>我的沟通草稿</Text>
        <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>七段内容都从待确认开始。只有你明确加入的段落才会出现在复制和图片中。</Text>
        {sectionCatalog.map((section) => {
          const sectionId = section.id as CommunicationSectionId;
          const field = draftRef.current.communicationCard[sectionId];
          const text = field.userText ?? field.generatedText;
          return (
            <Card accessible={false} key={section.id}>
              <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>{section.title}</Text>
              <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{VISIBILITY_LABELS[field.visibility]}</Text>
              {field.needsReview ? <Text style={{ ...theme.typography.caption, color: theme.color.warning }}>内容已变化，需要重新确认</Text> : null}
              {editingId === sectionId ? (
                <>
                  <TextInput
                    accessibilityLabel={`编辑${section.title}`}
                    multiline
                    onChangeText={setEditingText}
                    style={{ ...theme.typography.body, borderColor: theme.color.interactiveBorder, borderRadius: theme.radius.control, borderWidth: theme.border.width, color: theme.color.text, minHeight: 112, padding: theme.space.md }}
                    value={editingText}
                  />
                  <Button disabled={activeOperation !== undefined || hasFailedWrites || finishSucceeded} label="保存编辑" onPress={saveEdit} />
                </>
              ) : (
                <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{field.visibility === "deleted" ? "这段已删除" : text}</Text>
              )}
              <Button accessibilityLabel={`加入分享：${section.title}`} disabled={activeOperation !== undefined || hasFailedWrites || finishSucceeded} label="加入分享" onPress={() => setVisibility(sectionId, "included")} role="radio" selected={field.visibility === "included"} />
              <SecondaryButton disabled={activeOperation !== undefined || hasFailedWrites || finishSucceeded} label={`编辑：${section.title}`} onPress={() => { setEditingId(sectionId); setEditingText(text); }} />
              <Button accessibilityLabel={`保持私密：${section.title}`} disabled={activeOperation !== undefined || hasFailedWrites || finishSucceeded} label="只留给自己" onPress={() => setVisibility(sectionId, "private")} role="radio" selected={field.visibility === "private"} />
              <Button accessibilityLabel={`删除：${section.title}`} disabled={activeOperation !== undefined || hasFailedWrites || finishSucceeded} label="删除这一段" onPress={() => setVisibility(sectionId, "deleted")} role="radio" selected={field.visibility === "deleted"} />
            </Card>
          );
        })}
      </View>

      <Button label="预览分享卡" onPress={() => setPreviewVisible(true)} />
      {previewVisible ? (
        <View collapsable={false} ref={previewRef}>
          <SharePreview card={confirmed} />
        </View>
      ) : null}
      {previewVisible ? <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>文字会进入系统剪贴板。CAVE 不会自动发送，你可以粘贴到自己选择的应用中。</Text> : null}
      <Button disabled={activeOperation !== undefined && activeOperation !== "copy"} label={activeOperation === "copy" ? "正在复制…" : "复制已确认内容"} loading={activeOperation === "copy"} onPress={requestCopy} />
      <SecondaryButton disabled={activeOperation !== undefined} label="保存为图片" onPress={requestImageConfirmation} />
      {imageConfirmationVisible ? (
        <View style={{ gap: theme.space.sm }}>
          <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>图片会进入系统相册。如果设备开启了相册云同步，它也可能同步到你的云端账户。</Text>
          <Button
            label={activeOperation === "image" ? "正在保存图片…" : "确认并保存图片"}
            loading={activeOperation === "image"}
            onPress={() => {
              void afterFlush("image", async (card) => {
                if (previewRef.current === null) throw new Error("preview-not-ready");
                const imageUri = await captureRef(previewRef, { format: "png", quality: 1, result: "tmpfile" });
                await onSaveImage(card, imageUri);
              }, "图片已保存。", "图片保存失败，请检查权限后重试。");
            }}
          />
        </View>
      ) : null}
      {imageSettingsRecoveryVisible && onOpenImageSettings !== undefined ? (
        <Button label="前往系统设置" onPress={() => { void onOpenImageSettings(); }} />
      ) : null}
      <TextAction label="我想手写" onPress={() => setHandwritingVisible(true)} />
      {handwritingVisible ? <Text style={{ ...theme.typography.body, color: theme.color.text }}>可以把确认后的内容抄写到纸上；CAVE 不会自动分享。</Text> : null}
      {status ? <Text accessibilityLiveRegion="polite" style={{ ...theme.typography.body, color: theme.color.text }}>{status}</Text> : null}
      {hasFailedWrites ? <Button label="重试保存更改" loading={activeOperation === "retry-writes"} onPress={() => { void retryFailedWrites(); }} /> : null}
      <SecondaryButton
        disabled={onSaveDraft === undefined || activeOperation !== undefined || finishSucceeded}
        label={activeOperation === "save-draft" ? "正在保存草稿…" : "保存给自己"}
        loading={activeOperation === "save-draft"}
        onPress={() => {
          if (onSaveDraft !== undefined) {
            void afterFlush("save-draft", async () => onSaveDraft(), "已保存当前草稿，不会自动分享。", "草稿保存失败，请重试。");
          }
        }}
      />
      <Button
        disabled={finishSucceeded || (activeOperation !== undefined && activeOperation !== "finish")}
        label={finishSucceeded ? "首次记录已完成" : activeOperation === "finish" ? "正在完成…" : "完成首次记录"}
        loading={activeOperation === "finish"}
        onPress={() => { void afterFlush("finish", onFinish, "已保存到本机。", "保存失败，请重试。"); }}
      />
      {finishSucceeded && onCompleted !== undefined ? (
        <Button label="返回应用入口" onPress={onCompleted} />
      ) : null}
    </View>
  );
}
