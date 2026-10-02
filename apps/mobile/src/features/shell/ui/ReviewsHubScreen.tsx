import { useRouter } from "expo-router";
import { View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { ActionRow } from "../../../core/ui/action-row";
import { HelpText } from "../../../core/ui/page-header";
import { Card } from "../../../core/ui/Card";
import { ErrorState } from "../../../core/ui/ErrorState";
import { TextAction } from "../../../core/ui/text-action";
import {
  MetadataCard,
  SectionHeading,
  ShellFrame,
  ShellLoading,
  SupportingText,
  type ActiveJourneyMetadataItem,
  type ShellLoadState,
} from "./shell-ui-components";

type Props = {
  loadState?: ShellLoadState;
  activeJourney?: ActiveJourneyMetadataItem | null;
  topics: Array<{ id: string; label: string }>;
  onContinueJourney?: (id: string) => void;
  onRetry?: () => void;
  onSelectJourney: () => void;
  onStartTopic: (id: string) => void;
};

export function ReviewsHubScreen({
  activeJourney,
  loadState = "ready",
  onContinueJourney,
  onRetry,
  onSelectJourney,
  onStartTopic,
  topics,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <ShellFrame title="回顾" help={<>
      <HelpText>阶段回顾把一段时间里的感受放在一起，看看发生了什么变化。</HelpText>
      <HelpText>旅程与主题回顾可以从主题开始，也可以到旅程页选择一段旅程。选择入口不会替换当前草稿；开始新回顾前会与你确认。</HelpText>
    </>}>
      <Card accessible={false} variant="accent">
        <SectionHeading>手记阶段回顾</SectionHeading>
        <Button label="开始阶段回顾" onPress={() => router.push("/journal/review")} />
        <TextAction label="查看手记与回顾历史" onPress={() => router.push("/(tabs)/journal")} />
      </Card>
      <SectionHeading>旅程与主题回顾</SectionHeading>
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
          <ActionRow title="选择旅程" onPress={onSelectJourney} />
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>按主题进入</SectionHeading>
            {topics.map((topic) => (
              <ActionRow key={topic.id} title={topic.label} accessibilityLabel={`按主题回顾：${topic.label}`} onPress={() => onStartTopic(topic.id)} />
            ))}
            {topics.length === 0 ? <SupportingText>当前没有可用主题，可以先选择一段旅程。</SupportingText> : null}
          </View>
        </>
      ) : null}
    </ShellFrame>
  );
}
