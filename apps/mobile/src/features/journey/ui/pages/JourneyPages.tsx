import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { brand } from "../../../../config/brand";
import { theme } from "../../../../core/design/theme";
import { Card } from "../../../../core/ui/Card";
import type { PartnerResponseBranch, PracticeIntent } from "../../domain/practice-types";
import type { BehaviorAttitude, ChecklistItemStatus, JournalSaveChoice } from "../../domain/types";
import { JourneyAction } from "../components/JourneyAction";
import { JourneyChoice } from "../components/JourneyChoice";
import { JourneyStatusBanner } from "../components/JourneyStatusBanner";
import type {
  JourneyAction as JourneyActionCallback,
  JourneyAsyncState,
  JourneyCapabilities,
  JourneyRuntimeNotice
} from "../journey-ui-contracts";

type CallbackResult = ReturnType<JourneyActionCallback>;

const COMMUNICATION_CARD_SECTION_LABELS: Readonly<Record<string, string>> = {
  intentions: "期待",
  boundaries: "不希望",
  pace: "当时再感受",
  comfort: "安心条件",
  practical: "确认与暂停",
  aftercare: "改变时表达"
};

function communicationCardSectionLabel(id: string): string {
  return COMMUNICATION_CARD_SECTION_LABELS[id] ?? "沟通卡内容";
}

function PageTitle({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" selectable style={styles.title}>{children}</Text>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" selectable style={styles.heading}>{children}</Text>;
}

function BodyCopy({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text selectable style={[styles.body, muted && styles.mutedText]}>{children}</Text>;
}

function PrimaryActions({ children, page }: { children: ReactNode; page: number }) {
  return (
    <View style={styles.primaryActions} testID={`page-${page}-primary-actions`}>
      {children}
    </View>
  );
}

function isPromiseResult(result: CallbackResult): result is Promise<void> {
  return result !== undefined && typeof (result as Promise<void>).then === "function";
}

function usePendingActions() {
  const [pendingCount, setPendingCount] = useState(0);
  const pendingCountRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const finish = () => {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
    if (mountedRef.current) {
      setPendingCount((current) => Math.max(0, current - 1));
    }
  };

  const run = (
    action: () => CallbackResult,
    onSuccess?: () => void,
    onSettled?: () => void
  ): CallbackResult => {
    pendingCountRef.current += 1;
    if (mountedRef.current) {
      setPendingCount((current) => current + 1);
    }
    const settle = () => {
      if (mountedRef.current) onSettled?.();
      finish();
    };
    try {
      const result = action();
      if (isPromiseResult(result)) {
        return Promise.resolve(result)
          .then(() => { onSuccess?.(); })
          .finally(settle);
      }
      onSuccess?.();
      settle();
    } catch (error) {
      settle();
      throw error;
    }
  };

  return { pendingCount, pendingCountRef, run };
}

export function WelcomePage(props: {
  onAdult(): CallbackResult;
  onUnderage(): CallbackResult;
  onOpenPreface(): CallbackResult;
  resumeAvailable: boolean;
  onResume?: () => CallbackResult;
  onRestart?: () => CallbackResult;
}) {
  return (
    <View style={styles.page} testID="page-1-content">
      <Card accessibilityLabel="内界 CAVE 品牌介绍" testID="page-1-card-brand" variant="accent">
        <PageTitle>{brand.displayName}</PageTitle>
        <Text selectable style={styles.slogan}>{brand.slogan}</Text>
      </Card>
      <Card accessible={false} testID="page-1-card-preface" variant="muted">
        <SectionTitle>开始之前</SectionTitle>
        <BodyCopy muted>能力与局限短笺可以跳过，成年确认只需选择年龄范围。</BodyCopy>
        <JourneyAction label="阅读能力与局限短笺" loadingLabel="正在打开…" onAction={props.onOpenPreface} />
      </Card>
      <Card accessible={false} testID="page-1-card-entry">
        <PrimaryActions page={1}>
          {props.resumeAvailable ? (
            <JourneyAction
              disabled={props.onResume === undefined}
              label="继续本机旅程"
              loadingLabel="正在恢复…"
              onAction={props.onResume}
            />
          ) : null}
          <JourneyAction label="我已满18岁" loadingLabel="正在继续…" onAction={props.onAdult} />
          <JourneyAction label="我未满18岁" loadingLabel="正在继续…" onAction={props.onUnderage} />
          {props.resumeAvailable ? (
            <JourneyAction
              disabled={props.onRestart === undefined}
              label="重新开始（需要确认）"
              loadingLabel="正在重新开始…"
              onAction={props.onRestart}
            />
          ) : null}
        </PrimaryActions>
      </Card>
    </View>
  );
}

export function OvernightPage(props: {
  expectationOptions: Array<{ id: string; label: string }>;
  concernOptions: Array<{ id: string; label: string }>;
  onContinue(input: { expectationIds: string[]; concernIds: string[]; customNote: string }): CallbackResult;
  initialExpectationIds?: string[];
  initialConcernIds?: string[];
  initialCustomNote?: string;
  actionState?: JourneyAsyncState;
}) {
  const [expectationIds, setExpectationIds] = useState<string[]>(() => [...(props.initialExpectationIds ?? [])]);
  const [concernIds, setConcernIds] = useState<string[]>(() => [...(props.initialConcernIds ?? [])]);
  const [customNote, setCustomNote] = useState(props.initialCustomNote ?? "");

  const toggle = (ids: string[], id: string, update: (next: string[]) => void) => {
    update(ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  };

  return (
    <View style={styles.page} testID="page-2-content">
      <Card accessibilityLabel="过夜情境说明" testID="page-2-card-intro" variant="muted">
        <PageTitle>过夜情境</PageTitle>
        <BodyCopy>过夜不代表会发生性行为，也不代表任何事一定会发生。</BodyCopy>
      </Card>
      <Card accessible={false} testID="page-2-card-expectations">
        <SectionTitle>我对过夜情境的期待</SectionTitle>
        <View style={styles.choiceGroup}>
          {props.expectationOptions.map((option) => (
            <JourneyChoice
              key={option.id}
              label={option.label}
              onSelect={() => toggle(expectationIds, option.id, setExpectationIds)}
              selected={expectationIds.includes(option.id)}
            />
          ))}
        </View>
      </Card>
      <Card accessible={false} testID="page-2-card-concerns">
        <SectionTitle>我在意或担心的事</SectionTitle>
        <View style={styles.choiceGroup}>
          {props.concernOptions.map((option) => (
            <JourneyChoice
              key={option.id}
              label={option.label}
              onSelect={() => toggle(concernIds, option.id, setConcernIds)}
              selected={concernIds.includes(option.id)}
            />
          ))}
        </View>
      </Card>
      <Card accessible={false} testID="page-2-card-note">
        <SectionTitle>可选补充</SectionTitle>
        <TextInput
          accessibilityLabel="过夜情境可选补充"
          maxLength={240}
          multiline
          onChangeText={setCustomNote}
          placeholder="可选补充"
          placeholderTextColor={theme.color.textMuted}
          selectionColor={theme.color.primary}
          style={styles.input}
          value={customNote}
        />
      </Card>
      {props.actionState?.status === "loading" && props.actionState.message ? (
        <JourneyStatusBanner message={props.actionState.message} />
      ) : null}
      <PrimaryActions page={2}>
        <JourneyAction
          actionState={props.actionState}
          errorMessage="保存失败，请重试。"
          label="继续"
          loadingLabel="正在继续…"
          onAction={() => props.onContinue({ expectationIds, concernIds, customNote })}
        />
      </PrimaryActions>
    </View>
  );
}

export function BodyKnowledgePage(props: {
  cards: Array<{ id: string; title: string; sourceIds: string[] }>;
  onRead(id: string): CallbackResult;
  onOpenDiagram(): CallbackResult;
  onOpenSources(sourceIds: string[]): CallbackResult;
  onContinue?: () => CallbackResult;
}) {
  const [diagramOpen, setDiagramOpen] = useState(false);

  return (
    <View style={styles.page} testID="page-3-content">
      <Card accessible={false} testID="page-3-card-diagram" variant="muted">
        <PageTitle>身体知识</PageTitle>
        <BodyCopy muted>医学图示需要主动展开；当前仍是待审核的明确占位。</BodyCopy>
        <JourneyAction
          label="主动展开医学图示"
          loadingLabel="正在打开…"
          onAction={() => {
            setDiagramOpen(true);
            return props.onOpenDiagram();
          }}
        />
        {diagramOpen ? <BodyCopy>医学图示将在内容完善阶段替换</BodyCopy> : null}
      </Card>
      {props.cards.map((card) => (
        <Card accessible={false} key={card.id} testID={`page-3-card-${card.id}`}>
          <SectionTitle>{card.title}</SectionTitle>
          <JourneyAction
            label={`标记已读：${card.title}`}
            loadingLabel="正在记录…"
            onAction={() => props.onRead(card.id)}
          />
          <JourneyAction
            label={`查看来源：${card.title}`}
            loadingLabel="正在打开…"
            onAction={() => props.onOpenSources(card.sourceIds)}
          />
        </Card>
      ))}
      {props.onContinue === undefined ? null : (
        <PrimaryActions page={3}>
          <JourneyAction label="继续" loadingLabel="正在继续…" onAction={props.onContinue} />
        </PrimaryActions>
      )}
    </View>
  );
}

const ATTITUDES: Array<{ value: BehaviorAttitude; label: string }> = [
  { value: "looking-forward", label: "期待" },
  { value: "decide-in-moment", label: "到时决定" },
  { value: "unsure", label: "不确定" },
  { value: "not-this-time", label: "这次不要" },
  { value: "skip", label: "暂时不回答" }
];

export function BehaviorAttitudesPage(props: {
  behaviors: Array<{ id: string; label: string }>;
  onSet(id: string, attitude: BehaviorAttitude): CallbackResult;
  initialAttitudes?: Record<string, BehaviorAttitude>;
  currentAttitudes?: Record<string, BehaviorAttitude>;
  onContinue?: () => CallbackResult;
}) {
  const [attitudes, setAttitudes] = useState<Record<string, BehaviorAttitude>>(
    () => ({ ...(props.initialAttitudes ?? {}), ...(props.currentAttitudes ?? {}) })
  );

  useEffect(() => {
    if (props.currentAttitudes !== undefined) {
      setAttitudes({ ...props.currentAttitudes });
    }
  }, [props.currentAttitudes]);

  return (
    <View style={styles.page} testID="page-4-content">
      <Card accessibilityLabel="态度选择说明" testID="page-4-card-intro" variant="muted">
        <PageTitle>此刻的态度</PageTitle>
        <BodyCopy>每项都可独立选择，没有高低顺序</BodyCopy>
      </Card>
      {props.behaviors.map((behavior) => (
        <Card accessible={false} key={behavior.id} testID={`page-4-card-${behavior.id}`}>
          <SectionTitle>{behavior.label}</SectionTitle>
          {attitudes[behavior.id] === undefined
            ? null
            : <Text selectable style={styles.selectedState}>{`当前选择：${ATTITUDES.find(({ value }) => value === attitudes[behavior.id])?.label}`}</Text>}
          <View style={styles.choiceGroup}>
            {ATTITUDES.map(({ value, label }) => (
              <JourneyChoice
                accessibilityLabel={`${behavior.label}：${label}`}
                key={value}
                label={label}
                mode="single"
                onSelect={() => {
                  setAttitudes((current) => ({ ...current, [behavior.id]: value }));
                  return props.onSet(behavior.id, value);
                }}
                selected={attitudes[behavior.id] === value}
              />
            ))}
          </View>
        </Card>
      ))}
      {props.onContinue === undefined ? null : (
        <PrimaryActions page={4}>
          <JourneyAction label="继续" loadingLabel="正在继续…" onAction={props.onContinue} />
        </PrimaryActions>
      )}
    </View>
  );
}

export function ReflectionPage(props: {
  onComplete(input: {
    motivationIds: string[];
    comfortNeedIds: string[];
    expressionSupportNeeded: boolean | null;
    journalSaveChoice: JournalSaveChoice;
  }): CallbackResult;
  motivationOptions?: Array<{ id: string; label: string }>;
  comfortNeedOptions?: Array<{ id: string; label: string }>;
  initialMotivationIds?: string[];
  initialComfortNeedIds?: string[];
  initialExpressionSupportNeeded?: boolean | null;
  initialJournalSaveChoice?: JournalSaveChoice;
}) {
  const [motivationIds, setMotivationIds] = useState<string[]>(() => [...(props.initialMotivationIds ?? [])]);
  const [comfortNeedIds, setComfortNeedIds] = useState<string[]>(() => [...(props.initialComfortNeedIds ?? [])]);
  const [expressionSupportNeeded, setExpressionSupportNeeded] = useState<boolean | null>(
    props.initialExpressionSupportNeeded ?? null
  );
  const [journalSaveChoice, setJournalSaveChoice] = useState<JournalSaveChoice>(
    props.initialJournalSaveChoice ?? "device"
  );

  const toggle = (ids: string[], id: string, update: (next: string[]) => void) => {
    update(ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  };

  return (
    <View style={styles.page} testID="page-5-content">
      <Card accessibilityLabel="反思记录说明" testID="page-5-card-intro" variant="muted">
        <PageTitle>回看动机、压力和安心条件（草稿）</PageTitle>
        <BodyCopy>反思记录只会保存在这台设备上；云端保存尚不可用。</BodyCopy>
      </Card>
      <Card accessible={false} testID="page-5-card-motivation">
        <SectionTitle>我想从这段旅程了解什么</SectionTitle>
        <View style={styles.choiceGroup}>
          {(props.motivationOptions ?? []).map((option) => (
            <JourneyChoice
              key={option.id}
              label={option.label}
              onSelect={() => toggle(motivationIds, option.id, setMotivationIds)}
              selected={motivationIds.includes(option.id)}
            />
          ))}
        </View>
      </Card>
      <Card accessible={false} testID="page-5-card-comfort">
        <SectionTitle>哪些条件会让我更安心</SectionTitle>
        <View style={styles.choiceGroup}>
          {(props.comfortNeedOptions ?? []).map((option) => (
            <JourneyChoice
              key={option.id}
              label={option.label}
              onSelect={() => toggle(comfortNeedIds, option.id, setComfortNeedIds)}
              selected={comfortNeedIds.includes(option.id)}
            />
          ))}
        </View>
      </Card>
      <Card accessible={false} testID="page-5-card-expression">
        <SectionTitle>表达支持</SectionTitle>
        <View style={styles.choiceGroup}>
          <JourneyChoice
            accessibilityLabel="需要表达支持"
            label="需要表达支持"
            mode="single"
            onSelect={() => setExpressionSupportNeeded(true)}
            selected={expressionSupportNeeded === true}
          />
          <JourneyChoice
            accessibilityLabel="不需要表达支持"
            label="不需要表达支持"
            mode="single"
            onSelect={() => setExpressionSupportNeeded(false)}
            selected={expressionSupportNeeded === false}
          />
          <JourneyChoice
            accessibilityLabel="暂不确定"
            label="暂不确定"
            mode="single"
            onSelect={() => setExpressionSupportNeeded(null)}
            selected={expressionSupportNeeded === null}
          />
        </View>
      </Card>
      <Card accessible={false} testID="page-5-card-storage">
        <SectionTitle>记录方式</SectionTitle>
        <View style={styles.choiceGroup}>
          <JourneyChoice
            label="本机加密保存"
            mode="single"
            onSelect={() => setJournalSaveChoice("device")}
            selected={journalSaveChoice === "device"}
          />
          <JourneyChoice
            accessibilityLabel="不保存反思记录"
            label="不保存反思记录"
            mode="single"
            onSelect={() => setJournalSaveChoice("not-saved")}
            selected={journalSaveChoice === "not-saved"}
          />
          <JourneyAction disabled label="云端保存（即将提供）" loadingLabel="正在保存…" />
        </View>
      </Card>
      <PrimaryActions page={5}>
        <JourneyAction
          accessibilityLabel="完成反思并继续"
          label="完成反思"
          loadingLabel="正在完成…"
          onAction={() => props.onComplete({
            motivationIds,
            comfortNeedIds,
            expressionSupportNeeded,
            journalSaveChoice
          })}
        />
      </PrimaryActions>
    </View>
  );
}

export function PresetPracticePage(props: {
  behaviors: Array<{ id: string; label: string }>;
  intents: Array<{ intent: PracticeIntent; label: string; phraseId: string; phrase: string }>;
  branches: Array<{ branch: PartnerResponseBranch; label: string }>;
  initialBehaviorId?: string;
  initialIntent?: PracticeIntent;
  initialBranch?: PartnerResponseBranch;
  initialEditedPhrase?: string;
  onComplete(input: {
    behaviorId: string;
    intent: PracticeIntent;
    phraseId: string;
    editedPhrase: string;
    branch: PartnerResponseBranch;
  }): CallbackResult;
}) {
  const firstIntent = props.intents.find(({ intent }) => intent === props.initialIntent) ?? props.intents[0];
  const [behaviorId, setBehaviorId] = useState(
    props.behaviors.some(({ id }) => id === props.initialBehaviorId)
      ? props.initialBehaviorId
      : props.behaviors[0]?.id
  );
  const [intent, setIntent] = useState<PracticeIntent | undefined>(firstIntent?.intent);
  const [branch, setBranch] = useState<PartnerResponseBranch | undefined>(
    props.branches.some(({ branch: value }) => value === props.initialBranch)
      ? props.initialBranch
      : props.branches[0]?.branch
  );
  const [editedPhrase, setEditedPhrase] = useState(props.initialEditedPhrase ?? firstIntent?.phrase ?? "");
  const [pauseCard, setPauseCard] = useState(false);
  const [mirrorPractice, setMirrorPractice] = useState(false);
  const selectedIntent = props.intents.find(({ intent: value }) => value === intent);
  const ready = behaviorId !== undefined && selectedIntent !== undefined && branch !== undefined;

  if (pauseCard) {
    return (
      <View style={[styles.page, styles.fullscreen]} testID="page-6-content">
        <Card accessible={false} testID="page-6-card-pause" variant="accent">
          <PageTitle>暂停一下，我需要先感受和决定。</PageTitle>
          <PrimaryActions page={6}>
            <JourneyAction
              label="关闭暂停卡"
              loadingLabel="正在关闭…"
              onAction={() => setPauseCard(false)}
            />
          </PrimaryActions>
        </Card>
      </View>
    );
  }

  if (mirrorPractice) {
    return (
      <View style={[styles.page, styles.fullscreen]} testID="page-6-content">
        <Card accessible={false} testID="page-6-card-mirror" variant="accent">
          <PageTitle>对镜练习中</PageTitle>
          <BodyCopy>{editedPhrase}</BodyCopy>
          <PrimaryActions page={6}>
            <JourneyAction
              label="结束对镜练习"
              loadingLabel="正在结束…"
              onAction={() => setMirrorPractice(false)}
            />
          </PrimaryActions>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.page} testID="page-6-content">
      <Card accessibilityLabel="本地预设练习说明" testID="page-6-card-intro" variant="muted">
        <PageTitle>预设对话 · 本地练习</PageTitle>
        <BodyCopy>预设对话，不使用 AI</BodyCopy>
      </Card>
      <Card accessible={false} testID="page-6-card-behavior">
        <SectionTitle>选择要练习的行为</SectionTitle>
        <View style={styles.choiceGroup}>
          {props.behaviors.map((behavior) => (
            <JourneyChoice
              key={behavior.id}
              label={behavior.label}
              mode="single"
              onSelect={() => setBehaviorId(behavior.id)}
              selected={behaviorId === behavior.id}
            />
          ))}
        </View>
      </Card>
      <Card accessible={false} testID="page-6-card-intent">
        <SectionTitle>选择练习意图</SectionTitle>
        <View style={styles.choiceGroup}>
          {props.intents.map((option) => (
            <JourneyChoice
              key={option.intent}
              label={option.label}
              mode="single"
              onSelect={() => {
                setIntent(option.intent);
                setEditedPhrase(option.phrase);
              }}
              selected={intent === option.intent}
            />
          ))}
        </View>
        <TextInput
          accessibilityLabel="练习表达"
          multiline
          onChangeText={setEditedPhrase}
          placeholderTextColor={theme.color.textMuted}
          selectionColor={theme.color.primary}
          style={styles.input}
          value={editedPhrase}
        />
      </Card>
      <Card accessible={false} testID="page-6-card-response">
        <SectionTitle>选择对方回应</SectionTitle>
        <View style={styles.choiceGroup}>
          {props.branches.map((option) => (
            <JourneyChoice
              key={option.branch}
              label={option.label}
              mode="single"
              onSelect={() => setBranch(option.branch)}
              selected={branch === option.branch}
            />
          ))}
        </View>
      </Card>
      <Card accessible={false} testID="page-6-card-practice" variant="muted">
        <SectionTitle>练习方式</SectionTitle>
        <View style={styles.actions}>
          <JourneyAction
            label="开始对镜练习"
            loadingLabel="正在打开…"
            onAction={() => setMirrorPractice(true)}
          />
          <JourneyAction
            label="打开暂停卡"
            loadingLabel="正在打开…"
            onAction={() => setPauseCard(true)}
          />
        </View>
      </Card>
      <PrimaryActions page={6}>
        <JourneyAction
          disabled={!ready}
          label="采用这句话"
          loadingLabel="正在采用…"
          onAction={ready ? () => props.onComplete({
            behaviorId,
            intent: selectedIntent.intent,
            phraseId: selectedIntent.phraseId,
            editedPhrase,
            branch
          }) : undefined}
        />
      </PrimaryActions>
    </View>
  );
}

const CHECKLIST_STATUSES: Array<{ value: ChecklistItemStatus; label: string }> = [
  { value: "considered", label: "已考虑" },
  { value: "prepare-more", label: "还想准备" },
  { value: "not-relevant", label: "与我无关" }
];

type ChecklistPageItem = { id: string; status: ChecklistItemStatus; userNote: string; label: string };
type ChecklistItemValue = { status: ChecklistItemStatus; note: string };

export function ChecklistPage(props: {
  items: ChecklistPageItem[];
  onUpdate(id: string, status: ChecklistItemStatus, note: string): CallbackResult;
  onFinish(items: ChecklistPageItem[]): CallbackResult;
}) {
  const [itemValues, setItemValues] = useState<Record<string, ChecklistItemValue>>(
    () => Object.fromEntries(props.items.map((item) => [item.id, { status: item.status, note: item.userNote }]))
  );
  const itemValuesRef = useRef(itemValues);
  const itemsRef = useRef(props.items);
  const dirtyItemIdsRef = useRef(new Set<string>());
  const pendingItemIdsRef = useRef(new Set<string>());
  const pendingItemPromisesRef = useRef(new Map<string, Promise<void>>());
  const [pendingItemIds, setPendingItemIds] = useState(new Set<string>());
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const checklistMountedRef = useRef(true);
  const { run } = usePendingActions();

  useLayoutEffect(() => {
    itemsRef.current = props.items;
  }, [props.items]);

  useEffect(() => {
    checklistMountedRef.current = true;
    return () => {
      checklistMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setItemValues((values) => {
      const nextValues = Object.fromEntries(props.items.map((item) => {
        const canonical = { status: item.status, note: item.userNote };
        const value = dirtyItemIdsRef.current.has(item.id)
          ? values[item.id] ?? itemValuesRef.current[item.id] ?? canonical
          : canonical;
        return [item.id, value];
      }));
      itemValuesRef.current = nextValues;
      return nextValues;
    });
  }, [props.items]);

  const canonicalValue = (id: string): ChecklistItemValue => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    return item
      ? { status: item.status, note: item.userNote }
      : { status: "prepare-more", note: "" };
  };

  const updateItemValue = (
    id: string,
    update: (value: ChecklistItemValue) => ChecklistItemValue
  ): ChecklistItemValue => {
    const immediateValue = update(itemValuesRef.current[id] ?? canonicalValue(id));
    itemValuesRef.current = { ...itemValuesRef.current, [id]: immediateValue };
    dirtyItemIdsRef.current.add(id);
    setItemValues((values) => {
      const latestValue = values[id] ?? canonicalValue(id);
      const nextValue = update(latestValue);
      itemValuesRef.current = { ...itemValuesRef.current, [id]: nextValue };
      return { ...values, [id]: nextValue };
    });
    return immediateValue;
  };

  const commitItem = (id: string, submitted: ChecklistItemValue): CallbackResult => {
    if (pendingItemIdsRef.current.has(id)) return pendingItemPromisesRef.current.get(id);
    pendingItemIdsRef.current.add(id);
    setPendingItemIds((current) => new Set(current).add(id));
    const result = run(
      () => props.onUpdate(id, submitted.status, submitted.note),
      () => {
        const current = itemValuesRef.current[id];
        if (current?.status === submitted.status && current.note === submitted.note) {
          dirtyItemIdsRef.current.delete(id);
        }
      },
      () => {
        pendingItemIdsRef.current.delete(id);
        setPendingItemIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    );
    if (!isPromiseResult(result)) return result;
    const tracked = Promise.resolve(result).finally(() => {
      if (pendingItemPromisesRef.current.get(id) === tracked) {
        pendingItemPromisesRef.current.delete(id);
      }
    });
    pendingItemPromisesRef.current.set(id, tracked);
    return tracked;
  };

  const visibleItems = (): ChecklistPageItem[] => itemsRef.current.map((item) => {
    const value = itemValuesRef.current[item.id] ?? { status: item.status, note: item.userNote };
    return { ...item, status: value.status, userNote: value.note };
  });

  const flushDirtyItemsAndFinish = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      await Promise.all([...pendingItemPromisesRef.current.values()]);
      while (dirtyItemIdsRef.current.size > 0) {
        for (const id of [...dirtyItemIdsRef.current]) {
          const submitted = itemValuesRef.current[id] ?? canonicalValue(id);
          await commitItem(id, submitted);
        }
      }
      await props.onFinish(visibleItems());
    } finally {
      finishingRef.current = false;
      if (checklistMountedRef.current) setFinishing(false);
    }
  };

  return (
    <View style={styles.page} testID="page-7-content">
      <Card accessibilityLabel="清单回顾说明" testID="page-7-card-intro" variant="muted">
        <PageTitle>准备清单回顾</PageTitle>
        <BodyCopy>这不是需要全部勾选的通关表</BodyCopy>
      </Card>
      {props.items.map((item) => {
        const current = itemValues[item.id] ?? { status: item.status, note: item.userNote };
        const selectedLabel = CHECKLIST_STATUSES.find(({ value }) => value === current.status)?.label;
        const itemPending = finishing || pendingItemIds.has(item.id);

        return (
          <Card accessible={false} key={item.id} testID={`page-7-card-${item.id}`}>
            <SectionTitle>{item.label}</SectionTitle>
            <View style={styles.choiceGroup}>
              {CHECKLIST_STATUSES.map(({ value, label }) => (
                <JourneyChoice
                  accessibilityLabel={`${item.label}：${label}`}
                  disabled={itemPending}
                  key={value}
                  label={label}
                  mode="single"
                  onSelect={() => {
                    if (finishingRef.current || pendingItemIdsRef.current.has(item.id)) return;
                    const submitted = updateItemValue(item.id, (latest) => ({ ...latest, status: value }));
                    return commitItem(item.id, submitted);
                  }}
                  selected={current.status === value}
                />
              ))}
            </View>
            {selectedLabel ? <Text selectable style={styles.selectedState}>{`已选择：${selectedLabel}`}</Text> : null}
            <TextInput
              accessibilityLabel={`${item.label}补充说明`}
              editable={!itemPending}
              maxLength={240}
              multiline
              onChangeText={(note) => {
                if (finishingRef.current || pendingItemIdsRef.current.has(item.id)) return;
                updateItemValue(item.id, (latest) => ({ ...latest, note }));
              }}
              placeholder="补充说明（可选）"
              placeholderTextColor={theme.color.textMuted}
              selectionColor={theme.color.primary}
              style={styles.input}
              value={current.note}
            />
            <JourneyAction
              disabled={itemPending}
              errorMessage="保存补充说明失败，请重试。"
              label={`保存${item.label}补充说明`}
              loadingLabel={`正在保存${item.label}补充说明…`}
              onAction={() => {
                if (finishingRef.current) return;
                return commitItem(
                  item.id,
                  itemValuesRef.current[item.id] ?? { status: item.status, note: item.userNote }
                );
              }}
            />
          </Card>
        );
      })}
      <PrimaryActions page={7}>
        <JourneyAction
          disabled={finishing}
          errorMessage="完成回顾失败，请重试。"
          label="完成回顾"
          loadingLabel="正在完成…"
          onAction={flushDirtyItemsAndFinish}
        />
      </PrimaryActions>
    </View>
  );
}

type CommunicationCardField = { id: string; text: string; needsReview: boolean };

export type ClipboardActionState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success" }
  | { status: "error"; code: "clipboard-write-failed" };

export function CommunicationCardPage(props: {
  fields: CommunicationCardField[];
  pointTotal: number;
  copyState?: ClipboardActionState;
  onEdit(id: string, text: string): CallbackResult;
  onSave(fields: CommunicationCardField[]): CallbackResult;
  onCopy(fields: CommunicationCardField[]): CallbackResult;
  onFinish?: (fields: CommunicationCardField[]) => CallbackResult;
  capabilities?: JourneyCapabilities;
  runtimeNotice?: JourneyRuntimeNotice;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fieldTexts, setFieldTexts] = useState<Record<string, string>>(
    () => Object.fromEntries(props.fields.map((field) => [field.id, field.text]))
  );
  const fieldTextsRef = useRef(fieldTexts);
  const fieldsRef = useRef(props.fields);
  const dirtyFieldIdsRef = useRef(new Set<string>());
  const pendingFieldEditsRef = useRef(new Map<string, string>());
  const inFlightFieldEditsRef = useRef(new Map<string, { text: string; promise: Promise<boolean> }>());
  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const editMountedRef = useRef(true);
  const [editFailed, setEditFailed] = useState(false);
  const { pendingCount, pendingCountRef, run } = usePendingActions();
  const canPersistLocally = props.capabilities?.canPersistLocally ?? true;
  const canCopy = props.capabilities?.canCopy ?? true;
  const canShowFullscreen = props.capabilities?.canShowFullscreen ?? true;
  const copyActionState: JourneyAsyncState | undefined = props.copyState === undefined
    ? undefined
    : props.copyState.status === "pending"
      ? { status: "loading", message: "正在复制…" }
      : props.copyState.status === "success"
        ? { status: "success", message: "已复制" }
        : props.copyState.status === "error"
          ? { status: "error", message: "复制失败，请重试" }
          : { status: "idle" };
  useLayoutEffect(() => {
    fieldsRef.current = props.fields;
  }, [props.fields]);

  useEffect(() => {
    editMountedRef.current = true;
    return () => {
      editMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setFieldTexts((texts) => {
      const nextTexts = Object.fromEntries(props.fields.map((field) => [
        field.id,
        dirtyFieldIdsRef.current.has(field.id)
          ? texts[field.id] ?? fieldTextsRef.current[field.id] ?? field.text
          : field.text
      ]));
      fieldTextsRef.current = nextTexts;
      return nextTexts;
    });
  }, [props.fields]);

  const updateFieldText = (id: string, text: string) => {
    if (pendingCountRef.current > 0) return;
    fieldTextsRef.current = { ...fieldTextsRef.current, [id]: text };
    dirtyFieldIdsRef.current.add(id);
    setFieldTexts((texts) => {
      const latestText = texts[id] ?? fieldsRef.current.find((field) => field.id === id)?.text ?? "";
      if (latestText === text) return texts;
      const nextTexts = { ...texts, [id]: text };
      fieldTextsRef.current = { ...fieldTextsRef.current, [id]: text };
      return nextTexts;
    });
    pendingFieldEditsRef.current.set(id, text);
    void persistField(id, text);
  };

  const runSequenced = (action: () => CallbackResult, onSuccess?: () => void): CallbackResult => {
    const queued = actionQueueRef.current.then(() => action());
    actionQueueRef.current = queued.then(() => undefined, () => undefined);
    return run(() => queued, onSuccess);
  };

  const persistField = (id: string, submittedText: string): Promise<boolean> => {
    const existing = inFlightFieldEditsRef.current.get(id);
    if (existing?.text === submittedText) return existing.promise;
    const write = async () => {
      if (pendingFieldEditsRef.current.get(id) !== submittedText) return true;
      try {
        await props.onEdit(id, submittedText);
        if (pendingFieldEditsRef.current.get(id) === submittedText) {
          pendingFieldEditsRef.current.delete(id);
          if (fieldTextsRef.current[id] === submittedText) dirtyFieldIdsRef.current.delete(id);
        }
        if (editMountedRef.current) setEditFailed(false);
        return true;
      } catch {
        if (editMountedRef.current) setEditFailed(true);
        return false;
      }
    };
    const work = existing === undefined ? write() : existing.promise.then(write, write);
    const tracked = { text: submittedText, promise: Promise.resolve(false) };
    tracked.promise = work.then((succeeded) => {
      if (inFlightFieldEditsRef.current.get(id) === tracked) {
        inFlightFieldEditsRef.current.delete(id);
      }
      return succeeded;
    });
    inFlightFieldEditsRef.current.set(id, tracked);
    return tracked.promise;
  };

  const commitField = (id: string, submittedText: string): CallbackResult => runSequenced(async () => {
    pendingFieldEditsRef.current.set(id, submittedText);
    dirtyFieldIdsRef.current.add(id);
    if (!await persistField(id, submittedText)) throw new Error("field-edit-failed");
  });

  const visibleFields = (): CommunicationCardField[] => fieldsRef.current.map((field) => ({
    ...field,
    text: fieldTextsRef.current[field.id] ?? field.text
  }));

  const flushAndRun = (action: (fields: CommunicationCardField[]) => CallbackResult): CallbackResult => (
    dirtyFieldIdsRef.current.size === 0
      ? runSequenced(() => action(visibleFields()))
      : runSequenced(async () => {
      for (const id of [...dirtyFieldIdsRef.current]) {
        const field = fieldsRef.current.find((candidate) => candidate.id === id);
        const submittedText = fieldTextsRef.current[id] ?? field?.text ?? "";
        if (!await persistField(id, submittedText)) throw new Error("field-edit-failed");
      }
      await action(visibleFields());
      })
  );

  if (fullscreen) {
    return (
      <View style={[styles.page, styles.fullscreen]} testID="page-8-content">
        <Card accessible={false} testID="page-8-card-fullscreen" variant="accent">
          {props.fields.map((field) => <BodyCopy key={field.id}>{fieldTexts[field.id] ?? field.text}</BodyCopy>)}
          <BodyCopy muted>暂停与确认表达保持可见</BodyCopy>
          <PrimaryActions page={8}>
            <JourneyAction
              label="退出展示"
              loadingLabel="正在退出…"
              onAction={() => setFullscreen(false)}
            />
          </PrimaryActions>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.page} testID="page-8-content">
      <Card accessibilityLabel="沟通卡整理说明" testID="page-8-card-intro" variant="muted">
        <PageTitle>根据妳刚才的选择整理</PageTitle>
        <BodyCopy>沟通卡由本机固定规则整理，不使用 AI。</BodyCopy>
      </Card>
      {props.runtimeNotice ? (
        <JourneyStatusBanner
          accessibilityLabel={props.runtimeNotice.accessibilityLabel}
          message={props.runtimeNotice.message}
        />
      ) : null}
      {editFailed ? (
        <JourneyStatusBanner message="更改尚未保存，请重试。" tone="error" />
      ) : null}
      {props.fields.map((field) => {
        const text = fieldTexts[field.id] ?? field.text;
        const sectionLabel = communicationCardSectionLabel(field.id);

        return (
          <Card accessible={false} key={field.id} testID={`page-8-card-${field.id}`}>
            <SectionTitle>{sectionLabel}</SectionTitle>
            <TextInput
              accessibilityLabel={`沟通卡字段：${sectionLabel}`}
              editable={pendingCount === 0}
              multiline
              onChangeText={(nextText) => {
                updateFieldText(field.id, nextText);
              }}
              placeholderTextColor={theme.color.textMuted}
              selectionColor={theme.color.primary}
              style={styles.input}
              value={text}
            />
            <JourneyAction
              disabled={pendingCount > 0}
              errorMessage="保存字段失败，请重试。"
              label={`保存字段：${sectionLabel}`}
              loadingLabel={`正在保存字段：${sectionLabel}…`}
              onAction={() => commitField(field.id, fieldTextsRef.current[field.id] ?? field.text)}
            />
            {field.needsReview ? <Text selectable style={styles.reviewLabel}>需要复核</Text> : null}
          </Card>
        );
      })}
      <Card accessibilityLabel="探索积分说明" testID="page-8-card-points" variant="muted">
        <SectionTitle>{`探索积分：${props.pointTotal}`}</SectionTitle>
        <BodyCopy muted>积分只记录学习与练习任务，不依据选择内容或文字长度。</BodyCopy>
      </Card>
      <Card accessible={false} testID="page-8-card-actions">
        <SectionTitle>保存与展示</SectionTitle>
        <View style={styles.actions}>
          <JourneyAction
            disabled={!canPersistLocally}
            errorMessage="本机保存失败，请重试。"
            label="本机保存"
            loadingLabel="正在保存…"
            onAction={() => flushAndRun(props.onSave)}
          />
          <JourneyAction
            actionState={copyActionState}
            disabled={!canCopy}
            errorMessage="复制失败，请重试。"
            label="复制当前卡片"
            loadingLabel="正在复制…"
            onAction={() => flushAndRun(props.onCopy)}
          />
          <JourneyAction
            disabled={!canShowFullscreen || pendingCount > 0}
            label="现场展示"
            loadingLabel="正在打开…"
            onAction={() => {
              if (pendingCountRef.current > 0) return;
              setFullscreen(true);
            }}
          />
          <JourneyAction disabled label="云端保存（即将提供）" loadingLabel="正在保存…" />
        </View>
      </Card>
      <PrimaryActions page={8}>
        <JourneyAction
          disabled={props.onFinish === undefined}
          label="完成旅程"
          loadingLabel="正在完成…"
          onAction={props.onFinish === undefined ? undefined : () => {
            return flushAndRun((fields) => props.onFinish?.(fields));
          }}
        />
      </PrimaryActions>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.space.sm },
  body: { ...theme.typography.body, color: theme.color.text },
  choiceGroup: { gap: theme.space.sm },
  fullscreen: { justifyContent: "center" },
  heading: { ...theme.typography.heading, color: theme.color.text },
  input: {
    ...theme.typography.body,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
    borderWidth: theme.border.width,
    color: theme.color.text,
    minHeight: theme.size.minimumTouchTarget,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    textAlignVertical: "top"
  },
  mutedText: { color: theme.color.textMuted },
  page: { flexGrow: 1, gap: theme.space.lg },
  primaryActions: { gap: theme.space.sm, marginTop: "auto" },
  reviewLabel: { ...theme.typography.label, color: theme.color.warning },
  selectedState: { ...theme.typography.label, color: theme.color.primary },
  slogan: { ...theme.typography.heading, color: theme.color.primary },
  title: { ...theme.typography.display, color: theme.color.text }
});
