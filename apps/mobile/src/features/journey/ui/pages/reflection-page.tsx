import { useEffect, useRef, useState, type RefObject } from "react";
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
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import { Card } from "../../../../core/ui/Card";
import { InfoCard } from "../../../../core/ui/info-card";
import { TextAction } from "../../../../core/ui/text-action";
import type { BehaviorAttitude, JournalSaveChoice } from "../../domain/types";
import { loadJourneyContentCatalog } from "../../infrastructure/journey-content-catalog";
import { JourneyAction } from "../components/JourneyAction";
import { JourneyChoice } from "../components/JourneyChoice";
import { JourneyScrollTarget, useJourneyGuidedScroll } from "../guided-scroll-screen";
import type { JourneyAction as JourneyActionCallback } from "../journey-ui-contracts";

type PressureAnswer = "still-want" | "slow-down" | "unsure" | "less-want" | "skip";
type RefusalSafety = "can" | "difficult-but-possible" | "fear-reaction" | "cannot-refuse" | "unsure";
type ExpressionDifficulty = "can-say" | "needs-phrase" | "not-ready" | "unsure";
type ComfortClarity = "mostly-clear" | "need-space";
type ReflectionCardId = "motivation" | "safety" | "expression" | "comfort" | "journal";
type CardFace = "front" | "back";

export type ReflectionValue = {
  motivationIds: string[];
  pressureWithoutDisappointment: PressureAnswer | null;
  refusalSafety: RefusalSafety | null;
  expressionDifficulty: ExpressionDifficulty | null;
  comfortClarity: ComfortClarity | null;
  comfortNeedIds: string[];
  comfortNote: string;
  journalPromptId?: string;
  journalText: string;
  journalSaveChoice: JournalSaveChoice;
};

export type ReflectionPageProps = {
  initialValue?: Partial<ReflectionValue>;
  behaviorAnswers?: Array<{ behaviorId: string; behaviorLabel: string; attitude: BehaviorAttitude }>;
  onCardVisibilityChange?(visible: boolean): void;
  onEditBehaviorAttitude?(behaviorId: string, attitude: BehaviorAttitude): ReturnType<JourneyActionCallback>;
  onOpenComfort?(): ReturnType<JourneyActionCallback>;
  onOpenJournal?(): ReturnType<JourneyActionCallback>;
  onSetJournalSaveNotice?(enabled: boolean): ReturnType<JourneyActionCallback>;
  onSave?(value: ReflectionValue): ReturnType<JourneyActionCallback>;
  onUsePracticePhrase?(phrase: string): ReturnType<JourneyActionCallback>;
  onComplete(value: ReflectionValue): ReturnType<JourneyActionCallback>;
  reducedMotion?: boolean;
  resolveFocusHandle?: typeof findNodeHandle;
  showLocalJournalSaveNotice?: boolean;
  storageMode?: "device" | "session-only";
};

const content = loadJourneyContentCatalog();
const motivationOptions = content.options
  .filter(({ group }) => group === "motivation")
  .sort((first, second) => first.order - second.order);
const comfortOptions = content.options
  .filter(({ group }) => group === "comfort")
  .sort((first, second) => first.order - second.order);
const skipMotivationId = motivationOptions.find(({ exclusive }) => exclusive)?.id;
const disappointmentMotivationId = "motivation-avoid-disappointment";
const slowDownPhrase = "我愿意试试看，但想慢慢来。我说“慢一点”或“停下”时，请马上停下来。";
const stopPhrase = "先停一下，我现在需要一点时间。";

const cards: Array<{ id: ReflectionCardId; title: string }> = [
  { id: "motivation", title: "靠近我的动力" },
  { id: "safety", title: "我能说不、暂停或离开吗" },
  { id: "expression", title: "我能表达变化吗" },
  { id: "comfort", title: "什么让我更安心" },
  { id: "journal", title: "给此刻留一句话" },
];

const reviewGroups: Array<{ attitude: BehaviorAttitude; label: string }> = [
  { attitude: "looking-forward", label: "我有些期待" },
  { attitude: "familiar-enjoyed", label: "我已经习惯 / 我享受这类亲密行为" },
  { attitude: "decide-in-moment", label: "我想留到当时再感受" },
  { attitude: "unsure", label: "我还没想清楚" },
  { attitude: "not-this-time", label: "这次我不希望发生" },
  { attitude: "skip", label: "我暂时留白了" },
];

const pressureOptions: Array<{ value: PressureAnswer; label: string }> = [
  { value: "still-want", label: "我还是想靠近" },
  { value: "slow-down", label: "也许想，但希望慢一点" },
  { value: "unsure", label: "我还不知道" },
  { value: "less-want", label: "好像没有那么想" },
  { value: "skip", label: "我不想回答这个问题" },
];

const refusalOptions: Array<{ value: RefusalSafety; label: string }> = [
  { value: "can", label: "可以" },
  { value: "difficult-but-possible", label: "有一点难但我觉得可以" },
  { value: "fear-reaction", label: "我担心对方会有不好的反应" },
  { value: "cannot-refuse", label: "我觉得自己不能拒绝" },
  { value: "unsure", label: "我还不确定" },
];

const expressionOptions: Array<{ value: ExpressionDifficulty; label: string }> = [
  { value: "can-say", label: "我大概能说出来" },
  { value: "needs-phrase", label: "我可能需要一句更容易说出口的话" },
  { value: "not-ready", label: "我现在还不太敢表达" },
  { value: "unsure", label: "我还不知道" },
];

const comfortClarityOptions: Array<{ value: ComfortClarity; label: string }> = [
  { value: "mostly-clear", label: "我大致知道" },
  { value: "need-space", label: "我有一些感觉，想停下来理清楚" },
];

const journalPrompts = [
  { id: "journal-expecting", label: "我现在最期待的是……" },
  { id: "journal-considering", label: "我正在顾及的是……" },
  { id: "journal-hesitation", label: "我还有一点犹豫，因为……" },
  { id: "journal-after", label: "如果真的尝试了，我想在之后留意……" },
  { id: "journal-own-words", label: "我想用自己的话记录" },
] as const;

function createValue(initialValue: Partial<ReflectionValue>): ReflectionValue {
  return {
    motivationIds: [...(initialValue.motivationIds ?? [])],
    pressureWithoutDisappointment: initialValue.pressureWithoutDisappointment ?? null,
    refusalSafety: initialValue.refusalSafety ?? null,
    expressionDifficulty: initialValue.expressionDifficulty ?? null,
    comfortClarity: initialValue.comfortClarity ?? null,
    comfortNeedIds: [...(initialValue.comfortNeedIds ?? [])],
    comfortNote: initialValue.comfortNote ?? "",
    ...(initialValue.journalPromptId ? { journalPromptId: initialValue.journalPromptId } : {}),
    journalText: initialValue.journalText ?? "",
    journalSaveChoice: initialValue.journalSaveChoice ?? "not-saved",
  };
}

function cloneValue(value: ReflectionValue): ReflectionValue {
  return { ...value, motivationIds: [...value.motivationIds], comfortNeedIds: [...value.comfortNeedIds] };
}

function persistedValue(value: ReflectionValue): ReflectionValue {
  if (value.journalSaveChoice === "device") return cloneValue(value);
  const withoutPrompt = cloneValue(value);
  delete withoutPrompt.journalPromptId;
  return { ...withoutPrompt, journalText: "", journalSaveChoice: "not-saved" };
}

function cardHasContent(
  cardId: ReflectionCardId,
  value: ReflectionValue,
  includeSessionJournal = false,
): boolean {
  if (cardId === "motivation") {
    return value.motivationIds.length > 0 || value.pressureWithoutDisappointment !== null;
  }
  if (cardId === "safety") return value.refusalSafety !== null;
  if (cardId === "expression") return value.expressionDifficulty !== null;
  if (cardId === "comfort") {
    return value.comfortClarity !== null || value.comfortNeedIds.length > 0 || value.comfortNote.trim().length > 0;
  }
  return value.journalText.trim().length > 0
    && (value.journalSaveChoice === "device" || includeSessionJournal);
}

function clearCardValue(cardId: ReflectionCardId, value: ReflectionValue): ReflectionValue {
  if (cardId === "motivation") {
    return { ...cloneValue(value), motivationIds: [], pressureWithoutDisappointment: null };
  }
  if (cardId === "safety") return { ...cloneValue(value), refusalSafety: null };
  if (cardId === "expression") return { ...cloneValue(value), expressionDifficulty: null };
  if (cardId === "comfort") {
    return { ...cloneValue(value), comfortClarity: null, comfortNeedIds: [], comfortNote: "" };
  }
  const withoutPrompt = cloneValue(value);
  delete withoutPrompt.journalPromptId;
  return { ...withoutPrompt, journalText: "", journalSaveChoice: "not-saved" };
}

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function SectionTitle({ children, questionRef }: { children: string; questionRef?: RefObject<Text | null> }) {
  const styles = createStyles(useTheme());
  return (
    <Text accessibilityRole="header" ref={questionRef} selectable style={styles.question}>
      {children}
    </Text>
  );
}

function SupportingCopy({ children }: { children: string }) {
  const styles = createStyles(useTheme());
  return <Text selectable style={styles.supporting}>{children}</Text>;
}

export function ReflectionPage({
  initialValue = {},
  behaviorAnswers = [],
  onCardVisibilityChange,
  onEditBehaviorAttitude,
  onOpenComfort,
  onOpenJournal,
  onSetJournalSaveNotice,
  onSave,
  onUsePracticePhrase,
  onComplete,
  reducedMotion,
  resolveFocusHandle = findNodeHandle,
  showLocalJournalSaveNotice = true,
  storageMode = "device",
}: ReflectionPageProps) {
  const theme = useTheme();
  const { reveal } = useJourneyGuidedScroll();
  const systemReducedMotion = useReducedMotion();
  const shouldReduceMotion = reducedMotion ?? systemReducedMotion;
  const styles = createStyles(theme);
  const { height } = useWindowDimensions();
  const flipRotation = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const questionRef = useRef<Text>(null);
  const triggerRefs = useRef<Record<ReflectionCardId, View | null>>({
    comfort: null,
    expression: null,
    journal: null,
    motivation: null,
    safety: null,
  });
  const journalStorageReturnFocusRef = useRef<View>(null);
  const clearReturnFocusRef = useRef<View>(null);
  const [savedValue, setSavedValue] = useState(() => createValue(initialValue));
  const [draftValue, setDraftValue] = useState(() => createValue(initialValue));
  const [activeCardId, setActiveCardId] = useState<ReflectionCardId | null>(null);
  const [cardFace, setCardFace] = useState<CardFace>("front");
  const [animating, setAnimating] = useState(false);
  const [journalStorageOpen, setJournalStorageOpen] = useState(false);
  const [hideFutureJournalNotice, setHideFutureJournalNotice] = useState(false);
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const [localBehaviorAnswers, setLocalBehaviorAnswers] = useState(() => [...behaviorAnswers]);
  const [editingBehaviorId, setEditingBehaviorId] = useState<string | null>(null);
  const advancedCardsRef = useRef(new Set<ReflectionCardId>());
  const flipDuration = Math.round(theme.motion.duration.slow / 2);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

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

  const openCard = async (cardId: ReflectionCardId) => {
    if (animating || activeCardId !== null) return;
    if (shouldReduceMotion) {
      setActiveCardId(cardId);
      setDraftValue(cloneValue(savedValue));
      setCardFace("back");
      setHideFutureJournalNotice(false);
      onCardVisibilityChange?.(true);
      const title = cards.find(({ id }) => id === cardId)?.title ?? "反思卡";
      AccessibilityInfo.announceForAccessibility(`${title}，已展开`);
      await frame();
      if (mountedRef.current) focusQuestion();
      return;
    }
    setAnimating(true);
    setActiveCardId(cardId);
    setDraftValue(cloneValue(savedValue));
    setCardFace("front");
    setHideFutureJournalNotice(false);
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
    const title = cards.find(({ id }) => id === cardId)?.title ?? "反思卡";
    AccessibilityInfo.announceForAccessibility(`${title}，已展开`);
    focusQuestion();
  };

  const returnToGallery = async () => {
    if (animating) return;
    if (shouldReduceMotion) {
      const title = cards.find(({ id }) => id === activeCardId)?.title;
      const trigger = activeCardId === null ? null : triggerRefs.current[activeCardId];
      setCardFace("front");
      setActiveCardId(null);
      onCardVisibilityChange?.(false);
      await frame();
      const triggerNode = resolveFocusHandle(trigger ?? null);
      if (triggerNode !== null) AccessibilityInfo.setAccessibilityFocus(triggerNode);
      if (title) AccessibilityInfo.announceForAccessibility(`${title}，已返回所有卡牌`);
      return;
    }
    setAnimating(true);
    const trigger = activeCardId === null ? null : triggerRefs.current[activeCardId];
    await animateTo(90);
    if (!mountedRef.current) return;
    setCardFace("front");
    flipRotation.setValue(-90);
    await frame();
    if (!mountedRef.current) return;
    await animateTo(0);
    if (!mountedRef.current) return;
    const title = cards.find(({ id }) => id === activeCardId)?.title;
    setActiveCardId(null);
    setAnimating(false);
    onCardVisibilityChange?.(false);
    await frame();
    const triggerNode = resolveFocusHandle(trigger ?? null);
    if (triggerNode !== null) AccessibilityInfo.setAccessibilityFocus(triggerNode);
    if (title) AccessibilityInfo.announceForAccessibility(`${title}，已返回所有卡牌`);
  };

  const saveValueAndReturn = async (nextValue: ReflectionValue) => {
    const normalized = storageMode === "session-only"
      ? { ...cloneValue(nextValue), journalSaveChoice: "not-saved" as const }
      : persistedValue(nextValue);
    if (storageMode === "device") await onSave?.(normalized);
    setSavedValue(normalized);
    setDraftValue(cloneValue(normalized));
    await returnToGallery();
  };

  const saveActiveCard = async () => {
    if (activeCardId === null) return;
    await saveValueAndReturn(draftValue);
  };

  const saveJournal = async () => {
    if (storageMode === "session-only") {
      await saveValueAndReturn({ ...draftValue, journalSaveChoice: "not-saved" });
      return;
    }
    if (hideFutureJournalNotice) await onSetJournalSaveNotice?.(false);
    await saveValueAndReturn({ ...draftValue, journalSaveChoice: "device" });
    setJournalStorageOpen(false);
  };

  const startJournalSave = () => {
    if (storageMode === "session-only") return saveJournal();
    if (showLocalJournalSaveNotice) {
      setJournalStorageOpen(true);
      return;
    }
    return saveJournal();
  };

  const clearActiveCard = async () => {
    if (activeCardId === null) return;
    const cleared = clearCardValue(activeCardId, savedValue);
    if (storageMode === "device") await onSave?.(persistedValue(cleared));
    setSavedValue(cleared);
    setDraftValue(cloneValue(cleared));
    setClearConfirmationOpen(false);
    await returnToGallery();
  };

  const toggleMotivation = (id: string) => {
    setDraftValue((current) => {
      if (id === skipMotivationId) {
        return {
          ...current,
          motivationIds: current.motivationIds.includes(id) ? [] : [id],
          pressureWithoutDisappointment: null,
        };
      }
      const withoutSkip = current.motivationIds.filter((value) => value !== skipMotivationId);
      const motivationIds = withoutSkip.includes(id)
        ? withoutSkip.filter((value) => value !== id)
        : [...withoutSkip, id];
      return {
        ...current,
        motivationIds,
        pressureWithoutDisappointment: motivationIds.includes(disappointmentMotivationId)
          ? current.pressureWithoutDisappointment
          : null,
      };
    });
    if (activeCardId !== null && !advancedCardsRef.current.has(activeCardId)) {
      advancedCardsRef.current.add(activeCardId);
      reveal("reflection-card-active-action");
    }
  };

  const toggleComfort = (id: string) => {
    setDraftValue((current) => ({
      ...current,
      comfortNeedIds: current.comfortNeedIds.includes(id)
        ? current.comfortNeedIds.filter((value) => value !== id)
        : [...current.comfortNeedIds, id],
    }));
    if (activeCardId !== null && !advancedCardsRef.current.has(activeCardId)) {
      advancedCardsRef.current.add(activeCardId);
      reveal("reflection-card-active-action");
    }
  };

  const updateSingleCard = <Key extends "pressureWithoutDisappointment" | "refusalSafety" | "expressionDifficulty" | "comfortClarity" | "journalPromptId">(
    key: Key,
    value: ReflectionValue[Key],
  ) => {
    setDraftValue((current) => ({ ...current, [key]: value }));
    if (activeCardId !== null && !advancedCardsRef.current.has(activeCardId)) {
      advancedCardsRef.current.add(activeCardId);
      reveal("reflection-card-active-action");
    }
  };

  const saveBehaviorAttitude = async (behaviorId: string, attitude: BehaviorAttitude) => {
    await onEditBehaviorAttitude?.(behaviorId, attitude);
    setLocalBehaviorAnswers((current) => current.map((answer) => answer.behaviorId === behaviorId
      ? { ...answer, attitude }
      : answer));
    setEditingBehaviorId(null);
  };

  const activeCard = cards.find(({ id }) => id === activeCardId);
  const activeHasSavedContent = activeCardId !== null
    && cardHasContent(activeCardId, savedValue, storageMode === "session-only");
  const activeDraftHasContent = activeCardId === "journal"
    ? draftValue.journalText.trim().length > 0
    : activeCardId !== null && cardHasContent(activeCardId, draftValue);
  const showsRefusalSafety = draftValue.refusalSafety === "fear-reaction"
    || draftValue.refusalSafety === "cannot-refuse"
    || draftValue.refusalSafety === "unsure";
  const rotation = flipRotation.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ["-90deg", "0deg", "90deg"],
  });

  if (activeCardId !== null && activeCard) {
    return (
      <JourneyScrollTarget targetId="reflection-card-active">
      <Animated.View
        accessibilityState={{ busy: animating }}
        style={[styles.fullPage, { minHeight: Math.max(520, height - 180) }, shouldReduceMotion ? undefined : { transform: [{ perspective: 1000 }, { rotateY: rotation }] }]}
        testID="reflection-card-fullscreen"
      >
        {cardFace === "front" ? (
          <View style={styles.fullFront}>
            <Text accessibilityRole="header" selectable style={styles.fullFrontTitle}>{activeCard.title}</Text>
            <Text selectable style={styles.frontStatus}>
              {activeHasSavedContent ? "已留下反思 · 点击修改" : "尚未记录"}
            </Text>
          </View>
        ) : (
          <View style={styles.fullBack} testID={`reflection-card-back-${activeCardId}`}>
            {activeCardId === "motivation" ? (
              <>
                <SectionTitle questionRef={questionRef}>此刻，是什么在推动我靠近？</SectionTitle>
                <SupportingCopy>可以选择不止一个答案，也没有哪一种动机更加正确。</SupportingCopy>
                <View style={styles.options}>
                  {motivationOptions.map((option) => (
                    <JourneyChoice key={option.id} label={option.label} onSelect={() => toggleMotivation(option.id)} selected={draftValue.motivationIds.includes(option.id)} />
                  ))}
                </View>
                {draftValue.motivationIds.includes(disappointmentMotivationId) ? (
                  <InfoCard variant="pause">
                    <SupportingCopy>顾及对方的感受，并不意味着你做错了什么。你仍然可以放慢、暂停或改变主意。</SupportingCopy>
                    <SectionTitle>如果暂时不用担心对方会不会失望，你此刻还想靠近吗？</SectionTitle>
                    <View accessibilityRole="radiogroup" style={styles.options}>
                      {pressureOptions.map((option) => (
                        <JourneyChoice
                          accessibilityLabel={`如果不用担心失望：${option.label}`}
                          key={option.value}
                          label={option.label}
                          mode="single"
                          onSelect={() => updateSingleCard("pressureWithoutDisappointment", option.value)}
                          selected={draftValue.pressureWithoutDisappointment === option.value}
                        />
                      ))}
                    </View>
                    <SupportingCopy>这道题不会覆盖你之前对任何行为留下的答案。</SupportingCopy>
                    {draftValue.pressureWithoutDisappointment === "still-want" || draftValue.pressureWithoutDisappointment === "slow-down" ? (
                      <InfoCard variant="education">
                        <SupportingCopy>{slowDownPhrase}</SupportingCopy>
                        {onUsePracticePhrase ? (
                          <JourneyAction
                            label="把这句慢下来带到练习里"
                            loadingLabel="正在加入…"
                            onAction={() => onUsePracticePhrase(slowDownPhrase)}
                          />
                        ) : null}
                      </InfoCard>
                    ) : null}
                    {draftValue.pressureWithoutDisappointment === "less-want" ? (
                      <InfoCard variant="pause"><SupportingCopy>我知道你可能有所期待，但我现在不想尝试这件事。</SupportingCopy></InfoCard>
                    ) : null}
                  </InfoCard>
                ) : null}
              </>
            ) : null}

            {activeCardId === "safety" ? (
              <>
                <SectionTitle questionRef={questionRef}>此刻，你觉得自己可以说不、暂停或离开吗？</SectionTitle>
                <View accessibilityRole="radiogroup" style={styles.options}>
                  {refusalOptions.map((option) => (
                    <JourneyChoice
                      accessibilityLabel={`拒绝或离开：${option.label}`}
                      key={option.value}
                      label={option.label}
                      mode="single"
                      onSelect={() => updateSingleCard("refusalSafety", option.value)}
                      selected={draftValue.refusalSafety === option.value}
                    />
                  ))}
                </View>
                {showsRefusalSafety ? (
                  <InfoCard variant="safety">
                    <SupportingCopy>如果说不、暂停或离开让你感到害怕，可以先把自己的安全和空间放在前面。你不需要马上作出关于亲密行为的决定。</SupportingCopy>
                    <SupportingCopy>这不代表系统已经判断现实中正在发生危险。</SupportingCopy>
                    {onOpenComfort ? (
                      <JourneyAction label="看看什么能让我更安心" loadingLabel="正在打开…" onAction={onOpenComfort} />
                    ) : null}
                    {onOpenJournal ? (
                      <JourneyAction label="先回到我的记录里" loadingLabel="正在打开…" onAction={onOpenJournal} />
                    ) : null}
                  </InfoCard>
                ) : null}
              </>
            ) : null}

            {activeCardId === "expression" ? (
              <>
                <SectionTitle questionRef={questionRef}>如果感受发生变化，你觉得自己能让对方知道吗？</SectionTitle>
                <View accessibilityRole="radiogroup" style={styles.options}>
                  {expressionOptions.map((option) => (
                    <JourneyChoice
                      accessibilityLabel={`表达变化：${option.label}`}
                      key={option.value}
                      label={option.label}
                      mode="single"
                      onSelect={() => updateSingleCard("expressionDifficulty", option.value)}
                      selected={draftValue.expressionDifficulty === option.value}
                    />
                  ))}
                </View>
                {draftValue.expressionDifficulty === "needs-phrase" ? (
                  <InfoCard variant="education"><SupportingCopy>下一步会给你几句可以直接使用、也可以修改的表达。</SupportingCopy></InfoCard>
                ) : null}
                {draftValue.expressionDifficulty === "not-ready" ? (
                  <InfoCard variant="pause">
                    <SupportingCopy>{`说不出口，不代表你的暂停不重要。可以先从一句很短的话开始：${stopPhrase}`}</SupportingCopy>
                    {onUsePracticePhrase ? (
                      <JourneyAction
                        label="把这句话带到练习里"
                        loadingLabel="正在加入…"
                        onAction={() => onUsePracticePhrase(stopPhrase)}
                      />
                    ) : null}
                    <JourneyAction
                      label="先不选择"
                      loadingLabel="正在收起…"
                      onAction={() => setDraftValue((current) => ({ ...current, expressionDifficulty: null }))}
                    />
                  </InfoCard>
                ) : null}
              </>
            ) : null}

            {activeCardId === "comfort" ? (
              <>
                <SectionTitle questionRef={questionRef}>这个夜晚，如果要继续靠近，什么会让我更安心？</SectionTitle>
                <View accessibilityRole="radiogroup" style={styles.options}>
                  {comfortClarityOptions.map((option) => (
                    <JourneyChoice
                      accessibilityLabel={`安心清晰度：${option.label}`}
                      key={option.value}
                      label={option.label}
                      mode="single"
                      onSelect={() => updateSingleCard("comfortClarity", option.value)}
                      selected={draftValue.comfortClarity === option.value}
                    />
                  ))}
                </View>
                {draftValue.comfortClarity === "need-space" ? (
                  <SupportingCopy>不需要马上找到完整答案。可以想一想希望怎样被询问、节奏如何变化，以及暂停以后希望发生什么。</SupportingCopy>
                ) : null}
                <View style={styles.options}>
                  {comfortOptions.map((option) => (
                    <JourneyChoice key={option.id} label={option.label} onSelect={() => toggleComfort(option.id)} selected={draftValue.comfortNeedIds.includes(option.id)} />
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="安心条件补充"
                  maxLength={500}
                  multiline
                  onChangeText={(comfortNote) => setDraftValue((current) => ({ ...current, comfortNote }))}
                  placeholder="对我来说，更安心的是……"
                  placeholderTextColor={theme.color.textTertiary}
                  selectionColor={theme.color.primary}
                  style={styles.comfortInput}
                  value={draftValue.comfortNote}
                />
              </>
            ) : null}

            {activeCardId === "journal" ? (
              <>
                <SectionTitle questionRef={questionRef}>给此刻留一句话</SectionTitle>
                <SupportingCopy>没有标准答案，也不需要写得完整。空白也可以返回。</SupportingCopy>
                <View accessibilityRole="radiogroup" style={styles.options}>
                  {journalPrompts.map((prompt) => (
                    <JourneyChoice
                      accessibilityLabel={`写作提示：${prompt.label}`}
                      key={prompt.id}
                      label={prompt.label}
                      mode="single"
                      onSelect={() => updateSingleCard("journalPromptId", prompt.id)}
                      selected={draftValue.journalPromptId === prompt.id}
                    />
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="给此刻留一句话"
                  maxLength={1200}
                  multiline
                  onChangeText={(journalText) => setDraftValue((current) => ({ ...current, journalText }))}
                  placeholder="写下此刻想记住的感受"
                  placeholderTextColor={theme.color.textTertiary}
                  selectionColor={theme.color.primary}
                  style={styles.journalInput}
                  value={draftValue.journalText}
                />
                {storageMode === "session-only" ? (
                  <SupportingCopy>仅用于本次回顾，离开后内容会清除。</SupportingCopy>
                ) : null}
              </>
            ) : null}

            <JourneyScrollTarget targetId="reflection-card-active-action">
              <JourneyAction
                disabled={!activeDraftHasContent || animating}
                errorMessage="保存反思失败，请重试。"
                label={activeCardId === "journal" ? "保存这句话并返回" : "保存这张卡并返回"}
                loadingLabel="正在保存…"
                onAction={activeCardId === "journal" ? startJournalSave : saveActiveCard}
                ref={activeCardId === "journal" ? journalStorageReturnFocusRef : undefined}
              />
            </JourneyScrollTarget>
            <TextAction disabled={animating} label="暂不记录，返回所有卡牌" onPress={() => { void returnToGallery(); }} />
            {activeHasSavedContent ? <TextAction ref={clearReturnFocusRef} disabled={animating} label="清除此卡的记录" onPress={() => setClearConfirmationOpen(true)} /> : null}
          </View>
        )}

        <BottomSheet onClose={() => setJournalStorageOpen(false)} returnFocusRef={journalStorageReturnFocusRef} title="记录会保存在哪里？" visible={storageMode === "device" && journalStorageOpen}>
          <SupportingCopy>记录不会上传到云端。更换设备、删除 App 或清除数据后，可能无法找回。</SupportingCopy>
          <SupportingCopy>如果其他人能够打开你的设备和 CAVE，也可能看到这些记录。</SupportingCopy>
          <JourneyChoice
            label="以后默认保存在本机，不再显示此提示"
            onSelect={() => setHideFutureJournalNotice((current) => !current)}
            selected={hideFutureJournalNotice}
          />
          <JourneyAction disabled label="同时保存到云端｜后续版本" loadingLabel="正在保存…" />
          <SupportingCopy>云端保存尚未实现；这里不会模拟上传或成功状态。</SupportingCopy>
          <JourneyAction errorMessage="保存设置或记录失败，请重试。" label="确认只保存在这台设备" loadingLabel="正在保存…" onAction={saveJournal} />
          <TextAction label="返回修改" onPress={() => setJournalStorageOpen(false)} />
        </BottomSheet>

        <BottomSheet onClose={() => setClearConfirmationOpen(false)} returnFocusRef={clearReturnFocusRef} title="清除此卡的记录？" visible={clearConfirmationOpen}>
          <SupportingCopy>这会清空这张卡已经保存的答案，但不会撤销之前获得的参与记录。</SupportingCopy>
          <JourneyAction errorMessage="清除失败，请重试。" label="确认清除此卡的记录" loadingLabel="正在清除…" onAction={clearActiveCard} />
          <TextAction label="保留这张卡" onPress={() => setClearConfirmationOpen(false)} />
        </BottomSheet>
      </Animated.View>
      </JourneyScrollTarget>
    );
  }

  return (
    <View style={styles.page} testID="page-4-content">
      <View style={styles.intro}>
        <Text accessibilityRole="header" selectable style={styles.introTitle}>你准备了多少，不代表你做得好不好。</Text>
        <SupportingCopy>答案可以随时改变；这里不会生成分数或准备度结论。</SupportingCopy>
      </View>
      {localBehaviorAnswers.length > 0 ? (
        <Card accessible={false}>
          <SectionTitle>这是你刚才留下的答案</SectionTitle>
          {reviewGroups.map((group) => {
            const answers = localBehaviorAnswers.filter(({ attitude }) => attitude === group.attitude);
            return answers.length > 0 ? (
              <View key={group.attitude} style={styles.options}>
                <Text selectable style={styles.frontTitle}>{group.label}</Text>
                {answers.map((answer) => (
                  <View key={answer.behaviorId} style={styles.options}>
                    <JourneyAction
                      accessibilityLabel={`修改${answer.behaviorLabel}的答案`}
                      label={answer.behaviorLabel}
                      loadingLabel="正在展开…"
                      onAction={onEditBehaviorAttitude
                        ? () => setEditingBehaviorId((current) => current === answer.behaviorId ? null : answer.behaviorId)
                        : undefined}
                    />
                    {editingBehaviorId === answer.behaviorId ? (
                      <View accessibilityRole="radiogroup" style={styles.options}>
                        <SupportingCopy>{`正在修改：${answer.behaviorLabel}`}</SupportingCopy>
                        {reviewGroups.map((option) => (
                          <JourneyChoice
                            accessibilityLabel={`修改${answer.behaviorLabel}：${option.label}`}
                            key={option.attitude}
                            label={option.label}
                            mode="single"
                            onSelect={() => saveBehaviorAttitude(answer.behaviorId, option.attitude)}
                            selected={answer.attitude === option.attitude}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null;
          })}
          <SupportingCopy>这是你此刻的感受，不需要整齐，也可以随时改变。</SupportingCopy>
          <SupportingCopy>此页的其他反思仍保留在当前页面。</SupportingCopy>
        </Card>
      ) : null}
      <View style={styles.grid} testID="reflection-card-grid">
        {cards.map((card) => {
          const recorded = cardHasContent(card.id, savedValue, storageMode === "session-only");
          return (
            <Pressable
              accessibilityHint={recorded ? "点击修改已经留下的反思" : "点击翻到卡牌反面"}
              accessibilityLabel={`${card.title}，${recorded ? "已留下反思，点击修改" : "尚未记录"}`}
              accessibilityRole="button"
              accessibilityState={{ selected: recorded }}
              key={card.id}
              onPress={() => { void openCard(card.id); }}
              ref={(node) => { triggerRefs.current[card.id] = node; }}
              style={({ pressed }) => [styles.frontCard, card.id === "journal" ? styles.fullWidthCard : null, pressed ? styles.frontCardPressed : null]}
              testID={`reflection-card-front-${card.id}`}
            >
              <Text selectable style={styles.frontTitle}>{card.title}</Text>
              <Text selectable style={styles.frontStatus}>{recorded ? "已留下反思 · 点击修改" : "尚未记录"}</Text>
            </Pressable>
          );
        })}
      </View>
      <JourneyScrollTarget targetId="reflection-final-action">
      <JourneyAction
        accessibilityLabel={storageMode === "session-only" ? "完成本次回顾" : "带着这些发现去练习"}
        errorMessage={storageMode === "session-only" ? "完成回顾失败，请重试。" : "保存反思失败，请重试。"}
        label={storageMode === "session-only" ? "完成本次回顾" : "带着这些发现去练习"}
        loadingLabel={storageMode === "session-only" ? "正在完成回顾…" : "正在保存这些发现…"}
        onAction={() => onComplete(persistedValue(savedValue))}
      />
      </JourneyScrollTarget>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const textInputStyle = {
    ...theme.typography.body,
    backgroundColor: theme.color.surfaceSubtle,
    borderColor: theme.color.border,
    borderCurve: "continuous" as const,
    borderRadius: theme.radius.control,
    borderWidth: theme.border.width,
    color: theme.color.text,
    padding: theme.space.md,
    textAlignVertical: "top" as const,
    width: "100%" as const,
  };

  return {
  page: { flexGrow: 1, gap: theme.space.xl, maxWidth: "100%" as const, width: "100%" as const },
  intro: { gap: theme.space.sm, width: "100%" as const },
  introTitle: { ...theme.typography.heading, color: theme.color.text, flexShrink: 1 },
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: theme.space.md, justifyContent: "space-between" as const, width: "100%" as const },
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
  fullWidthCard: { width: "100%" as const },
  frontCardPressed: { backgroundColor: theme.color.surfacePressed, borderColor: theme.color.brandSoft },
  frontTitle: { ...theme.typography.cardTitle, color: theme.color.text, flexShrink: 1 },
  frontStatus: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
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
  fullBack: { flexGrow: 1, gap: theme.space.lg, width: "100%" as const },
  question: { ...theme.typography.title, color: theme.color.text, flexShrink: 1 },
  supporting: { ...theme.typography.body, color: theme.color.textSecondary, flexShrink: 1 },
  options: { gap: theme.space.compact, width: "100%" as const },
  comfortInput: { ...textInputStyle, minHeight: 112 },
  journalInput: { ...textInputStyle, minHeight: 152 },
  };
}
