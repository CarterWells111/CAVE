import { useState } from "react";
import { View } from "react-native";

import { theme } from "../../../core/design/theme";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { EmptyState } from "../../../core/ui/EmptyState";
import { ErrorState } from "../../../core/ui/ErrorState";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import {
  MetadataCard,
  SectionHeading,
  ShellFrame,
  ShellLoading,
  SupportingText,
  type ShellLoadState,
  type ShellMetadataItem,
} from "./shell-ui-components";
import { ReplaceReviewConfirmation } from "./ReplaceReviewConfirmation";

type Props = {
  loadState?: ShellLoadState;
  activeReview?: ShellMetadataItem | null;
  currentCard?: ShellMetadataItem | null;
  recentRecords: ShellMetadataItem[];
  onRetry?: () => void;
  onContinueReview?: (id: string) => void;
  onOpenCurrentCard?: (id: string) => void;
  onOpenRecord?: (id: string) => void;
  onOpenSettings?: () => void;
  onStartPractice: () => void;
  onStartReview: () => void;
};

export function HomeScreen({
  activeReview,
  currentCard,
  loadState = "ready",
  onContinueReview,
  onOpenCurrentCard,
  onOpenRecord,
  onOpenSettings,
  onRetry,
  onStartPractice,
  onStartReview,
  recentRecords,
}: Props) {
  const [confirmingReplacement, setConfirmingReplacement] = useState(false);
  const requestReview = () => {
    if (activeReview) setConfirmingReplacement(true);
    else onStartReview();
  };
  return (
    <ShellFrame title="首页">
      <SecondaryButton disabled={!onOpenSettings} label="打开设置" onPress={() => onOpenSettings?.()} />
      {loadState === "loading" ? <ShellLoading /> : null}
      {loadState === "error" ? (
        <ErrorState
          actionLabel="重试"
          message="暂时无法读取本机首页内容。你的记录没有因此被删除。"
          title="读取失败"
          {...(onRetry ? { onAction: onRetry } : {})}
        />
      ) : null}
      {loadState === "ready" ? (
        <>
          {activeReview ? (
            <MetadataCard actionLabel="继续本次回顾" item={activeReview} onAction={onContinueReview} />
          ) : null}
          {confirmingReplacement ? (
            <ReplaceReviewConfirmation
              onCancel={() => setConfirmingReplacement(false)}
              onConfirm={() => {
                setConfirmingReplacement(false);
                onStartReview();
              }}
            />
          ) : null}
          <Card accessible={false} variant="accent">
            <SectionHeading>现在想做什么？</SectionHeading>
            <SupportingText>可以直接练习，也可以开始一次新的回顾；已有进行中回顾不会封锁其他入口。</SupportingText>
            <View style={{ gap: theme.space.md }}>
              <Button label="开始练习" onPress={onStartPractice} />
              <SecondaryButton label="开始一次回顾" onPress={requestReview} />
            </View>
          </Card>
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>当前沟通卡</SectionHeading>
            {currentCard ? (
              <MetadataCard actionLabel="打开当前沟通卡" item={currentCard} onAction={onOpenCurrentCard} />
            ) : (
              <EmptyState message="完成并保存沟通卡后，会在这里显示中性状态信息。" title="还没有当前沟通卡" />
            )}
          </View>
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>最近记录</SectionHeading>
            {recentRecords.length > 0 ? recentRecords.map((record) => (
              <MetadataCard
                actionLabel={`打开${record.title}`}
                item={record}
                key={record.id}
                onAction={onOpenRecord}
              />
            )) : <EmptyState message="开始回顾后，这里只显示标题、日期和状态。" title="还没有最近记录" />}
          </View>
        </>
      ) : null}
    </ShellFrame>
  );
}
