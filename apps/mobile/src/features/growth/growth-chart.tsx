import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../../core/design/theme-provider";
import { BottomSheet } from "../../core/ui/bottom-sheet";
import { buildGrowthSeries, type GrowthData, type GrowthMetric, type GrowthRange } from "./growth-records";

export const GROWTH_METRICS: ReadonlyArray<{ key: GrowthMetric; label: string; unit: string }> = [
  { key: "journal", label: "记录手记", unit: "篇" },
  { key: "review", label: "阶段回顾", unit: "次" },
  { key: "journey", label: "学习旅程", unit: "次" },
  { key: "ai", label: "使用 AI", unit: "次" },
];
export const GROWTH_RANGES: ReadonlyArray<{ key: GrowthRange; label: string }> = [
  { key: "week", label: "1周" }, { key: "month", label: "一个月" },
  { key: "halfYear", label: "半年" }, { key: "all", label: "所有" },
];

export function GrowthChart({ data, now }: { data: GrowthData; now?: Date }) {
  const theme = useTheme();
  const [range, setRange] = useState<GrowthRange>("week");
  const [choosing, setChoosing] = useState(false);
  const [details, setDetails] = useState(false);
  const detailsTrigger = useRef<View>(null);
  const [width, setWidth] = useState(300);
  const series = useMemo(() => buildGrowthSeries(data, range, now ?? new Date()), [data, range, now]);
  const colors: Record<GrowthMetric, string> = theme.name === "dark" ? {
    journal: "#65ADFF", review: "#FFB45B", journey: "#53D6AB", ai: "#BB9AFF",
  } : {
    journal: "#1B69B2", review: "#B45A00", journey: "#087D59", ai: "#814AB7",
  };
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...series.buckets.flatMap(bucket =>
    GROWTH_METRICS.map(metric => bucket.counts[metric.key]))) / 4) * 4);
  const left = 28, right = 10, top = 14, plotHeight = 142;
  const plotWidth = Math.max(1, width - left - right);
  const x = (index: number) => left + plotWidth * index / Math.max(1, series.buckets.length - 1);
  const y = (value: number) => top + plotHeight * (1 - value / maximum);
  const empty = GROWTH_METRICS.every(metric => series.totals[metric.key] === 0);
  const rangeLabel = GROWTH_RANGES.find(item => item.key === range)!.label;
  return <View style={{ backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, padding: theme.space.md, gap: theme.space.md }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.space.sm }}>
      <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text, flexShrink: 1 }}>我的成长记录</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={"选择成长记录显示区间，当前" + rangeLabel}
        accessibilityState={{ expanded: choosing }} onPress={() => setChoosing(value => !value)}
        style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4,
          paddingHorizontal: 10, borderRadius: theme.radius.pill, backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surfaceAccent })}>
        <Text style={{ ...theme.typography.caption, color: theme.color.text }}>{rangeLabel}</Text>
        <Ionicons name={choosing ? "chevron-up" : "chevron-down"} color={theme.color.textSecondary} size={15} />
      </Pressable>
    </View>
    {choosing ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.xs }}>
      {GROWTH_RANGES.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={"显示" + item.label + "的成长记录"}
        accessibilityState={{ selected: range === item.key }} onPress={() => { setRange(item.key); setChoosing(false); }}
        style={({ pressed }) => ({ minHeight: 44, flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 12,
          borderRadius: theme.radius.sm, backgroundColor: range === item.key ? theme.color.primary : pressed ? theme.color.surfacePressed : theme.color.surfaceAccent })}>
        <Text style={{ ...theme.typography.caption, color: range === item.key ? theme.color.onPrimary : theme.color.text }}>{item.label}</Text>
      </Pressable>)}
    </View> : null}
    <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>把走过的每一步，慢慢连成线。</Text>
    <View accessible accessibilityRole="image"
      accessibilityLabel={rangeLabel + "活动折线图，" + GROWTH_METRICS.map(metric => metric.label + series.totals[metric.key] + metric.unit).join("，")}
      onLayout={event => setWidth(Math.max(100, event.nativeEvent.layout.width))}
      style={{ height: 188, width: "100%", overflow: "hidden" }}>
      {[0, maximum / 2, maximum].map(value => <View key={value} accessible={false}>
        <Text style={{ position: "absolute", left: 0, top: y(value) - 8, fontSize: 10, color: theme.color.textTertiary, fontVariant: ["tabular-nums"] }}>{value}</Text>
        <View style={{ position: "absolute", left, right, top: y(value), height: 1, backgroundColor: theme.color.borderSoft }} />
      </View>)}
      {GROWTH_METRICS.map(metric => <View key={metric.key} accessible={false}>
        {series.buckets.slice(1).map((bucket, index) => {
          const x1 = x(index), x2 = x(index + 1), y1 = y(series.buckets[index]!.counts[metric.key]), y2 = y(bucket.counts[metric.key]);
          const length = Math.hypot(x2 - x1, y2 - y1);
          return <View key={bucket.key} style={{ position: "absolute", left: (x1 + x2) / 2 - length / 2,
            top: (y1 + y2) / 2 - 1, height: 2, width: length, borderRadius: 1, backgroundColor: colors[metric.key],
            transform: [{ rotate: Math.atan2(y2 - y1, x2 - x1) + "rad" }] }} />;
        })}
        {series.buckets.map((bucket, index) => bucket.counts[metric.key] > 0 ? <View key={bucket.key}
          style={{ position: "absolute", left: x(index) - 3, top: y(bucket.counts[metric.key]) - 3,
            width: 6, height: 6, borderRadius: 3, backgroundColor: colors[metric.key] }} /> : null)}
      </View>)}
      {[...new Set([0, Math.floor((series.buckets.length - 1) / 2), series.buckets.length - 1])].map(index =>
        series.buckets[index] ? <Text key={index} style={{ position: "absolute", top: top + plotHeight + 12,
          left: Math.min(width - 48, Math.max(left, x(index) - 18)), fontSize: 10, color: theme.color.textTertiary }}>
          {series.buckets[index]!.label}
        </Text> : null)}
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.md }}>
      {GROWTH_METRICS.map(metric => <View key={metric.key} style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: "42%" }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[metric.key] }} />
        <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{metric.label}</Text>
        <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text, fontVariant: ["tabular-nums"] }}>{series.totals[metric.key]}</Text>
      </View>)}
    </View>
    <Pressable ref={detailsTrigger} accessibilityRole="button" accessibilityLabel="查看按时间的活动明细"
      accessibilityState={{ expanded: details }} onPress={() => setDetails(true)}
      style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={{ ...theme.typography.caption, color: theme.color.primary }}>查看时间明细</Text>
    </Pressable>
    <BottomSheet title="成长记录时间明细" visible={details} onClose={() => setDetails(false)} returnFocusRef={detailsTrigger}>
      <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{rangeLabel}</Text>
      {series.buckets.map(bucket => {
        const last = new Date(bucket.end.getTime() - 1);
        const date = (value: Date) => `${value.getFullYear()}年${value.getMonth() + 1}月${value.getDate()}日`;
        const firstDate = date(bucket.start), lastDate = date(last);
        return <View key={bucket.key} style={{ gap: theme.space.xs }}>
          <Text accessibilityRole="header" style={{ ...theme.typography.cardTitle, color: theme.color.text }}>
            {firstDate === lastDate ? firstDate : firstDate + " — " + lastDate}
          </Text>
          <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
            {GROWTH_METRICS.map(metric => metric.label + bucket.counts[metric.key] + metric.unit).join("，")}
          </Text>
        </View>;
      })}
    </BottomSheet>
    {empty ? <Text style={{ ...theme.typography.caption, color: theme.color.textTertiary }}>这段时间还没有可显示的活动，按自己的节奏慢慢开始。</Text> : null}
  </View>;
}
