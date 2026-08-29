import { useState } from "react";
import { View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
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
  type ActiveJourneyMetadataItem,
  type ShellLoadState,
  type ShellMetadataItem,
} from "./shell-ui-components";
import { ReplaceReviewConfirmation } from "./ReplaceReviewConfirmation";

type Props = {
  account?: {
    status: "signedOut" | "loading" | "ready" | "error";
    displayName?: string;
    onOpen(): void;
  };
  loadState?: ShellLoadState;
  activeJourney?: ActiveJourneyMetadataItem | null;
  currentCard?: ShellMetadataItem | null;
  recentRecords: ShellMetadataItem[];
  onRetry?: () => void;
  onContinueJourney?: (id: string) => void;
  onOpenCurrentCard?: (id: string) => void;
  onOpenRecord?: (id: string) => void;
  onOpenJournal?: () => void;
  onStartPractice: () => void;
  onStartReview: () => void;
};

export function HomeScreen({
  account,
  activeJourney,
  currentCard,
  loadState = "ready",
  onContinueJourney,
  onOpenCurrentCard,
  onOpenRecord,
  onOpenJournal,
  onRetry,
  onStartPractice,
  onStartReview,
  recentRecords,
}: Props) {
  const theme = useTheme();
  const [confirmingReplacement, setConfirmingReplacement] = useState(false);
  const requestReview = () => {
    if (activeJourney?.kind === "review") setConfirmingReplacement(true);
    else onStartReview();
  };
  return (
    <ShellFrame title="首页">
      {account?.status === "signedOut" ? (
        <Button label="去登录，享受更多功能" onPress={account.onOpen} />
      ) : null}
      {account?.status === "loading" ? (
        <SecondaryButton disabled label="正在检查账号状态…" onPress={account.onOpen} />
      ) : null}
      {account?.status === "ready" ? (
        <SecondaryButton
          label={`查看${account.displayName ?? "内界用户"}的账号`}
          onPress={account.onOpen}
        />
      ) : null}
      {account?.status === "error" ? (
        <SecondaryButton label="打开账号" onPress={account.onOpen} />
      ) : null}
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
          {activeJourney ? (
            <MetadataCard
              actionLabel={activeJourney.kind === "initial" ? "继续首次旅程" : "继续本次回顾"}
              item={activeJourney}
              onAction={onContinueJourney}
            />
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
            <SupportingText>
              {activeJourney?.kind === "initial"
                ? "可以继续首次旅程，也可以直接使用练习、主题回顾和其他页面。"
                : "可以直接练习，也可以开始一次新的回顾；已有进行中回顾不会封锁其他入口。"}
            </SupportingText>
            <View style={{ gap: theme.space.md }}>
              <Button label="开始练习" onPress={onStartPractice} />
              {activeJourney?.kind !== "initial" ? (
                <SecondaryButton label="开始一次回顾" onPress={requestReview} />
              ) : null}
              <SecondaryButton disabled={!onOpenJournal} label="记下一件事" onPress={() => onOpenJournal?.()} />
            </View>
          </Card>
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>当前沟通草稿</SectionHeading>
            {currentCard ? (
              <MetadataCard actionLabel="打开当前沟通草稿" item={currentCard} onAction={onOpenCurrentCard} />
            ) : (
              <EmptyState message="完成并保存沟通草稿后，可以在这里继续回顾。" title="还没有当前沟通草稿" />
            )}
          </View>
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>最近手记</SectionHeading>
            {recentRecords.length > 0 ? recentRecords.map((record) => (
              <MetadataCard
                actionLabel={`打开${record.title}`}
                item={record}
                key={record.id}
                onAction={onOpenRecord}
              />
            )) : <EmptyState message="记录后，这里只显示标题、日期和重点提要。" title="还没有最近手记" />}
          </View>
        </>
      ) : null}
    </ShellFrame>
  );
}
