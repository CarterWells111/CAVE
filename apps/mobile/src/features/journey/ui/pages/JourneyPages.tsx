import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

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
      <JourneyAction
        disabled={props.onContinue === undefined}
        label="继续"
        loadingLabel="正在继续…"
        onAction={props.onContinue}
      />
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
  onContinue?: () => CallbackResult;
}) {
  const [attitudes, setAttitudes] = useState<Record<string, BehaviorAttitude>>(
    () => ({ ...(props.initialAttitudes ?? {}) })
  );

  return (
    <View style={styles.group}>
      <Text>每项都可独立选择，没有高低顺序</Text>
      {props.behaviors.map((behavior) => (
        <View key={behavior.id}>
          <Text>{behavior.label}</Text>
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
      <JourneyAction
        disabled={props.onContinue === undefined}
        label="继续"
        loadingLabel="正在继续…"
        onAction={props.onContinue}
      />
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
        label="我需要表达支持"
        mode="single"
        onSelect={() => setExpressionSupportNeeded(true)}
        selected={expressionSupportNeeded === true}
      />
      <JourneyChoice
        label="我暂时不需要表达支持"
        mode="single"
        onSelect={() => setExpressionSupportNeeded(false)}
        selected={expressionSupportNeeded === false}
      />
      <JourneyChoice
        label="暂时不回答表达支持"
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
        label="不另存为记录"
        mode="single"
        onSelect={() => setJournalSaveChoice("not-saved")}
        selected={journalSaveChoice === "not-saved"}
      />
      <JourneyAction
        label="完成反思并继续"
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
  phrase: string;
  onComplete(editedPhrase: string): CallbackResult;
}) {
  const [editedPhrase, setEditedPhrase] = useState(props.phrase);
  const [pauseCard, setPauseCard] = useState(false);

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

  return (
    <View style={styles.group}>
      <Text>预设对话，不使用 AI</Text>
      <Text>预设对话 · 本地练习</Text>
      <TextInput
        accessibilityLabel="练习表达"
        multiline
        onChangeText={setEditedPhrase}
        value={editedPhrase}
      />
      <JourneyAction
        label="采用这句话"
        loadingLabel="正在采用…"
        onAction={() => props.onComplete(editedPhrase)}
      />
      <JourneyAction disabled label="对镜练习" loadingLabel="正在打开…" />
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
  const [pendingItemIds, setPendingItemIds] = useState(new Set<string>());
  const { pendingCount, pendingCountRef, run } = usePendingActions();
  itemsRef.current = props.items;

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
    if (pendingItemIdsRef.current.has(id)) return;
    pendingItemIdsRef.current.add(id);
    setPendingItemIds((current) => new Set(current).add(id));
    return run(
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
  };

  const visibleItems = (): ChecklistPageItem[] => itemsRef.current.map((item) => {
    const value = itemValuesRef.current[item.id] ?? { status: item.status, note: item.userNote };
    return { ...item, status: value.status, userNote: value.note };
  });

  return (
    <View style={styles.group}>
      <Text>这不是需要全部勾选的通关表</Text>
      {props.items.map((item) => {
        const current = itemValues[item.id] ?? { status: item.status, note: item.userNote };
        const selectedLabel = CHECKLIST_STATUSES.find(({ value }) => value === current.status)?.label;
        const itemPending = pendingItemIds.has(item.id);

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
                  if (pendingItemIdsRef.current.has(item.id)) return;
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
              multiline
              onChangeText={(note) => {
                if (pendingItemIdsRef.current.has(item.id)) return;
                updateItemValue(item.id, (latest) => ({ ...latest, note }));
              }}
              value={current.note}
            />
            <JourneyAction
              disabled={itemPending}
              errorMessage="保存补充说明失败，请重试。"
              label={`保存${item.label}补充说明`}
              loadingLabel={`正在保存${item.label}补充说明…`}
              onAction={() => commitItem(
                item.id,
                itemValuesRef.current[item.id] ?? { status: item.status, note: item.userNote }
              )}
            />
          </View>
        );
      })}
      <JourneyAction
        disabled={pendingCount > 0}
        label="完成回顾"
        loadingLabel="正在完成…"
        onAction={() => {
          if (pendingCountRef.current > 0) return;
          return props.onFinish(visibleItems());
        }}
      />
    </View>
  );
}

type CommunicationCardField = { id: string; text: string; needsReview: boolean };

export function CommunicationCardPage(props: {
  fields: CommunicationCardField[];
  pointTotal: number;
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
  const { pendingCount, pendingCountRef, run } = usePendingActions();
  const canPersistLocally = props.capabilities?.canPersistLocally ?? true;
  const canCopy = props.capabilities?.canCopy ?? true;
  const canShowFullscreen = props.capabilities?.canShowFullscreen ?? true;
  fieldsRef.current = props.fields;

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
  };

  const runExclusive = (action: () => CallbackResult, onSuccess?: () => void): CallbackResult => {
    if (pendingCountRef.current > 0) return;
    return run(action, onSuccess);
  };

  const commitField = (id: string, submittedText: string): CallbackResult => runExclusive(
    () => props.onEdit(id, submittedText),
    () => {
      if (fieldTextsRef.current[id] === submittedText) {
        dirtyFieldIdsRef.current.delete(id);
      }
    }
  );

  const visibleFields = (): CommunicationCardField[] => fieldsRef.current.map((field) => ({
    ...field,
    text: fieldTextsRef.current[field.id] ?? field.text
  }));

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
        disabled={!canPersistLocally || pendingCount > 0}
        errorMessage="本机保存失败，请重试。"
        label="本机保存"
        loadingLabel="正在保存…"
        onAction={() => {
          return runExclusive(() => props.onSave(visibleFields()));
        }}
      />
      <JourneyAction
        disabled={!canCopy || pendingCount > 0}
        errorMessage="复制失败，请重试。"
        label="复制当前卡片"
        loadingLabel="正在复制…"
        onAction={() => {
          return runExclusive(() => props.onCopy(visibleFields()));
        }}
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
        disabled={props.onFinish === undefined || pendingCount > 0}
        label="完成旅程"
        loadingLabel="正在完成…"
        onAction={props.onFinish === undefined ? undefined : () => {
          return runExclusive(() => props.onFinish?.(visibleFields()));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, gap: 20, justifyContent: "center", padding: 24 },
  group: { gap: 12 }
});
