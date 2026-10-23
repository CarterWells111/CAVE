import { View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { ErrorState } from "../../../core/ui/ErrorState";
import { IconTextAction } from "../../../core/ui/icon-text-action";
import { ActionRow } from "../../../core/ui/action-row";
import { HelpText, PageHeader } from "../../../core/ui/page-header";
import { AccountProfileCard } from "../../account/ui/AccountProfileCard";
import { GrowthChart } from "../../growth/growth-chart";
import type { GrowthData } from "../../growth/growth-records";
import { ShellLoading, SupportingText } from "./shell-ui-components";

export type ProfileScreenProps = Readonly<{
  account?: {
    status: "signedOut" | "loading" | "ready" | "error";
    email?: string;
    profile?: { displayName: string; avatarUri?: string };
    onSignIn?(): void;
    onRetry?(): void;
  };
  growth: GrowthData;
  growthState: "loading" | "ready" | "error" | "locked";
  onOpenGrowth(): void;
  onRetryGrowth(): void;
  onOpenSettings(): void;
}>;

export function ProfileScreen({ account, growth, growthState, onOpenGrowth, onRetryGrowth, onOpenSettings }: ProfileScreenProps) {
  const theme = useTheme();
  return <View style={{ flexGrow: 1, gap: theme.space.xl, minWidth: 0, width: "100%" }}>
    <PageHeader title="我的" actions={<IconTextAction icon="settings-outline" iconOnly label="设置" onPress={onOpenSettings} />}
      help={<>
        <HelpText>成长记录显示手记、阶段回顾、学习旅程和 AI 交流随时间的变化，可选择 1 周、一个月、半年或所有记录。</HelpText>
        <HelpText>每个时间段内统计当前保留的记录次数，不是成长评分。点击“查看时间明细”可以查看各时间段的具体次数。</HelpText>
        <HelpText>关键事件与阶段回顾中可以选择时间范围，查看汇总与最近记录，再邀请 AI 一起整理成长与接下来的方向。</HelpText>
        {growth.notes.map(note => <HelpText key={note}>{note}</HelpText>)}
      </>} />
    {account ? <AccountProfileCard
      {...(account.profile?.avatarUri === undefined ? {} : { avatarUri: account.profile.avatarUri })}
      {...(account.profile?.displayName === undefined ? {} : { displayName: account.profile.displayName })}
      {...(account.email === undefined ? {} : { email: account.email })}
      {...(account.onSignIn === undefined ? {} : { onSignIn: account.onSignIn })}
      {...(account.onRetry === undefined ? {} : { onRetry: account.onRetry })}
      readOnly status={account.status}
    /> : null}
    <View style={{ gap: theme.space.md }}>
      {growthState === "loading" ? <ShellLoading /> : null}
      {growthState === "error" ? <ErrorState title="成长记录暂时无法读取" message="请稍后重试，原来的记录仍然保留。"
        actionLabel="重试读取成长记录" onAction={onRetryGrowth} /> : null}
      {growthState === "locked" ? <SupportingText>登录后，在这里查看我的成长记录。</SupportingText> : null}
      {growthState === "ready" ? <GrowthChart data={growth} /> : null}
      <ActionRow title="关键事件与阶段回顾"
        accessibilityLabel="打开关键事件与阶段回顾" onPress={onOpenGrowth} />
    </View>
  </View>;
}
