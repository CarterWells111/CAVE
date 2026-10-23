import { useState } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../core/design/theme-provider";
import { Button } from "../../core/ui/Button";
import { EmptyState } from "../../core/ui/EmptyState";
import { ErrorState } from "../../core/ui/ErrorState";
import { HelpText, PageHeader } from "../../core/ui/page-header";
import { ActionRow } from "../../core/ui/action-row";
import { SelectionField } from "../../core/ui/selection-field";
import { ShellLoading } from "../shell/ui/shell-ui-components";
import { GROWTH_METRICS, GROWTH_RANGES } from "./growth-chart";
import { buildGrowthSeries, type GrowthData, type GrowthRange } from "./growth-records";

const RANGE_TITLES: Record<GrowthRange, string> = {
  week: "最近一周", month: "最近一个月", halfYear: "最近半年", all: "所有记录",
};

export function GrowthReviewScreen({ data, state, onBack, onRetry, onAiReview, onSignIn, onOpenEvent, now = new Date() }: {
  data: GrowthData;
  state: "loading" | "ready" | "error" | "locked";
  onBack(): void;
  onRetry(): void;
  onAiReview(range: GrowthRange): void;
  onSignIn(): void;
  onOpenEvent(href: string): void;
  now?: Date;
}) {
  const theme = useTheme();
  const [range, setRange] = useState<GrowthRange>("week");
  const series = buildGrowthSeries(data, range, now);
  const events = data.events.filter(event => {
    const time = Date.parse(event.at);
    return time >= series.start.getTime() && time < series.end.getTime() && time <= now.getTime();
  }).sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, 12);
  const date = (value: Date) => `${value.getFullYear()}年${value.getMonth() + 1}月${value.getDate()}日`;
  const lastDay = new Date(series.end.getTime() - 1);
  return <View style={{ gap: theme.space.lg }}>
    <PageHeader title="关键事件与阶段回顾" onBack={onBack} help={<>
      <HelpText>选择 1 周、一个月、半年或所有记录，汇总与事件列表会一起切换。事件列表显示所选范围内最近的 12 条留存记录。</HelpText>
      <HelpText>统计当前仍保留的记录。次数只代表参与，不代表成长的好坏。</HelpText>
      <HelpText>AI 回顾会先把当前所选时间范围的问题放入输入框，你可以修改范围或补充想关注的变化，再发送。允许读取后才会使用相关资料。</HelpText>
      {data.notes.map(note => <HelpText key={note}>{note}</HelpText>)}
    </>} />
    {state === "locked" ? <>
      <EmptyState title="从你的记录开始" message="登录后，可以查看成长汇总，并邀请 AI 帮你回顾成长。" />
      <Button label="邮箱登录" onPress={onSignIn} />
    </> : state === "loading" ? <ShellLoading /> : state === "error" ? <ErrorState title="暂时无法读取成长记录"
      message="请稍后重试。" actionLabel="重试读取成长记录" onAction={onRetry} /> : <>
      <SelectionField label="回顾区间" value={range} options={GROWTH_RANGES.map(item => ({ value: item.key, label: item.label }))} onChange={setRange} />
      <View style={{ gap: theme.space.xs }}>
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>{RANGE_TITLES[range]}，你走过的路</Text>
        <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{date(series.start) + " — " + date(lastDay)}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm }}>
        {GROWTH_METRICS.map(metric => <View key={metric.key} style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: theme.color.surface,
          borderRadius: theme.radius.md, padding: theme.space.md, gap: theme.space.xs }}>
          <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{metric.label}</Text>
          <Text testID={"growth-total-" + metric.key} selectable style={{ ...theme.typography.title, color: theme.color.text, fontVariant: ["tabular-nums"] }}>
            {series.totals[metric.key]}<Text style={theme.typography.caption}> {metric.unit}</Text>
          </Text>
        </View>)}
      </View>
      <Button label="AI回顾我的成长" onPress={() => onAiReview(range)} />
      <View style={{ gap: theme.space.sm }}>
        <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>{RANGE_TITLES[range]}留下的记录</Text>
        {events.length ? events.map(event => {
          const title = event.title ?? GROWTH_METRICS.find(metric => metric.key === event.metric)!.label;
          const subtitle = date(new Date(event.at)) + " · " + GROWTH_METRICS.find(metric => metric.key === event.metric)!.label;
          return event.href ? <ActionRow key={event.metric + ":" + event.id} title={title} subtitle={subtitle}
            onPress={() => { if (event.href) onOpenEvent(event.href); }} /> : <View key={event.metric + ":" + event.id}
              style={{ padding: theme.space.md, gap: theme.space.xs, backgroundColor: theme.color.surface, borderRadius: theme.radius.md }}>
              <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>{title}</Text>
              <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{subtitle}</Text>
            </View>;
        })
          : <EmptyState title="这段时间，留一点空白也可以" message="这段时间还没有留存的手记、回顾、旅程或 AI 交流。" />}
      </View>
    </>}
  </View>;
}
