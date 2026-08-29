import type { JourneyOption } from "@cave/content";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { AppTheme } from "../../../../core/design/theme";
import { useTheme } from "../../../../core/design/theme-provider";
import { Card } from "../../../../core/ui/Card";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import { InfoCard } from "../../../../core/ui/info-card";
import { JourneyAction } from "../components/JourneyAction";
import { JourneyScrollTarget, useJourneyGuidedScroll } from "../guided-scroll-screen";

type ActionResult = void | Promise<void>;
type Stage = "expectations" | "concerns";
type Panel = "expectations" | "concerns";

export type OvernightPageProps = {
  options: JourneyOption[];
  onContinue: (input: { expectationIds: string[]; concernIds: string[]; customNote: string }) => ActionResult;
  onProgress?: (input: {
    stage: Stage;
    expectationIds: string[];
    concernIds: string[];
    customNote: string;
    completed: false;
  }) => ActionResult;
  initialExpectationIds?: string[];
  initialConcernIds?: string[];
  initialCustomNote?: string;
  initialStage?: Stage;
  onOpenSources?: () => ActionResult;
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
  disabled,
  expanded,
  ids,
  onOptionPress,
  onToggle,
  options,
  title,
}: {
  busy: boolean;
  disabled: boolean;
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
        accessibilityState={{ busy, disabled, expanded }}
        disabled={disabled}
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
          <Text style={styles.secondary}>{busy ? "正在展开…" : disabled ? "保存失败，请重试" : summary}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.choices}>
          {options.map((option) => (
            <ChoiceChip
              key={option.id}
              label={option.label}
              disabled={disabled}
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
  onProgress,
  onOpenSources,
}: OvernightPageProps) {
  const theme = useTheme();
  const { reveal } = useJourneyGuidedScroll();
  const styles = createStyles(theme);
  const expectations = options.filter((item) => item.group === "expectation").sort((a, b) => a.order - b.order);
  const concerns = options.filter((item) => item.group === "concern").sort((a, b) => a.order - b.order);
  const [expectationIds, setExpectationIds] = useState([...initialExpectationIds]);
  const [concernIds, setConcernIds] = useState([...initialConcernIds]);
  const [expanded, setExpanded] = useState<Record<Panel, boolean>>({
    expectations: false,
    concerns: false,
  });
  const [stagePending, setStagePending] = useState(false);
  const [stageError, setStageError] = useState(false);
  const [failedProgress, setFailedProgress] = useState<{
    input: {
      stage: Stage;
      expectationIds: string[];
      concernIds: string[];
      customNote: string;
      completed: false;
    };
    resumeOpening: Panel | null;
  } | null>(null);
  const stageChangeInFlightRef = useRef(false);
  const advancedPanelsRef = useRef(new Set<Panel>());
  const persistedStageRef = useRef<Stage>(initialStage);
  const bothCollapsed = !expanded.expectations && !expanded.concerns;
  const interactionsLocked = stagePending || failedProgress !== null;

  const finishOpening = (panel: Panel) => {
    persistedStageRef.current = panel;
    setExpanded((current) => ({ ...current, [panel]: true }));
    setStagePending(false);
    stageChangeInFlightRef.current = false;
    reveal(`overnight-${panel}-heading`);
  };

  const saveProgress = async (
    input: NonNullable<OvernightPageProps["onProgress"]> extends (value: infer Input) => ActionResult ? Input : never,
    resumeOpening: Panel | null = null,
  ) => {
    setStageError(false);
    setStagePending(true);
    try {
      await onProgress?.(input);
      persistedStageRef.current = input.stage;
      setFailedProgress(null);
      return true;
    } catch {
      setStageError(true);
      setFailedProgress({ input, resumeOpening });
      return false;
    } finally {
      setStagePending(false);
    }
  };

  const revealAfterSelection = (panel: Panel) => {
    if (advancedPanelsRef.current.has(panel)) return;
    advancedPanelsRef.current.add(panel);
    reveal(panel === "expectations" ? "overnight-concerns-heading" : "overnight-final-continue");
  };

  const progressInput = (nextStage: Stage, nextExpectationIds = expectationIds, nextConcernIds = concernIds) => ({
    completed: false as const,
    concernIds: nextConcernIds,
    customNote: initialCustomNote,
    expectationIds: nextExpectationIds,
    stage: nextStage,
  });

  const togglePanel = (panel: Panel) => {
    if (interactionsLocked) return;
    if (expanded[panel]) {
      setExpanded((current) => ({ ...current, [panel]: false }));
      return;
    }
    if (onProgress === undefined) {
      finishOpening(panel);
      return;
    }
    if (stageChangeInFlightRef.current) return;

    stageChangeInFlightRef.current = true;
    void saveProgress(progressInput(panel), panel).then((saved) => {
      if (saved) finishOpening(panel);
    }).finally(() => { stageChangeInFlightRef.current = false; });
  };

  const saveSelection = (panel: Panel, option: JourneyOption) => {
    if (interactionsLocked) return;
    const nextExpectationIds = panel === "expectations"
      ? updateSelection(expectationIds, option, expectations)
      : expectationIds;
    const nextConcernIds = panel === "concerns"
      ? updateSelection(concernIds, option, concerns)
      : concernIds;
    setExpectationIds(nextExpectationIds);
    setConcernIds(nextConcernIds);
    if (onProgress === undefined) {
      revealAfterSelection(panel);
      return;
    }
    void saveProgress(progressInput(panel, nextExpectationIds, nextConcernIds)).then((saved) => {
      if (saved) revealAfterSelection(panel);
    });
  };

  const retryProgress = () => {
    if (failedProgress === null || stagePending) return;
    const failed = failedProgress;
    void saveProgress(failed.input, failed.resumeOpening).then((saved) => {
      if (saved && failed.resumeOpening !== null) finishOpening(failed.resumeOpening);
    });
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
        <JourneyScrollTarget targetId="overnight-expectations-heading">
        <AccordionPanel
          busy={stagePending}
          disabled={interactionsLocked}
          expanded={expanded.expectations}
          ids={expectationIds}
          onOptionPress={(option) => saveSelection("expectations", option)}
          onToggle={() => togglePanel("expectations")}
          options={expectations}
          title="你有一点期待的是……"
        />
        </JourneyScrollTarget>
        <JourneyScrollTarget targetId="overnight-concerns-heading">
        <AccordionPanel
          busy={stagePending}
          disabled={interactionsLocked}
          expanded={expanded.concerns}
          ids={concernIds}
          onOptionPress={(option) => saveSelection("concerns", option)}
          onToggle={() => togglePanel("concerns")}
          options={concerns}
          title="你有一点在意的是……"
        />
        </JourneyScrollTarget>
      </View>

      {stageError ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            暂时无法保存，请重试。
          </Text>
          <JourneyAction
          disabled={stagePending}
            errorMessage="暂时无法保存，请重试。"
            label="重试保存当前选择"
            loadingLabel="正在重试保存…"
            onAction={retryProgress}
          />
        </>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerNote}>
          这些感受可以同时被留下，不需要现在整理成一个确定答案。
        </Text>
        <Pressable
          accessibilityLabel="打开内界官网信息来源"
          accessibilityRole="link"
          onPress={() => { void onOpenSources?.(); }}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            justifyContent: "center",
            minHeight: theme.size.minimumTouchTarget,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text style={styles.sourceLink}>查看完整信息来源</Text>
        </Pressable>
        <JourneyScrollTarget targetId="overnight-final-continue">
          <JourneyAction
            errorMessage="保存失败，请重试。"
            label="带着这些感受继续"
            loadingLabel="正在继续…"
            disabled={interactionsLocked}
            onAction={() => onContinue({ expectationIds, concernIds, customNote: initialCustomNote })}
          />
        </JourneyScrollTarget>
      </View>
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
