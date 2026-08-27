import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

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
    <View style={styles.group}>
      <Text>内界 CAVE</Text>
      <JourneyAction label="阅读能力与局限短笺" loadingLabel="正在打开…" onAction={props.onOpenPreface} />
      <JourneyAction label="我已满18岁" loadingLabel="正在继续…" onAction={props.onAdult} />
      <JourneyAction label="我未满18岁" loadingLabel="正在继续…" onAction={props.onUnderage} />
      {props.resumeAvailable ? (
        <JourneyAction
          disabled={props.onResume === undefined}
          label="继续本机旅程"
          loadingLabel="正在恢复…"
          onAction={props.onResume}
        />
      ) : null}
      {props.resumeAvailable ? (
        <JourneyAction
          disabled={props.onRestart === undefined}
          label="重新开始（需要确认）"
          loadingLabel="正在重新开始…"
          onAction={props.onRestart}
        />
      ) : null}
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
    <View style={styles.group}>
      <Text>我对过夜情境的期待</Text>
      {props.expectationOptions.map((option) => (
        <JourneyChoice
          key={option.id}
          label={option.label}
          onSelect={() => toggle(expectationIds, option.id, setExpectationIds)}
          selected={expectationIds.includes(option.id)}
        />
      ))}
      <Text>我在意或担心的事</Text>
      {props.concernOptions.map((option) => (
        <JourneyChoice
          key={option.id}
          label={option.label}
          onSelect={() => toggle(concernIds, option.id, setConcernIds)}
          selected={concernIds.includes(option.id)}
        />
      ))}
      <TextInput
        accessibilityLabel="过夜情境可选补充"
        maxLength={240}
        multiline
        onChangeText={setCustomNote}
        placeholder="可选补充"
        value={customNote}
      />
      <JourneyAction
        actionState={props.actionState}
        errorMessage="保存失败，请重试。"
        label="继续"
        loadingLabel="正在继续…"
        onAction={() => props.onContinue({ expectationIds, concernIds, customNote })}
      />
      {props.actionState?.status === "loading" && props.actionState.message ? (
        <JourneyStatusBanner message={props.actionState.message} />
      ) : null}
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
    <View style={styles.group}>
      <JourneyAction
        label="主动展开医学图示"
        loadingLabel="正在打开…"
        onAction={() => {
          setDiagramOpen(true);
          return props.onOpenDiagram();
        }}
      />
      {diagramOpen ? <Text>医学图示将在内容完善阶段替换</Text> : null}
      {props.cards.map((card) => (
        <View key={card.id}>
          <Text>{card.title}</Text>
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
        </View>
      ))}
      {props.onContinue === undefined ? null : (
        <JourneyAction label="继续" loadingLabel="正在继续…" onAction={props.onContinue} />
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
    <View style={styles.group}>
      <Text>每项都可独立选择，没有高低顺序</Text>
      {props.behaviors.map((behavior) => (
        <View key={behavior.id}>
          <Text>{behavior.label}</Text>
          {attitudes[behavior.id] === undefined
            ? null
            : <Text>{`当前选择：${ATTITUDES.find(({ value }) => value === attitudes[behavior.id])?.label}`}</Text>}
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
      ))}
      {props.onContinue === undefined ? null : (
        <JourneyAction label="继续" loadingLabel="正在继续…" onAction={props.onContinue} />
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
    <View style={styles.group}>
      <Text>回看动机、压力和安心条件（草稿）</Text>
      <Text>我想从这段旅程了解什么</Text>
      {(props.motivationOptions ?? []).map((option) => (
        <JourneyChoice
          key={option.id}
          label={option.label}
          onSelect={() => toggle(motivationIds, option.id, setMotivationIds)}
          selected={motivationIds.includes(option.id)}
        />
      ))}
      <Text>哪些条件会让我更安心</Text>
      {(props.comfortNeedOptions ?? []).map((option) => (
        <JourneyChoice
          key={option.id}
          label={option.label}
          onSelect={() => toggle(comfortNeedIds, option.id, setComfortNeedIds)}
          selected={comfortNeedIds.includes(option.id)}
        />
      ))}
      <Text>表达支持</Text>
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
      <Text>记录方式</Text>
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
      <JourneyAction disabled label="云端保存（即将提供）" loadingLabel="正在保存…" />
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
      <View style={styles.fullscreen}>
        <Text>暂停一下，我需要先感受和决定。</Text>
        <JourneyAction
          label="关闭暂停卡"
          loadingLabel="正在关闭…"
          onAction={() => setPauseCard(false)}
        />
      </View>
    );
  }

  if (mirrorPractice) {
    return (
      <View style={styles.fullscreen}>
        <Text>对镜练习中</Text>
        <Text>{editedPhrase}</Text>
        <JourneyAction
          label="结束对镜练习"
          loadingLabel="正在结束…"
          onAction={() => setMirrorPractice(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.group}>
      <Text>预设对话，不使用 AI</Text>
      <Text>预设对话 · 本地练习</Text>
      <Text>选择要练习的行为</Text>
      {props.behaviors.map((behavior) => (
        <JourneyChoice
          key={behavior.id}
          label={behavior.label}
          mode="single"
          onSelect={() => setBehaviorId(behavior.id)}
          selected={behaviorId === behavior.id}
        />
      ))}
      <Text>选择练习意图</Text>
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
      <TextInput
        accessibilityLabel="练习表达"
        multiline
        onChangeText={setEditedPhrase}
        value={editedPhrase}
      />
      <Text>选择对方回应</Text>
      {props.branches.map((option) => (
        <JourneyChoice
          key={option.branch}
          label={option.label}
          mode="single"
          onSelect={() => setBranch(option.branch)}
          selected={branch === option.branch}
        />
      ))}
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
    <View style={styles.group}>
      <Text>这不是需要全部勾选的通关表</Text>
      {props.items.map((item) => {
        const current = itemValues[item.id] ?? { status: item.status, note: item.userNote };
        const selectedLabel = CHECKLIST_STATUSES.find(({ value }) => value === current.status)?.label;
        const itemPending = finishing || pendingItemIds.has(item.id);

        return (
          <View key={item.id}>
            <Text>{item.label}</Text>
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
            {selectedLabel ? <Text>{`已选择：${selectedLabel}`}</Text> : null}
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
          </View>
        );
      })}
      <JourneyAction
        disabled={finishing}
        errorMessage="完成回顾失败，请重试。"
        label="完成回顾"
        loadingLabel="正在完成…"
        onAction={flushDirtyItemsAndFinish}
      />
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
      <View style={styles.fullscreen}>
        {props.fields.map((field) => <Text key={field.id}>{fieldTexts[field.id] ?? field.text}</Text>)}
        <Text>暂停与确认表达保持可见</Text>
        <JourneyAction
          label="退出展示"
          loadingLabel="正在退出…"
          onAction={() => setFullscreen(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.group}>
      <Text>根据妳刚才的选择整理</Text>
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

        return (
          <View key={field.id}>
            <TextInput
              accessibilityLabel={`沟通卡字段：${field.id}`}
              editable={pendingCount === 0}
              multiline
              onChangeText={(nextText) => {
                updateFieldText(field.id, nextText);
              }}
              value={text}
            />
            <JourneyAction
              disabled={pendingCount > 0}
              errorMessage="保存字段失败，请重试。"
              label={`保存字段：${field.id}`}
              loadingLabel={`正在保存字段：${field.id}…`}
              onAction={() => commitField(field.id, fieldTextsRef.current[field.id] ?? field.text)}
            />
            {field.needsReview ? <Text>需要复核</Text> : null}
          </View>
        );
      })}
      <Text>{`探索积分：${props.pointTotal}`}</Text>
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
      <JourneyAction
        disabled={props.onFinish === undefined}
        label="完成旅程"
        loadingLabel="正在完成…"
        onAction={props.onFinish === undefined ? undefined : () => {
          return flushAndRun((fields) => props.onFinish?.(fields));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, gap: 20, justifyContent: "center", padding: 24 },
  group: { gap: 12 }
});
