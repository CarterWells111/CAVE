import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  findNodeHandle,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import type { AppTheme } from "../../../../core/design/theme";
import { useTheme } from "../../../../core/design/theme-provider";
import { useReducedMotion } from "../../../../core/design/motion-preferences";
import { useScreenScroll } from "../../../../core/ui/Screen";
import { TextAction } from "../../../../core/ui/text-action";
import type { BehaviorAttitude } from "../../domain/types";
import { loadJourneyContentCatalog } from "../../infrastructure/journey-content-catalog";
import { JourneyAction } from "../components/JourneyAction";
import { JourneyChoice } from "../components/JourneyChoice";
import { JourneyScrollTarget, useJourneyGuidedScroll } from "../guided-scroll-screen";
import { useJourneyStepBack } from "../journey-step-back";
import type { JourneyAction as JourneyActionCallback } from "../journey-ui-contracts";

type CustomBehavior = { id: string; label: string };
type BehaviorDeckCard = {
  kind: "behavior";
  id: string;
  behaviorIds: string[];
  frontLabel: string;
  questionLabel: string;
};
type MoreDeckCard = { kind: "more"; id: "behavior-map-more"; frontLabel: string };
type AddCustomDeckCard = { kind: "add-custom"; id: "behavior-map-custom"; frontLabel: string };
type DeckCard = BehaviorDeckCard | MoreDeckCard | AddCustomDeckCard;
type CardFace = "front" | "back";
type SensitiveStage = "intro" | "learned" | "confirmed";

export type BehaviorMapPageProps = {
  initialAttitudes?: Record<string, BehaviorAttitude>;
  initialCustomBehaviors?: CustomBehavior[];
  initialSensitiveContentConsent?: boolean | null;
  onSetAttitudes(behaviorIds: string[], attitude: BehaviorAttitude): ReturnType<JourneyActionCallback>;
  onAddCustomBehavior?(behavior: CustomBehavior): ReturnType<JourneyActionCallback>;
  onSetSensitiveContentConsent?(consented: boolean): ReturnType<JourneyActionCallback>;
  onCardVisibilityChange?(visible: boolean): void;
  onComplete(input: { participated: true }): ReturnType<JourneyActionCallback>;
  createCustomBehaviorId?: () => string;
  reducedMotion?: boolean;
  resolveFocusHandle?: typeof findNodeHandle;
};

const content = loadJourneyContentCatalog();
const mapPoints = [...content.uiCopy.behaviorMapPoints].sort((first, second) => first.order - second.order);
const catalogAttitudes = [...content.uiCopy.attitudes].sort((first, second) => first.order - second.order);
const behaviorOptions = new Map(
  content.options
    .filter(({ group }) => group === "behavior")
    .map((option) => [option.id, option] as const),
);
const basePoints = mapPoints.filter(({ kind }) => kind === "behavior");
const morePoint = mapPoints.find(({ kind }) => kind === "more");
const addCustomPoint = mapPoints.find(({ kind }) => kind === "custom");
const sensitiveBehaviorIds = morePoint?.behaviorIds ?? [];
const mergedBehaviorGroups = [
  {
    behaviorIds: ["behavior-my-nudity", "behavior-partner-nudity"],
    frontLabel: "彼此裸露",
    id: "behavior-group-nudity",
  },
  {
    behaviorIds: ["behavior-over-clothes-touch", "behavior-direct-touch"],
    frontLabel: "触摸私密部位",
    id: "behavior-group-private-touch",
  },
] as const;
const mergedGroupByBehaviorId = new Map<string, (typeof mergedBehaviorGroups)[number]>(
  mergedBehaviorGroups.flatMap((group) => group.behaviorIds.map((behaviorId) => [behaviorId, group] as const)),
);

function selectedAttitude(card: BehaviorDeckCard, attitudes: Record<string, BehaviorAttitude>) {
  const values = card.behaviorIds.map((behaviorId) => attitudes[behaviorId]);
  const defined = values.filter((value): value is BehaviorAttitude => value !== undefined);
  if (defined.length === 0) return { conflict: false, value: undefined };
  if (defined.length !== values.length || new Set(defined).size !== 1) {
    return { conflict: true, value: undefined };
  }
  return { conflict: false, value: defined[0] };
}

function toDomainAttitude(value: (typeof catalogAttitudes)[number]["value"]): BehaviorAttitude {
  return value === "expecting" ? "looking-forward" : value;
}

function fromDomainAttitude(value: BehaviorAttitude | undefined) {
  return value === "looking-forward" ? "expecting" : value;
}

function attitudeLabel(value: BehaviorAttitude | undefined) {
  const catalogValue = fromDomainAttitude(value);
  return catalogAttitudes.find((attitude) => attitude.value === catalogValue)?.label;
}

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function BehaviorMapPage({
  initialAttitudes = {},
  initialCustomBehaviors = [],
  initialSensitiveContentConsent = null,
  onSetAttitudes,
  onAddCustomBehavior,
  onSetSensitiveContentConsent,
  onCardVisibilityChange,
  onComplete,
  createCustomBehaviorId = () => `custom-${Date.now()}`,
  reducedMotion,
  resolveFocusHandle = findNodeHandle,
}: BehaviorMapPageProps) {
  const theme = useTheme();
  const { reveal } = useJourneyGuidedScroll();
  const systemReducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? systemReducedMotion;
  const { scrollToNode } = useScreenScroll();
  const styles = createStyles(theme);
  const { height } = useWindowDimensions();
  const flipRotation = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const questionRef = useRef<Text>(null);
  const triggerRefs = useRef<Record<string, View | null>>({});
  const pendingScrollTargetRef = useRef<string | null>(null);
  const pendingFocusTargetRef = useRef<string | null>(null);
  const [activeCard, setActiveCard] = useState<DeckCard | null>(null);
  const [cardFace, setCardFace] = useState<CardFace>("front");
  const [animating, setAnimating] = useState(false);
  const [operationInFlight, setOperationInFlight] = useState(false);
  const [draftAttitude, setDraftAttitude] = useState<BehaviorAttitude | undefined>();
  const [attitudes, setAttitudes] = useState<Record<string, BehaviorAttitude>>(() => ({ ...initialAttitudes }));
  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>(() => [...initialCustomBehaviors]);
  const [customLabel, setCustomLabel] = useState("");
  const [sensitiveConsent, setSensitiveConsent] = useState<boolean | null>(initialSensitiveContentConsent);
  const [sensitiveStage, setSensitiveStage] = useState<SensitiveStage>(
    initialSensitiveContentConsent === true ? "confirmed" : "intro",
  );
  const [sensitiveConfirmationChecked, setSensitiveConfirmationChecked] = useState(false);
  const advancedCardsRef = useRef(new Set<string>());

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const renderedMergedGroups = new Set<string>();
  const baseCards: BehaviorDeckCard[] = basePoints.flatMap((point) => {
    const behaviorId = point.behaviorIds[0];
    if (!behaviorId) return [];
    const mergedGroup = mergedGroupByBehaviorId.get(behaviorId);
    if (mergedGroup) {
      if (renderedMergedGroups.has(mergedGroup.id)) return [];
      renderedMergedGroups.add(mergedGroup.id);
      return [{
        behaviorIds: [...mergedGroup.behaviorIds],
        frontLabel: mergedGroup.frontLabel,
        id: mergedGroup.id,
        kind: "behavior" as const,
        questionLabel: mergedGroup.frontLabel,
      }];
    }
    const option = behaviorOptions.get(behaviorId);
    return option ? [{
      behaviorIds: [option.id],
      frontLabel: point.label,
      id: option.id,
      kind: "behavior" as const,
      questionLabel: option.label,
    }] : [];
  });
  const sensitiveCards: BehaviorDeckCard[] = sensitiveConsent === true
    ? sensitiveBehaviorIds.flatMap((behaviorId) => {
      const option = behaviorOptions.get(behaviorId);
      return option ? [{
        behaviorIds: [option.id],
        frontLabel: option.label,
        id: option.id,
        kind: "behavior" as const,
        questionLabel: option.label,
      }] : [];
    })
    : [];
  const customCards: BehaviorDeckCard[] = customBehaviors.map((behavior) => ({
    behaviorIds: [behavior.id],
    kind: "behavior",
    id: behavior.id,
    frontLabel: behavior.label,
    questionLabel: behavior.label,
  }));
  const galleryCards: DeckCard[] = [
    ...baseCards,
    ...(morePoint && sensitiveConsent !== true
      ? [{ kind: "more" as const, id: "behavior-map-more" as const, frontLabel: morePoint.label }]
      : []),
    ...sensitiveCards,
    ...customCards,
    ...(addCustomPoint ? [{ kind: "add-custom" as const, id: "behavior-map-custom" as const, frontLabel: addCustomPoint.label }] : []),
  ];
  const flipDuration = Math.round(theme.motion.duration.slow / 2);

  const animateTo = (toValue: number) => new Promise<void>((resolve) => {
    Animated.timing(flipRotation, {
      duration: shouldReduceMotion ? 0 : flipDuration,
      easing: Easing.inOut(Easing.ease),
      toValue,
      useNativeDriver: true,
    }).start(() => resolve());
  });

  const focusQuestion = () => {
    const node = resolveFocusHandle(questionRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  };

  const setTriggerRef = (cardId: string, node: View | null) => {
    triggerRefs.current[cardId] = node;
    if (node === null) return;
    if (pendingScrollTargetRef.current === cardId) {
      pendingScrollTargetRef.current = null;
      scrollToNode(node, !shouldReduceMotion);
    }
    if (pendingFocusTargetRef.current === cardId) {
      pendingFocusTargetRef.current = null;
      requestAnimationFrame(() => {
        const currentNode = triggerRefs.current[cardId];
        if (!currentNode) return;
        const handle = resolveFocusHandle(currentNode);
        if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
      });
    }
  };

  const openCard = async (card: DeckCard) => {
    if (animating || activeCard) return;
    if (shouldReduceMotion) {
      setActiveCard(card);
      setCardFace("back");
      setDraftAttitude(card.kind === "behavior" ? selectedAttitude(card, attitudes).value : undefined);
      setCustomLabel("");
      setSensitiveConfirmationChecked(false);
      if (card.kind === "more") setSensitiveStage(sensitiveConsent === true ? "confirmed" : "intro");
      onCardVisibilityChange?.(true);
      AccessibilityInfo.announceForAccessibility(`${card.frontLabel}，已展开`);
      await frame();
      if (mountedRef.current) focusQuestion();
      return;
    }
    setAnimating(true);
    setActiveCard(card);
    setCardFace("front");
    setDraftAttitude(card.kind === "behavior" ? selectedAttitude(card, attitudes).value : undefined);
    setCustomLabel("");
    setSensitiveConfirmationChecked(false);
    if (card.kind === "more") setSensitiveStage(sensitiveConsent === true ? "confirmed" : "intro");
    onCardVisibilityChange?.(true);
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
    AccessibilityInfo.announceForAccessibility(`${card.frontLabel}，已展开`);
    focusQuestion();
  };

  const returnToGallery = async (focusTargetId = activeCard?.id ?? null) => {
    if (animating) return;
    pendingFocusTargetRef.current = focusTargetId;
    if (shouldReduceMotion) {
      const label = activeCard?.frontLabel;
      setCardFace("front");
      setActiveCard(null);
      onCardVisibilityChange?.(false);
      await frame();
      if (label) AccessibilityInfo.announceForAccessibility(`${label}，已返回所有卡牌`);
      return;
    }
    setAnimating(true);
    await animateTo(90);
    if (!mountedRef.current) return;
    setCardFace("front");
    flipRotation.setValue(-90);
    await frame();
    if (!mountedRef.current) return;
    await animateTo(0);
    if (!mountedRef.current) return;
    const label = activeCard?.frontLabel;
    setActiveCard(null);
    setAnimating(false);
    onCardVisibilityChange?.(false);
    await frame();
    if (label) AccessibilityInfo.announceForAccessibility(`${label}，已返回所有卡牌`);
  };

  const persistAttitudes = async (behaviorIds: string[], attitude: BehaviorAttitude) => {
    await onSetAttitudes(behaviorIds, attitude);
    setAttitudes((current) => behaviorIds.reduce(
      (next, behaviorId) => ({ ...next, [behaviorId]: attitude }),
      { ...current },
    ));
  };

  const runWithOperationLock = <T,>(operation: () => T | Promise<T>): T | Promise<T> => {
    setOperationInFlight(true);
    const release = () => {
      if (mountedRef.current) setOperationInFlight(false);
    };
    try {
      const result = operation();
      if (result && typeof (result as Promise<T>).then === "function") {
        return Promise.resolve(result).finally(release);
      }
      release();
      return result;
    } catch (error) {
      release();
      throw error;
    }
  };

  const saveActiveBehavior = () => runWithOperationLock(async () => {
    if (activeCard?.kind !== "behavior" || draftAttitude === undefined) return;
    await persistAttitudes(activeCard.behaviorIds, draftAttitude);
    await returnToGallery();
  });

  const chooseDraftAttitude = (behaviorId: string, attitude: BehaviorAttitude) => {
    setDraftAttitude(attitude);
    if (advancedCardsRef.current.has(behaviorId)) return;
    advancedCardsRef.current.add(behaviorId);
    reveal("behavior-map-active-action");
  };

  const persistSensitiveConsent = (consented: boolean) => runWithOperationLock(async () => {
    await onSetSensitiveContentConsent?.(consented);
    setSensitiveConsent(consented);
    const targetId = consented
      ? (sensitiveBehaviorIds[0] ?? null)
      : "behavior-map-more";
    pendingScrollTargetRef.current = targetId;
    await returnToGallery(targetId);
  });

  const addCustomBehavior = () => runWithOperationLock(async () => {
    const label = customLabel.trim();
    if (!label) return;
    const behavior = { id: createCustomBehaviorId(), label };
    await onAddCustomBehavior?.(behavior);
    setCustomBehaviors((current) => [...current, behavior]);
    setCustomLabel("");
    await returnToGallery();
  });

  const cardStatus = (card: DeckCard) => {
    if (card.kind === "behavior") {
      const selection = selectedAttitude(card, attitudes);
      if (selection.conflict) return "需要重新选择";
      const label = attitudeLabel(selection.value);
      return label ? `已选择：${label}` : "点击选择";
    }
    if (card.kind === "more") {
      if (sensitiveConsent === true) return "已展开，点击修改";
      if (sensitiveConsent === false) return "这次不查看，点击重新查看";
      return "可选，点击查看";
    }
    return "点击添加";
  };

  const rotation = flipRotation.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ["-90deg", "0deg", "90deg"],
  });

  const returnToPreviousStep = async () => {
    if (activeCard?.kind === "more" && sensitiveStage === "learned") {
      setSensitiveConfirmationChecked(false);
      setSensitiveStage("intro");
      return;
    }
    await returnToGallery();
  };

  useJourneyStepBack({
    active: activeCard !== null,
    disabled: animating || operationInFlight,
    onBack: returnToPreviousStep,
  });

  if (activeCard) {
    return (
      <JourneyScrollTarget targetId="behavior-map-active-card">
      <Animated.View
        accessibilityState={{ busy: animating }}
        style={[
          styles.fullPage,
          { minHeight: Math.max(520, height - 180) },
          shouldReduceMotion ? undefined : { transform: [{ perspective: 1000 }, { rotateY: rotation }] },
        ]}
        testID="behavior-card-fullscreen"
      >
        {cardFace === "front" ? (
          <View style={styles.fullFront}>
            <Text accessibilityRole="header" selectable style={styles.fullFrontTitle}>{activeCard.frontLabel}</Text>
            <Text selectable style={styles.frontStatus}>{cardStatus(activeCard)}</Text>
          </View>
        ) : activeCard.kind === "behavior" ? (
          <View style={styles.fullBack} testID={`behavior-card-back-${activeCard.id}`}>
            <Text accessibilityRole="header" ref={questionRef} selectable style={styles.question}>
              {`对于${activeCard.questionLabel}，此刻的你更接近哪种感觉？`}
            </Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {catalogAttitudes.map((attitude) => {
                const domainAttitude = toDomainAttitude(attitude.value);
                return (
                  <View key={attitude.id} style={styles.attitudeOption}>
                    <JourneyChoice
                      accessibilityLabel={`${activeCard.questionLabel}：${attitude.label}`}
                      disabled={animating}
                      label={attitude.label}
                      mode="single"
                      onSelect={() => chooseDraftAttitude(activeCard.id, domainAttitude)}
                      selected={draftAttitude === domainAttitude}
                    />
                    <Text selectable style={styles.feedback}>{attitude.feedback}</Text>
                  </View>
                );
              })}
            </View>
            <JourneyScrollTarget targetId="behavior-map-active-action">
              <JourneyAction
                disabled={draftAttitude === undefined || animating}
                errorMessage="暂时无法保存，请重试。"
                label="带着这些感受继续"
                loadingLabel="正在保存…"
                onAction={saveActiveBehavior}
              />
            </JourneyScrollTarget>
          </View>
        ) : activeCard.kind === "more" ? (
          <View style={styles.fullBack} testID="behavior-card-back-more">
            {sensitiveStage === "intro" ? (
              <>
                <Text accessibilityRole="header" ref={questionRef} selectable style={styles.question}>是否查看更多具体行为？</Text>
                <Text selectable style={styles.supporting}>这里会使用直接、明确的健康教育用语。是否查看、是否回答都由你决定，不影响后续流程或积分。</Text>
                <JourneyAction label="了解内容后再决定" loadingLabel="正在打开说明…" onAction={() => setSensitiveStage("learned")} />
                <JourneyAction errorMessage="暂时无法记录，请重试。" label="这次不查看" loadingLabel="正在记录…" onAction={() => persistSensitiveConsent(false)} />
              </>
            ) : sensitiveStage === "learned" ? (
              <>
                <Text accessibilityRole="header" ref={questionRef} selectable style={styles.question}>继续查看更具体的身体接触</Text>
                <Text selectable style={styles.supporting}>接下来的内容涉及口腔与私密部位的接触、插入式行为等，以成年人的身体认识、同意与健康教育为目的。</Text>
                <Text selectable style={styles.supporting}>部分内容可能让人不舒服。你可以随时返回；不查看不会影响后续流程或积分。</Text>
                <JourneyChoice
                  label="我知道接下来会看到更具体的健康教育内容，并愿意继续"
                  onSelect={() => {
                    const next = !sensitiveConfirmationChecked;
                    setSensitiveConfirmationChecked(next);
                    if (next) reveal("behavior-map-sensitive-confirm");
                  }}
                  selected={sensitiveConfirmationChecked}
                />
                <JourneyScrollTarget targetId="behavior-map-sensitive-confirm">
                  <JourneyAction
                    disabled={!sensitiveConfirmationChecked}
                    errorMessage="暂时无法记录，请重试。"
                    label="我了解，继续查看"
                    loadingLabel="正在记录选择…"
                    onAction={() => persistSensitiveConsent(true)}
                  />
                </JourneyScrollTarget>
                <JourneyAction errorMessage="暂时无法记录，请重试。" label="这次不查看" loadingLabel="正在记录…" onAction={() => persistSensitiveConsent(false)} />
              </>
            ) : (
              <>
                <Text accessibilityRole="header" ref={questionRef} selectable style={styles.question}>更多具体行为已经显示在卡牌中</Text>
                <Text selectable style={styles.supporting}>你可以分别选择或修改这两张卡，也可以改为这次不查看。</Text>
                <JourneyAction label="继续显示具体行为" loadingLabel="正在返回…" onAction={returnToGallery} />
                <JourneyAction errorMessage="暂时无法记录，请重试。" label="这次不查看" loadingLabel="正在记录…" onAction={() => persistSensitiveConsent(false)} />
              </>
            )}
          </View>
        ) : (
          <View style={styles.fullBack} testID="behavior-card-back-add-custom">
            <Text accessibilityRole="header" ref={questionRef} selectable style={styles.question}>还有没有一件你在意、但没有出现在前面的事？</Text>
            <TextInput
              accessibilityLabel="我在意的自定义行为"
              maxLength={120}
              onChangeText={setCustomLabel}
              placeholder="例如：只想拥抱、不想关灯、希望保留衣物……"
              placeholderTextColor={theme.color.textTertiary}
              selectionColor={theme.color.primary}
              style={styles.input}
              value={customLabel}
            />
            <JourneyAction
              disabled={!customLabel.trim()}
              errorMessage="暂时无法添加，请重试。"
              label="添加到卡牌"
              loadingLabel="正在添加…"
              onAction={addCustomBehavior}
            />
            <TextAction label="返回所有卡牌" onPress={() => { void returnToGallery(); }} />
          </View>
        )}
      </Animated.View>
      </JourneyScrollTarget>
    );
  }

  return (
    <View style={styles.page} testID="page-3-content">
      <View style={styles.grid} testID="behavior-card-grid">
        {galleryCards.map((card) => {
          const selected = card.kind === "behavior" && selectedAttitude(card, attitudes).value !== undefined;
          const declined = card.kind === "more" && sensitiveConsent === false;
          return (
            <Pressable
              accessibilityHint={selected ? "点击修改已经留下的感受" : "点击翻到卡牌反面"}
              accessibilityLabel={`${card.frontLabel}，${selected ? "已填写，点击修改" : cardStatus(card)}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={card.id}
              onPress={() => { void openCard(card); }}
              ref={(node) => setTriggerRef(card.id, node)}
              style={({ pressed }) => [
                styles.frontCard,
                declined ? styles.frontCardDeclined : null,
                pressed ? styles.frontCardPressed : null,
              ]}
              testID={`behavior-card-front-${card.id}`}
            >
              <Text selectable style={styles.frontTitle}>{card.frontLabel}</Text>
              <Text selectable style={styles.frontStatus}>{cardStatus(card)}</Text>
              {selected ? <Text selectable style={styles.modify}>点击修改</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <JourneyScrollTarget targetId="behavior-map-final-continue">
        <JourneyAction
          accessibilityLabel="继续整理感受"
          label="继续整理感受"
          loadingLabel="正在继续…"
          onAction={() => runWithOperationLock(() => onComplete({ participated: true }))}
        />
      </JourneyScrollTarget>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return {
  page: { flexGrow: 1, gap: theme.space.xl, maxWidth: "100%" as const, width: "100%" as const },
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
  frontCardDeclined: { backgroundColor: theme.color.surfaceSubtle, opacity: 0.62 },
  frontTitle: { ...theme.typography.cardTitle, color: theme.color.text, flexShrink: 1 },
  frontStatus: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
  modify: { ...theme.typography.label, color: theme.color.brandSoft, flexShrink: 1 },
  fullPage: {
    backfaceVisibility: "hidden" as const,
    flexGrow: 1,
    maxWidth: "100%" as const,
    width: "100%" as const,
  },
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
  supporting: { ...theme.typography.body, color: theme.color.textSecondary, flexShrink: 1 },
  options: { gap: theme.space.compact, width: "100%" as const },
  attitudeOption: { gap: theme.space.compact, width: "100%" as const },
  feedback: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
  input: {
    ...theme.typography.body,
    backgroundColor: theme.color.surfaceSubtle,
    borderColor: theme.color.border,
    borderCurve: "continuous" as const,
    borderRadius: theme.radius.control,
    borderWidth: theme.border.width,
    color: theme.color.text,
    minHeight: theme.size.primaryActionHeight,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.compact,
    width: "100%" as const,
  },
  };
}
