import type { JourneyOption } from "@cave/content";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  findNodeHandle,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { AppTheme } from "../../../../core/design/theme";
import { useReducedMotion } from "../../../../core/design/motion-preferences";
import { useTheme } from "../../../../core/design/theme-provider";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import { InfoCard } from "../../../../core/ui/info-card";
import { JourneyAction } from "../components/JourneyAction";

type ActionResult = void | Promise<void>;
type Stage = "expectations" | "concerns";
type Panel = Stage;
type CardFace = "front" | "back";
type ProgressInput = {
  stage: Stage;
  expectationIds: string[];
  concernIds: string[];
  customNote: string;
  completed: false;
};

export type OvernightPageProps = {
  options: JourneyOption[];
  onContinue: (input: { expectationIds: string[]; concernIds: string[]; customNote: string }) => ActionResult;
  onProgress?: (input: ProgressInput) => ActionResult;
  initialExpectationIds?: string[];
  initialConcernIds?: string[];
  initialCustomNote?: string;
  initialStage?: Stage;
  onOpenSources?: () => ActionResult;
  onCardVisibilityChange?: (visible: boolean) => void;
  onNavigationLockChange?: (locked: boolean) => void;
  reducedMotion?: boolean;
  resolveFocusHandle?: typeof findNodeHandle;
};

const PANEL_TITLES: Record<Panel, string> = {
  expectations: "你有一点期待的是……",
  concerns: "你有一点在意的是……",
};

function updateSelection(current: string[], option: JourneyOption, group: JourneyOption[]): string[] {
  if (option.exclusive) return current.includes(option.id) ? [] : [option.id];
  const withoutExclusive = current.filter((id) => !group.find((item) => item.id === id)?.exclusive);
  return withoutExclusive.includes(option.id)
    ? withoutExclusive.filter((id) => id !== option.id)
    : [...withoutExclusive, option.id];
}

function selectionSummary(count: number): string {
  return count === 0 ? "还没有选择" : `已选 ${count} 个`;
}

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function OvernightPage({
  options,
  onContinue,
  initialExpectationIds = [],
  initialConcernIds = [],
  initialCustomNote = "",
  onProgress,
  onOpenSources,
  onCardVisibilityChange,
  onNavigationLockChange,
  reducedMotion,
  resolveFocusHandle = findNodeHandle,
}: OvernightPageProps) {
  const theme = useTheme();
  const systemReducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? systemReducedMotion;
  const styles = createStyles(theme);
  const { height } = useWindowDimensions();
  const expectations = options.filter((item) => item.group === "expectation").sort((a, b) => a.order - b.order);
  const concerns = options.filter((item) => item.group === "concern").sort((a, b) => a.order - b.order);
  const flipRotation = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const questionRef = useRef<Text>(null);
  const triggerRefs = useRef<Record<Panel, View | null>>({ expectations: null, concerns: null });
  const pendingFocusPanelRef = useRef<Panel | null>(null);
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const [cardFace, setCardFace] = useState<CardFace>("front");
  const [animating, setAnimating] = useState(false);
  const [expectationIds, setExpectationIds] = useState([...initialExpectationIds]);
  const [concernIds, setConcernIds] = useState([...initialConcernIds]);
  const [stagePending, setStagePending] = useState(false);
  const [stageError, setStageError] = useState(false);
  const [completionNavigationLocked, setCompletionNavigationLocked] = useState(false);
  const [failedProgress, setFailedProgress] = useState<{
    input: ProgressInput;
    resumeOpening: Panel | null;
  } | null>(null);
  const progressLocked = stagePending || failedProgress !== null;
  const interactionsLocked = progressLocked || completionNavigationLocked || animating;
  const navigationLocked = progressLocked || completionNavigationLocked;
  const flipDuration = Math.round(theme.motion.duration.slow / 2);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    onNavigationLockChange?.(navigationLocked);
  }, [navigationLocked, onNavigationLockChange]);

  useEffect(() => () => onNavigationLockChange?.(false), [onNavigationLockChange]);

  const animateTo = (toValue: number) => new Promise<void>((resolve) => {
    Animated.timing(flipRotation, {
      duration: shouldReduceMotion ? 0 : flipDuration,
      easing: Easing.inOut(Easing.ease),
      toValue,
      useNativeDriver: true,
    }).start(() => resolve());
  });

  const progressInput = (
    stage: Stage,
    nextExpectationIds = expectationIds,
    nextConcernIds = concernIds,
  ): ProgressInput => ({
    completed: false,
    concernIds: nextConcernIds,
    customNote: initialCustomNote,
    expectationIds: nextExpectationIds,
    stage,
  });

  const saveProgress = async (input: ProgressInput, resumeOpening: Panel | null = null) => {
    setStageError(false);
    setStagePending(true);
    try {
      await onProgress?.(input);
      setFailedProgress(null);
      return true;
    } catch {
      setStageError(true);
      setFailedProgress({ input, resumeOpening });
      return false;
    } finally {
      if (mountedRef.current) setStagePending(false);
    }
  };

  const focusQuestion = () => {
    const node = resolveFocusHandle(questionRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  };

  const revealPanel = async (panel: Panel) => {
    setActivePanel(panel);
    onCardVisibilityChange?.(true);
    if (shouldReduceMotion) {
      setCardFace("back");
      AccessibilityInfo.announceForAccessibility(`${PANEL_TITLES[panel]}，已展开`);
      await frame();
      if (mountedRef.current) focusQuestion();
      return;
    }
    setAnimating(true);
    setCardFace("front");
    flipRotation.setValue(0);
    await frame();
    if (!mountedRef.current) return;
    await animateTo(90);
    if (!mountedRef.current) return;
    setCardFace("back");
    flipRotation.setValue(-90);
    await frame();
    if (!mountedRef.current) return;
    await animateTo(0);
    if (!mountedRef.current) return;
    setAnimating(false);
    AccessibilityInfo.announceForAccessibility(`${PANEL_TITLES[panel]}，已展开`);
    focusQuestion();
  };

  const openPanel = (panel: Panel) => {
    if (interactionsLocked || activePanel !== null) return;
    if (onProgress === undefined) {
      void revealPanel(panel);
      return;
    }
    void saveProgress(progressInput(panel), panel).then((saved) => {
      if (saved) void revealPanel(panel);
    });
  };

  const returnToOverview = async () => {
    if (interactionsLocked || activePanel === null) return;
    const panel = activePanel;
    pendingFocusPanelRef.current = panel;
    if (shouldReduceMotion) {
      setCardFace("front");
      setActivePanel(null);
      onCardVisibilityChange?.(false);
      await frame();
    } else {
      setAnimating(true);
      await animateTo(90);
      if (!mountedRef.current) return;
      setCardFace("front");
      flipRotation.setValue(-90);
      await frame();
      if (!mountedRef.current) return;
      await animateTo(0);
      if (!mountedRef.current) return;
      setActivePanel(null);
      setAnimating(false);
      onCardVisibilityChange?.(false);
      await frame();
    }
    AccessibilityInfo.announceForAccessibility(`${PANEL_TITLES[panel]}，已返回两张卡片`);
  };

  const setTriggerRef = (panel: Panel, node: View | null) => {
    triggerRefs.current[panel] = node;
    if (node === null || pendingFocusPanelRef.current !== panel) return;
    pendingFocusPanelRef.current = null;
    requestAnimationFrame(() => {
      const currentNode = triggerRefs.current[panel];
      if (currentNode === null) return;
      const handle = resolveFocusHandle(currentNode);
      if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
    });
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
    if (onProgress !== undefined) {
      void saveProgress(progressInput(panel, nextExpectationIds, nextConcernIds));
    }
  };

  const retryProgress = () => {
    if (failedProgress === null || stagePending) return;
    const failed = failedProgress;
    void saveProgress(failed.input, failed.resumeOpening).then((saved) => {
      if (saved && failed.resumeOpening !== null) void revealPanel(failed.resumeOpening);
    });
  };

  const continueToBehaviorMap = async () => {
    setCompletionNavigationLocked(true);
    await onContinue({ expectationIds, concernIds, customNote: initialCustomNote });
    if (mountedRef.current) setCompletionNavigationLocked(false);
  };

  const rotation = flipRotation.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ["-90deg", "0deg", "90deg"],
  });

  if (activePanel !== null) {
    const panelOptions = activePanel === "expectations" ? expectations : concerns;
    const selectedIds = activePanel === "expectations" ? expectationIds : concernIds;
    return (
      <Animated.View
        style={[
          styles.fullPage,
          { minHeight: Math.max(520, height - 180) },
          shouldReduceMotion ? null : { transform: [{ perspective: 1000 }, { rotateY: rotation }] },
        ]}
        testID="overnight-card-fullscreen"
      >
        {cardFace === "front" ? (
          <View style={styles.fullFront}>
            <Text accessibilityRole="header" style={styles.fullFrontTitle}>{PANEL_TITLES[activePanel]}</Text>
          </View>
        ) : (
          <View style={styles.fullBack} testID={`overnight-card-back-${activePanel}`}>
            <Text accessibilityRole="header" ref={questionRef} style={styles.question}>{PANEL_TITLES[activePanel]}</Text>
            <View style={styles.choices}>
              {panelOptions.map((option) => (
                <ChoiceChip
                  disabled={interactionsLocked}
                  key={option.id}
                  label={option.label}
                  onPress={() => saveSelection(activePanel, option)}
                  selected={selectedIds.includes(option.id)}
                  semantics="checkbox"
                />
              ))}
            </View>
            {stageError ? (
              <>
                <Text accessibilityRole="alert" style={styles.error}>暂时无法保存，请重试。</Text>
                <JourneyAction
                  disabled={stagePending}
                  errorMessage="暂时无法保存，请重试。"
                  label="重试保存当前选择"
                  loadingLabel="正在重试保存…"
                  onAction={retryProgress}
                />
              </>
            ) : null}
            <JourneyAction
              disabled={interactionsLocked}
              label="带着这些感受继续"
              loadingLabel="正在返回…"
              onAction={returnToOverview}
            />
          </View>
        )}
      </Animated.View>
    );
  }

  const panels: Array<{ id: Panel; ids: string[] }> = [
    { id: "expectations", ids: expectationIds },
    { id: "concerns", ids: concernIds },
  ];

  return (
    <View style={styles.page} testID="page-2-content">
      <InfoCard title="一起过夜，不代表任何事情必须发生。" variant="education">
        <Text style={styles.body}>想象一个可能的晚上：你和正在靠近的人商量好，会在同一个空间待到明天。</Text>
      </InfoCard>

      <View style={styles.grid} testID="overnight-card-grid">
        {panels.map((panel) => {
          const summary = selectionSummary(panel.ids.length);
          return (
            <Pressable
              accessibilityLabel={`${PANEL_TITLES[panel.id]}，${summary}，点击翻看`}
              accessibilityRole="button"
              accessibilityState={{ busy: stagePending, disabled: interactionsLocked }}
              disabled={interactionsLocked}
              key={panel.id}
              onPress={() => openPanel(panel.id)}
              ref={(node) => setTriggerRef(panel.id, node)}
              style={({ pressed }) => [styles.frontCard, pressed ? styles.frontCardPressed : null]}
              testID={`overnight-card-front-${panel.id}`}
            >
              <Text style={styles.frontTitle}>{PANEL_TITLES[panel.id]}</Text>
              <Text style={styles.frontStatus}>{summary}</Text>
              <Text style={styles.modify}>{panel.ids.length > 0 ? "点击修改" : "点击翻看"}</Text>
            </Pressable>
          );
        })}
      </View>

      {stageError ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>暂时无法保存，请重试。</Text>
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
        <Text style={styles.footerNote}>这些感受可以同时被留下，不需要现在整理成一个确定答案。</Text>
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
        <JourneyAction
          disabled={progressLocked || animating}
          errorMessage="保存失败，请重试。"
          label="进入行为地图"
          loadingLabel="正在进入…"
          onAction={continueToBehaviorMap}
        />
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return {
    page: { flexGrow: 1, gap: theme.space.md, minWidth: 0 },
    body: { ...theme.typography.body, color: theme.color.text, flexShrink: 1 },
    grid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: theme.space.md,
      justifyContent: "space-between" as const,
      width: "100%" as const,
    },
    frontCard: {
      backgroundColor: theme.color.surface,
      borderColor: theme.color.border,
      borderCurve: "continuous" as const,
      borderRadius: theme.radius.feature,
      borderWidth: theme.border.width,
      gap: theme.space.sm,
      justifyContent: "space-between" as const,
      minHeight: 156,
      padding: theme.space.md,
      width: "47.5%" as const,
    },
    frontCardPressed: { backgroundColor: theme.color.surfacePressed, borderColor: theme.color.brandSoft },
    frontTitle: { ...theme.typography.cardTitle, color: theme.color.text, flexShrink: 1 },
    frontStatus: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
    modify: { ...theme.typography.label, color: theme.color.brandSoft, flexShrink: 1 },
    fullPage: { backfaceVisibility: "hidden" as const, flexGrow: 1, maxWidth: "100%" as const, width: "100%" as const },
    fullFront: {
      backgroundColor: theme.color.surface,
      borderColor: theme.color.brandSoft,
      borderCurve: "continuous" as const,
      borderRadius: theme.radius.feature,
      borderWidth: theme.border.selectedWidth,
      flexGrow: 1,
      gap: theme.space.md,
      justifyContent: "center" as const,
      padding: theme.space.card,
    },
    fullFrontTitle: { ...theme.typography.title, color: theme.color.text, flexShrink: 1 },
    fullBack: { flexGrow: 1, gap: theme.space.lg, justifyContent: "center" as const, width: "100%" as const },
    question: { ...theme.typography.title, color: theme.color.text, flexShrink: 1 },
    choices: { gap: theme.space.compact, width: "100%" as const },
    error: { ...theme.typography.caption, color: theme.color.error },
    footer: { gap: theme.space.sm, marginTop: "auto" as const },
    footerNote: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
    sourceLink: { color: theme.color.text, textDecorationLine: "underline" as const },
  };
}
