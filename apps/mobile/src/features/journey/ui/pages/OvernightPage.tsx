import type { JourneyOption, JourneySource } from "@cave/content";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { AppTheme } from "../../../../core/design/theme";
import { useTheme } from "../../../../core/design/theme-provider";
import { Card } from "../../../../core/ui/Card";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import { InfoCard } from "../../../../core/ui/info-card";
import { SourceDrawer } from "../../../../core/ui/source-drawer";
import { JourneyAction } from "../components/JourneyAction";

type ActionResult = void | Promise<void>;
type Stage = "expectations" | "concerns";
type Panel = "expectations" | "concerns";

export type OvernightPageProps = {
  options: JourneyOption[];
  onContinue: (input: { expectationIds: string[]; concernIds: string[]; customNote: string }) => ActionResult;
  initialExpectationIds?: string[];
  initialConcernIds?: string[];
  initialCustomNote?: string;
  initialStage?: Stage;
  onStageChange?: (stage: Stage) => ActionResult;
  consentSource?: JourneySource;
  onSourceAction?: (source: JourneySource) => ActionResult;
  reducedMotion?: boolean;
};

function updateSelection(current: string[], option: JourneyOption, group: JourneyOption[]): string[] {
  if (option.exclusive) return current.includes(option.id) ? [] : [option.id];
  const withoutExclusive = current.filter((id) => !group.find((item) => item.id === id)?.exclusive);
  return withoutExclusive.includes(option.id)
    ? withoutExclusive.filter((id) => id !== option.id)
    : [...withoutExclusive, option.id];
}

function selectionSummary(count: number): string {
  return count === 0 ? "点击展开" : `已选 ${count} 个 · 点开修改`;
}

function AccordionPanel({
  busy,
  expanded,
  ids,
  onOptionPress,
  onToggle,
  options,
  title,
}: {
  busy: boolean;
  expanded: boolean;
  ids: string[];
  onOptionPress: (option: JourneyOption) => void;
  onToggle: () => void;
  options: JourneyOption[];
  title: string;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const summary = selectionSummary(ids.length);

  return (
    <Card accessible={false} style={styles.accordionCard}>
      <Pressable
        accessibilityLabel={`${title}，${summary}`}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy, expanded }}
        disabled={busy}
        onPress={onToggle}
        style={({ pressed }) => ({
          borderRadius: theme.radius.control,
          minHeight: theme.size.minimumTouchTarget,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View style={styles.accordionHeadingRow}>
          <Text style={styles.heading}>{title}</Text>
          <Text accessibilityElementsHidden style={styles.disclosure}>
            {expanded ? "−" : "+"}
          </Text>
        </View>
        <Text style={styles.secondary}>{busy ? "正在展开…" : summary}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.choices}>
          {options.map((option) => (
            <ChoiceChip
              key={option.id}
              label={option.label}
              onPress={() => onOptionPress(option)}
              selected={ids.includes(option.id)}
              semantics="checkbox"
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function OvernightPage({
  options,
  onContinue,
  initialExpectationIds = [],
  initialConcernIds = [],
  initialCustomNote = "",
  initialStage = "expectations",
  onStageChange,
  consentSource,
  onSourceAction,
  reducedMotion = false,
}: OvernightPageProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const expectations = options.filter((item) => item.group === "expectation").sort((a, b) => a.order - b.order);
  const concerns = options.filter((item) => item.group === "concern").sort((a, b) => a.order - b.order);
  const [stage, setStage] = useState<Stage>(initialStage);
  const [expectationIds, setExpectationIds] = useState([...initialExpectationIds]);
  const [concernIds, setConcernIds] = useState([...initialConcernIds]);
  const [expanded, setExpanded] = useState<Record<Panel, boolean>>({
    expectations: false,
    concerns: false,
  });
  const [stagePending, setStagePending] = useState(false);
  const [stageError, setStageError] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const stageChangeInFlightRef = useRef(false);
  const bothCollapsed = !expanded.expectations && !expanded.concerns;

  const finishOpening = (panel: Panel) => {
    setStage("concerns");
    setExpanded((current) => ({ ...current, [panel]: true }));
    setStagePending(false);
    stageChangeInFlightRef.current = false;
  };

  const togglePanel = (panel: Panel) => {
    if (expanded[panel]) {
      setExpanded((current) => ({ ...current, [panel]: false }));
      return;
    }
    if (stage === "concerns") {
      setExpanded((current) => ({ ...current, [panel]: true }));
      return;
    }
    if (stageChangeInFlightRef.current) return;

    stageChangeInFlightRef.current = true;
    setStageError(false);
    setStagePending(true);
    try {
      const result = onStageChange?.("concerns");
      if (result && typeof result.then === "function") {
        void Promise.resolve(result).then(
          () => finishOpening(panel),
          () => {
            setStageError(true);
            setStagePending(false);
            stageChangeInFlightRef.current = false;
          },
        );
        return;
      }
      finishOpening(panel);
    } catch {
      setStageError(true);
      setStagePending(false);
      stageChangeInFlightRef.current = false;
    }
  };

  return (
    <View style={styles.page} testID="page-2-content">
      {bothCollapsed ? (
        <InfoCard title="一起过夜，不代表任何事情必须发生。" variant="education">
          <Text style={styles.body}>
            想象一个可能的晚上：你和正在靠近的人商量好，会在同一个空间待到明天。
          </Text>
        </InfoCard>
      ) : null}

      <View style={styles.accordions}>
        <AccordionPanel
          busy={stagePending}
          expanded={expanded.expectations}
          ids={expectationIds}
          onOptionPress={(option) => setExpectationIds((current) => updateSelection(current, option, expectations))}
          onToggle={() => togglePanel("expectations")}
          options={expectations}
          title="你有一点期待的是……"
        />
        <AccordionPanel
          busy={stagePending}
          expanded={expanded.concerns}
          ids={concernIds}
          onOptionPress={(option) => setConcernIds((current) => updateSelection(current, option, concerns))}
          onToggle={() => togglePanel("concerns")}
          options={concerns}
          title="你有一点在意的是……"
        />
      </View>

      {stageError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          阶段暂时无法保存，请重试。
        </Text>
      ) : null}

      <View style={styles.footer}>
        {consentSource ? (
          <Pressable
            accessibilityLabel="同意原则与来源"
            accessibilityRole="link"
            onPress={() => setSourceOpen(true)}
            style={({ pressed }) => ({
              justifyContent: "center",
              minHeight: theme.size.minimumTouchTarget,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text style={styles.footerNote}>
              这些感受可以同时被留下，不需要现在整理成一个确定答案。{" "}
              <Text style={styles.sourceLink}>同意原则与来源</Text>
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.footerNote}>
            这些感受可以同时被留下，不需要现在整理成一个确定答案。
          </Text>
        )}
        <JourneyAction
          errorMessage="保存失败，请重试。"
          label="带着这些感受继续"
          loadingLabel="正在继续…"
          onAction={() => onContinue({ expectationIds, concernIds, customNote: initialCustomNote })}
        />
      </View>

      {consentSource ? (
        <SourceDrawer
          institution={consentSource.organization}
          onAction={() => { void onSourceAction?.(consentSource); }}
          onClose={() => setSourceOpen(false)}
          reducedMotion={reducedMotion}
          title={consentSource.title}
          updatedAt={`${consentSource.publicationOrReviewDate} · 访问于 ${consentSource.accessedAt}`}
          visible={sourceOpen}
        />
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return {
  page: {
    flexGrow: 1,
    gap: theme.space.md,
    minWidth: 0,
  },
  accordionCard: {
    gap: theme.space.compact,
    padding: theme.space.md,
  },
  accordionHeadingRow: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
    gap: theme.space.sm,
    justifyContent: "space-between" as const,
  },
  accordions: {
    gap: theme.space.compact,
  },
  heading: {
    ...theme.typography.heading,
    color: theme.color.text,
    flexShrink: 1,
  },
  disclosure: {
    ...theme.typography.heading,
    color: theme.color.textSecondary,
    flexShrink: 0,
  },
  body: {
    ...theme.typography.body,
    color: theme.color.text,
    flexShrink: 1,
  },
  secondary: {
    ...theme.typography.caption,
    color: theme.color.textSecondary,
    flexShrink: 1,
  },
  choices: {
    gap: theme.space.compact,
  },
  error: {
    ...theme.typography.caption,
    color: theme.color.error,
  },
  footer: {
    gap: theme.space.sm,
    marginTop: "auto" as const,
  },
  footerNote: {
    ...theme.typography.caption,
    color: theme.color.textSecondary,
    flexShrink: 1,
  },
  sourceLink: {
    color: theme.color.text,
    textDecorationLine: "underline" as const,
  },
  };
}
