import { useState } from "react";
import { View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
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
} from "./shell-ui-components";
import { ReplaceReviewConfirmation } from "./ReplaceReviewConfirmation";

type Props = {
  loadState?: ShellLoadState;
  activeJourney?: ActiveJourneyMetadataItem | null;
  topics: Array<{ id: string; label: string }>;
  onContinueJourney?: (id: string) => void;
  onRetry?: () => void;
  onStartFullReview: () => void;
  onStartTopic: (id: string) => void;
};

export function ReviewsHubScreen({
  activeJourney,
  loadState = "ready",
  onContinueJourney,
  onRetry,
  onStartFullReview,
  onStartTopic,
  topics,
}: Props) {
  const theme = useTheme();
  const [confirmingReplacement, setConfirmingReplacement] = useState(false);
  const requestFullReview = () => {
    if (activeJourney?.kind === "review") setConfirmingReplacement(true);
    else onStartFullReview();
  };
  return (
    <ShellFrame title="回顾">
      {loadState === "loading" ? <ShellLoading /> : null}
      {loadState === "error" ? (
        <ErrorState
          actionLabel="重试"
          message="暂时无法读取本机回顾状态。"
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
                onStartFullReview();
              }}
            />
          ) : null}
          <Card accessible={false} variant="accent">
            <SectionHeading>选择回顾方式</SectionHeading>
            <SupportingText>
              {activeJourney?.kind === "initial"
                ? "首次旅程完成前，可以继续原旅程或直接从一个主题开始。"
                : "可以直接从一个主题开始，也可以由你主动启动完整六页回顾。"}
            </SupportingText>
            {activeJourney?.kind !== "initial" ? (
              <Button label="开始完整六页回顾" onPress={requestFullReview} />
            ) : null}
          </Card>
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>按主题进入</SectionHeading>
            {topics.map((topic) => (
              <SecondaryButton key={topic.id} label={`按主题回顾：${topic.label}`} onPress={() => onStartTopic(topic.id)} />
            ))}
            {topics.length === 0 ? <SupportingText>当前没有可用主题，仍可启动完整回顾。</SupportingText> : null}
          </View>
        </>
      ) : null}
    </ShellFrame>
  );
}
