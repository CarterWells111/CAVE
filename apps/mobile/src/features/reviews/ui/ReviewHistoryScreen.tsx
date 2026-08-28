import { ScrollView, Text, View } from "react-native";

import { theme } from "../../../core/design/theme";
import { Card } from "../../../core/ui/Card";
import { EmptyState } from "../../../core/ui/EmptyState";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";

export type ReviewHistoryItem = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  statusLabel: string;
}>;

export type ReviewHistoryScreenProps = {
  loadState: "loading" | "ready" | "error";
  reviews: readonly ReviewHistoryItem[];
  onOpenReview(id: string): void;
  onRetry?: () => void;
};

export function ReviewHistoryScreen(_props: ReviewHistoryScreenProps) {
  const { loadState, onOpenReview, onRetry, reviews } = _props;
  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: "center",
        gap: theme.space.xl,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.xl
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      testID="review-history-scroll"
    >
      <View style={{ gap: theme.space.xl, maxWidth: theme.size.readableContentMax, minWidth: 0, width: "100%" }}>
        <View style={{ gap: theme.space.sm }}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
            回顾历史
          </Text>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
            列表只显示标题、日期和状态。打开一条记录后再查看完整内容。
          </Text>
        </View>

        {loadState === "loading" ? <StatusBanner message="正在读取本机回顾历史…" variant="info" /> : null}
        {loadState === "error" ? (
          <StatusBanner
            {...(onRetry ? { actionLabel: "重试读取", onAction: onRetry } : {})}
            message="暂时无法读取本机回顾历史。你的记录没有因此被删除。"
            variant="error"
          />
        ) : null}
        {loadState === "ready" && reviews.length === 0 ? (
          <EmptyState message="完成并保存回顾后，会在这里看到标题、日期和状态。" title="还没有历史回顾" />
        ) : null}
        {loadState === "ready" && reviews.length > 0 ? (
          <View style={{ gap: theme.space.md, width: "100%" }}>
            {reviews.map((review) => (
              <Card accessible={false} key={review.id}>
                <Text accessibilityRole="header" selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>
                  {review.title}
                </Text>
                <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
                  {`${review.dateLabel} · ${review.statusLabel}`}
                </Text>
                <SecondaryButton label={`打开回顾：${review.title}`} onPress={() => onOpenReview(review.id)} />
              </Card>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
