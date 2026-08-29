import { Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { EmptyState } from "../../../core/ui/EmptyState";
import { ErrorState } from "../../../core/ui/ErrorState";
import { IconTextAction } from "../../../core/ui/icon-text-action";
import { AccountProfileCard } from "../../account/ui/AccountProfileCard";
import {
  MetadataCard,
  SectionHeading,
  ShellLoading,
  type ShellLoadState,
  type ShellMetadataItem,
} from "./shell-ui-components";

export type ProfileScreenProps = Readonly<{
  account?: {
    status: "signedOut" | "loading" | "ready" | "error";
    email?: string;
    profile?: { displayName: string; avatarUri?: string };
    onSignIn?(): void;
    onRetry?(): void;
  };
  cards: ReadonlyArray<ShellMetadataItem>;
  cardsLoadState?: ShellLoadState;
  onOpenCard?: (id: string) => void;
  onOpenReview?: (id: string) => void;
  onOpenSettings: () => void;
  onOpenJournal?: () => void;
  onRetryCards?: () => void;
  onRetryReviews?: () => void;
  reviews: ReadonlyArray<ShellMetadataItem>;
  reviewsLoadState?: ShellLoadState;
}>;

export function ProfileScreen({
  account,
  cards,
  cardsLoadState = "ready",
  onOpenCard,
  onOpenReview,
  onOpenSettings,
  onOpenJournal,
  onRetryCards,
  onRetryReviews,
  reviews,
  reviewsLoadState = "ready",
}: ProfileScreenProps) {
  const theme = useTheme();
  return (
    <View style={{ flexGrow: 1, gap: theme.space.xl, minWidth: 0, width: "100%" }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
          我的
        </Text>
        <IconTextAction icon="settings-outline" label="设置" onPress={onOpenSettings} />
      </View>

      {account ? (
        <AccountProfileCard
          {...(account.profile?.avatarUri === undefined ? {} : { avatarUri: account.profile.avatarUri })}
          {...(account.profile?.displayName === undefined ? {} : { displayName: account.profile.displayName })}
          {...(account.email === undefined ? {} : { email: account.email })}
          {...(account.onSignIn === undefined ? {} : { onSignIn: account.onSignIn })}
          {...(account.onRetry === undefined ? {} : { onRetry: account.onRetry })}
          readOnly
          status={account.status}
        />
      ) : null}

      {onOpenJournal ? (
        <View style={{ gap: theme.space.md }}>
          <SectionHeading>内界手记</SectionHeading>
          <IconTextAction icon="book-outline" label="打开关键事件与阶段回顾" onPress={onOpenJournal} />
        </View>
      ) : null}

      <View style={{ gap: theme.space.md }}>
        <SectionHeading>我的卡片</SectionHeading>
        {cardsLoadState === "loading" ? <ShellLoading /> : null}
        {cardsLoadState === "error" ? (
          <ErrorState
            actionLabel="重试读取卡片"
            message="暂时无法读取本机沟通卡。"
            title="卡片读取失败"
            {...(onRetryCards ? { onAction: onRetryCards } : {})}
          />
        ) : null}
        {cardsLoadState === "ready" ? (
          cards.length > 0 ? cards.map((card) => (
            <MetadataCard
              actionLabel={`打开${card.title}，${card.dateLabel}，${card.statusLabel}`}
              item={card}
              key={card.id}
              onAction={onOpenCard}
            />
          )) : <EmptyState message="完成并保存沟通卡后，会按日期显示在这里。" title="还没有沟通卡" />
        ) : null}
      </View>

      <View style={{ gap: theme.space.md }}>
        <SectionHeading>我的回顾</SectionHeading>
        {reviewsLoadState === "loading" ? <ShellLoading /> : null}
        {reviewsLoadState === "error" ? (
          <ErrorState
            actionLabel="重试读取回顾"
            message="暂时无法读取本机历史回顾。"
            title="回顾读取失败"
            {...(onRetryReviews ? { onAction: onRetryReviews } : {})}
          />
        ) : null}
        {reviewsLoadState === "ready" ? (
          reviews.length > 0 ? reviews.map((review) => (
            <MetadataCard
              actionLabel={`打开${review.title}，${review.dateLabel}，${review.statusLabel}`}
              item={review}
              key={review.id}
              onAction={onOpenReview}
            />
          )) : <EmptyState message="完成回顾后，会按日期显示在这里。" title="还没有历史回顾" />
        ) : null}
      </View>
    </View>
  );
}
