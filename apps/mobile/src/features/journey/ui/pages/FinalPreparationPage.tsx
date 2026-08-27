import { loadCatalog } from "@cave/content";
import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

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
  CommunicationSectionId,
  JourneyDraft,
  SharingVisibility
} from "../../domain/types";

type Props = {
  draft: JourneyDraft;
  onEdit(sectionId: CommunicationSectionId, userText: string): void | Promise<void>;
  onSetVisibility(sectionId: CommunicationSectionId, visibility: SharingVisibility): void | Promise<void>;
  onCopy(card: ConfirmedCommunicationCard): void | Promise<void>;
  onSaveImage(card: ConfirmedCommunicationCard): void | Promise<void>;
  onFinish(card: ConfirmedCommunicationCard): void | Promise<void>;
};

const sectionCatalog = [...loadCatalog().journey.uiCopy.communicationSections]
  .sort((left, right) => left.order - right.order);

const VISIBILITY_LABELS: Record<SharingVisibility, string> = {
  pending: "待确认",
  included: "已加入分享",
  private: "仅自己可见",
  deleted: "已删除"
};

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
      <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: paperTheme.color.text }}>我的沟通卡</Text>
      {card.sections.length === 0 ? (
        <Text style={{ ...theme.typography.body, color: paperTheme.color.secondary }}>还没有加入可分享的段落。</Text>
      ) : card.sections.map(({ id, text }) => (
        <Text key={id} selectable style={{ ...theme.typography.body, color: paperTheme.color.text }}>{text}</Text>
      ))}
      <Text selectable style={{ ...theme.typography.caption, color: paperTheme.color.secondary }}>{card.consentFooter}</Text>
    </View>
  );
}

export function FinalPreparationPage({ draft, onCopy, onEdit, onFinish, onSaveImage, onSetVisibility }: Props) {
  const draftRef = useRef(cloneDraft(draft));
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWriteErrorRef = useRef<unknown>(undefined);
  const [, renderVersion] = useState(0);
  const [editingId, setEditingId] = useState<CommunicationSectionId>();
  const [editingText, setEditingText] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [handwritingVisible, setHandwritingVisible] = useState(false);
  const [status, setStatus] = useState<string>();

  const updateLocal = (update: (current: JourneyDraft) => JourneyDraft) => {
    draftRef.current = update(draftRef.current);
    renderVersion((version) => version + 1);
  };
  const enqueue = (operation: () => void | Promise<void>) => {
    const next = queueRef.current.then(operation).catch((error: unknown) => {
      pendingWriteErrorRef.current = error;
    });
    queueRef.current = next;
    return next;
  };
  const setVisibility = (sectionId: CommunicationSectionId, visibility: SharingVisibility) => {
    pendingWriteErrorRef.current = undefined;
    updateLocal((current) => ({
      ...current,
      communicationCard: {
        ...current.communicationCard,
        [sectionId]: { ...current.communicationCard[sectionId], visibility }
      }
    }));
    void enqueue(() => onSetVisibility(sectionId, visibility));
  };
  const saveEdit = () => {
    if (editingId === undefined || editingText.trim().length === 0) return;
    const sectionId = editingId;
    const userText = editingText.trim();
    pendingWriteErrorRef.current = undefined;
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
    operation: (card: ConfirmedCommunicationCard) => void | Promise<void>,
    success: string,
    failure: string
  ) => {
    setStatus("正在处理…");
    try {
      await queueRef.current;
      if (pendingWriteErrorRef.current !== undefined) {
        setStatus("保存更改失败，请重试。");
        return;
      }
      await operation(selectConfirmedCommunicationCard(draftRef.current));
      setStatus(success);
    } catch {
      setStatus(failure);
    }
  };

  const confirmed = selectConfirmedCommunicationCard(draftRef.current);
  return (
    <View style={{ gap: theme.space.lg, maxWidth: "100%", width: "100%" }} testID="page-7-content">
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>最终整理</Text>
        <Text accessibilityLabel="第 7 屏，共 7 屏" style={{ ...theme.typography.caption, color: theme.color.textMuted }}>7 / 7</Text>
      </View>
      <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>先留给自己，再决定分享什么</Text>

      <Card accessible={false} variant="muted">
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>我的私密准备</Text>
        <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>这部分只用于本机准备，不会自动进入沟通卡。</Text>
        {draftRef.current.privatePreparation.items.length === 0 ? (
          <Text style={{ ...theme.typography.body, color: theme.color.textSecondary }}>目前没有必须完成的准备项，你仍然可以继续。</Text>
        ) : draftRef.current.privatePreparation.items.map((item) => (
          <View key={item.id} style={{ borderColor: theme.color.border, borderRadius: theme.radius.control, borderWidth: theme.border.width, gap: theme.space.xs, padding: theme.space.md }}>
            <Text style={{ ...theme.typography.body, color: theme.color.text }}>{item.id}</Text>
            <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{item.status}</Text>
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
                  <Button label="保存编辑" onPress={saveEdit} />
                </>
              ) : (
                <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{field.visibility === "deleted" ? "这段已删除" : text}</Text>
              )}
              <Button accessibilityLabel={`加入分享：${section.title}`} label="加入分享" onPress={() => setVisibility(sectionId, "included")} />
              <SecondaryButton label={`编辑：${section.title}`} onPress={() => { setEditingId(sectionId); setEditingText(text); }} />
              <SecondaryButton label={`保持私密：${section.title}`} onPress={() => setVisibility(sectionId, "private")} />
              <TextAction label={`删除：${section.title}`} onPress={() => setVisibility(sectionId, "deleted")} />
            </Card>
          );
        })}
      </View>

      <Button label="预览分享卡" onPress={() => setPreviewVisible(true)} />
      {previewVisible ? <SharePreview card={confirmed} /> : null}
      <Button label="复制已确认内容" onPress={() => { void afterFlush(onCopy, "已复制。", "复制失败，请重试或手写记录。"); }} />
      <SecondaryButton label="保存为图片" onPress={() => { setPreviewVisible(true); void afterFlush(onSaveImage, "图片已保存。", "图片保存失败，请检查权限后重试。"); }} />
      <TextAction label="我想手写" onPress={() => setHandwritingVisible(true)} />
      {handwritingVisible ? <Text style={{ ...theme.typography.body, color: theme.color.text }}>可以把确认后的内容抄写到纸上；CAVE 不会自动分享。</Text> : null}
      {status ? <Text accessibilityLiveRegion="polite" style={{ ...theme.typography.body, color: theme.color.text }}>{status}</Text> : null}
      <Button label="完成首次记录" onPress={() => { void afterFlush(onFinish, "已保存到本机。", "保存失败，请重试。"); }} />
      <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>云端同步｜后续版本（不可用）</Text>
    </View>
  );
}
