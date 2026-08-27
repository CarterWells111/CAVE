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

type Props = {
  loadState?: ShellLoadState;
  currentCard?: ShellMetadataItem | null;
  history: ShellMetadataItem[];
  onCopy?: (id: string) => void;
  onEdit?: (id: string) => void;
  onFullscreen?: (id: string) => void;
  onOpenHistory?: (id: string) => void;
  onRetry?: () => void;
};

export function CardsHubScreen({
  currentCard,
  history,
  loadState = "ready",
  onCopy,
  onEdit,
  onFullscreen,
  onOpenHistory,
  onRetry,
}: Props) {
  return (
    <ShellFrame title="卡片">
      {loadState === "loading" ? <ShellLoading /> : null}
      {loadState === "error" ? (
        <ErrorState
          actionLabel="重试"
          message="暂时无法读取本机沟通卡。"
          title="读取失败"
          {...(onRetry ? { onAction: onRetry } : {})}
        />
      ) : null}
      {loadState === "ready" ? (
        <>
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>当前沟通卡</SectionHeading>
            {currentCard ? (
              <Card accessible={false} variant="accent">
                <SectionHeading>{currentCard.title}</SectionHeading>
                <SupportingText>{`${currentCard.dateLabel} · ${currentCard.statusLabel}`}</SupportingText>
                <Button disabled={!onEdit} label="编辑当前沟通卡" onPress={() => onEdit?.(currentCard.id)} />
                <SecondaryButton disabled={!onCopy} label="复制当前沟通卡" onPress={() => onCopy?.(currentCard.id)} />
                <SecondaryButton disabled={!onFullscreen} label="全屏展示当前沟通卡" onPress={() => onFullscreen?.(currentCard.id)} />
              </Card>
            ) : <EmptyState message="完成并保存沟通卡后，可在这里编辑、复制或全屏展示。" title="还没有沟通卡" />}
          </View>
          <View style={{ gap: theme.space.md }}>
            <SectionHeading>历史版本</SectionHeading>
            {history.length > 0 ? history.map((card) => (
              <MetadataCard actionLabel={`打开${card.title}`} item={card} key={card.id} onAction={onOpenHistory} />
            )) : <EmptyState message="历史列表只显示标题、日期和状态。" title="还没有历史版本" />}
          </View>
          <Card accessible={false} variant="muted">
            <SectionHeading>云端保存</SectionHeading>
            <SupportingText>后续版本；当前只使用本机保存。</SupportingText>
            <SecondaryButton disabled label="保存到云端｜后续版本" onPress={() => undefined} />
          </Card>
        </>
      ) : null}
    </ShellFrame>
  );
}
