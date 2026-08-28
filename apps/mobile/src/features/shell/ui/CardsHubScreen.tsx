import { View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { EmptyState } from "../../../core/ui/EmptyState";
import { ErrorState } from "../../../core/ui/ErrorState";
import {
  MetadataCard,
  SectionHeading,
  ShellFrame,
  ShellLoading,
  SupportingText,
  type ShellLoadState,
  type ShellMetadataItem,
} from "./shell-ui-components";

type Props = {
  loadState?: ShellLoadState;
  currentCard?: ShellMetadataItem | null;
  history: ShellMetadataItem[];
  onEdit?: (id: string) => void;
  onOpenHistory?: (id: string) => void;
  onRetry?: () => void;
};

export function CardsHubScreen({
  currentCard,
  history,
  loadState = "ready",
  onEdit,
  onOpenHistory,
  onRetry,
}: Props) {
  const theme = useTheme();
  return (
    <ShellFrame title="沟通草稿箱">
      {loadState === "loading" ? <ShellLoading /> : null}
      {loadState === "error" ? (
        <ErrorState
          actionLabel="重试"
          message="暂时无法读取本机沟通草稿。"
          title="读取失败"
          {...(onRetry ? { onAction: onRetry } : {})}
        />
      ) : null}
      {loadState === "ready" ? (
        <>
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>当前沟通草稿</SectionHeading>
            {currentCard ? (
              <Card accessible={false} variant="accent">
                <SectionHeading>{currentCard.title}</SectionHeading>
                <SupportingText>{`${currentCard.dateLabel} · ${currentCard.statusLabel}`}</SupportingText>
                <Button disabled={!onEdit} label="编辑当前沟通草稿" onPress={() => onEdit?.(currentCard.id)} />
              </Card>
            ) : <EmptyState message="完成并保存沟通草稿后，可以在这里回顾或继续编辑。" title="还没有沟通草稿" />}
          </View>
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>历史版本</SectionHeading>
            {history.length > 0 ? history.map((card) => (
              <MetadataCard actionLabel={`打开${card.title}`} item={card} key={card.id} onAction={onOpenHistory} />
            )) : <EmptyState message="历史列表只显示标题、日期和状态。" title="还没有历史版本" />}
          </View>
        </>
      ) : null}
    </ShellFrame>
  );
}
