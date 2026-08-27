import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { BehaviorAttitude, ChecklistItemStatus, JournalSaveChoice } from "../../domain/types";

function Action({ label, onPress, disabled = false, selected, role = "button" }: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  role?: "button" | "checkbox" | "radio";
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{
        disabled,
        ...(selected === undefined ? {} : role === "button" ? { selected } : { checked: selected })
      }}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.action}>{label}</Text>
    </Pressable>
  );
}

export function WelcomePage(props: {
  onAdult(): void;
  onUnderage(): void;
  onOpenPreface(): void;
  resumeAvailable: boolean;
  onResume?: () => void;
  onRestart?: () => void;
}) {
  return (
    <View style={styles.group}>
      <Text>内界 CAVE</Text>
      <Action label="阅读能力与局限短笺" onPress={props.onOpenPreface} />
      <Action label="我已满18岁" onPress={props.onAdult} />
      <Action label="我未满18岁" onPress={props.onUnderage} />
      {props.resumeAvailable ? <Action label="继续本机旅程" {...(props.onResume === undefined ? {} : { onPress: props.onResume })} /> : null}
      {props.resumeAvailable ? <Action label="重新开始（需要确认）" {...(props.onRestart === undefined ? {} : { onPress: props.onRestart })} /> : null}
    </View>
  );
}

export function OvernightPage(props: {
  expectationOptions: Array<{ id: string; label: string }>;
  concernOptions: Array<{ id: string; label: string }>;
  initialExpectationIds?: string[];
  initialConcernIds?: string[];
  initialCustomNote?: string;
  onContinue(input: { expectationIds: string[]; concernIds: string[]; customNote: string }): void;
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
        <Action
          key={option.id}
          label={option.label}
          role="checkbox"
          selected={expectationIds.includes(option.id)}
          onPress={() => toggle(expectationIds, option.id, setExpectationIds)}
        />
      ))}
      <Text>我在意或担心的事</Text>
      {props.concernOptions.map((option) => (
        <Action
          key={option.id}
          label={option.label}
          role="checkbox"
          selected={concernIds.includes(option.id)}
          onPress={() => toggle(concernIds, option.id, setConcernIds)}
        />
      ))}
      <TextInput maxLength={240} onChangeText={setCustomNote} placeholder="可选补充" value={customNote} />
      <Action label="继续" onPress={() => props.onContinue({ expectationIds, concernIds, customNote })} />
    </View>
  );
}

export function BodyKnowledgePage(props: {
  cards: Array<{ id: string; title: string; sourceIds: string[] }>;
  onRead(id: string): void;
  onOpenDiagram(): void;
  onOpenSources(sourceIds: string[]): void;
}) {
  const [diagramOpen, setDiagramOpen] = useState(false);
  return (
    <View style={styles.group}>
      <Action label="主动展开医学图示" onPress={() => { setDiagramOpen(true); props.onOpenDiagram(); }} />
      {diagramOpen ? <Text>医学图示将在内容完善阶段替换</Text> : null}
      {props.cards.map((card) => (
        <View key={card.id}>
          <Text>{card.title}</Text>
          <Action label={`标记已读：${card.title}`} onPress={() => props.onRead(card.id)} />
          <Action label={`查看来源：${card.title}`} onPress={() => props.onOpenSources(card.sourceIds)} />
        </View>
      ))}
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
  currentAttitudes?: Record<string, BehaviorAttitude>;
  onSet(id: string, attitude: BehaviorAttitude): void;
}) {
  return (
    <View style={styles.group}>
      <Text>每项都可独立选择，没有高低顺序</Text>
      {props.behaviors.map((behavior) => (
        <View key={behavior.id}>
          <Text>{behavior.label}</Text>
          {props.currentAttitudes?.[behavior.id] === undefined
            ? null
            : <Text>{`当前选择：${ATTITUDES.find(({ value }) => value === props.currentAttitudes?.[behavior.id])?.label}`}</Text>}
          {ATTITUDES.map(({ value, label }) => (
            <Action
              key={value}
              label={label}
              role="radio"
              selected={props.currentAttitudes?.[behavior.id] === value}
              onPress={() => props.onSet(behavior.id, value)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function ReflectionPage(props: {
  motivationOptions?: Array<{ id: string; label: string }>;
  comfortNeedOptions?: Array<{ id: string; label: string }>;
  initialMotivationIds?: string[];
  initialComfortNeedIds?: string[];
  initialExpressionSupportNeeded?: boolean | null;
  initialJournalSaveChoice?: JournalSaveChoice;
  onComplete(input: { motivationIds: string[]; comfortNeedIds: string[]; expressionSupportNeeded: boolean | null; journalSaveChoice: JournalSaveChoice }): void;
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
      <Text>我的动机</Text>
      {(props.motivationOptions ?? []).map((option) => (
        <Action
          key={option.id}
          label={option.label}
          role="checkbox"
          selected={motivationIds.includes(option.id)}
          onPress={() => toggle(motivationIds, option.id, setMotivationIds)}
        />
      ))}
      <Text>让我更安心的条件</Text>
      {(props.comfortNeedOptions ?? []).map((option) => (
        <Action
          key={option.id}
          label={option.label}
          role="checkbox"
          selected={comfortNeedIds.includes(option.id)}
          onPress={() => toggle(comfortNeedIds, option.id, setComfortNeedIds)}
        />
      ))}
      <Text>表达支持</Text>
      <Action
        label="需要表达支持"
        role="radio"
        selected={expressionSupportNeeded === true}
        onPress={() => setExpressionSupportNeeded(true)}
      />
      <Action
        label="不需要表达支持"
        role="radio"
        selected={expressionSupportNeeded === false}
        onPress={() => setExpressionSupportNeeded(false)}
      />
      <Action
        label="暂不确定"
        role="radio"
        selected={expressionSupportNeeded === null}
        onPress={() => setExpressionSupportNeeded(null)}
      />
      <Text>反思记录</Text>
      <Action
        label="本机加密保存"
        role="radio"
        selected={journalSaveChoice === "device"}
        onPress={() => setJournalSaveChoice("device")}
      />
      <Action
        label="不保存反思记录"
        role="radio"
        selected={journalSaveChoice === "not-saved"}
        onPress={() => setJournalSaveChoice("not-saved")}
      />
      <Action label="完成反思" onPress={() => props.onComplete({
        motivationIds,
        comfortNeedIds,
        expressionSupportNeeded,
        journalSaveChoice
      })} />
      <Action label="云端保存（即将提供）" disabled />
    </View>
  );
}

export function PresetPracticePage({ phrase, onComplete }: { phrase: string; onComplete(editedPhrase: string): void }) {
  const [editedPhrase, setEditedPhrase] = useState(phrase);
  const [pauseCard, setPauseCard] = useState(false);
  if (pauseCard) {
    return (
      <View style={styles.fullscreen}>
        <Text>暂停一下，我需要先感受和决定。</Text>
        <Action label="关闭暂停卡" onPress={() => setPauseCard(false)} />
      </View>
    );
  }
  return (
    <View style={styles.group}>
      <Text>预设对话 · 本地练习</Text>
      <TextInput onChangeText={setEditedPhrase} value={editedPhrase} />
      <Action label="采用这句话" onPress={() => onComplete(editedPhrase)} />
      <Action label="对镜练习" />
      <Action label="打开暂停卡" onPress={() => setPauseCard(true)} />
    </View>
  );
}

export function ChecklistPage(props: {
  items: Array<{ id: string; status: ChecklistItemStatus; userNote: string; label: string }>;
  onUpdate(id: string, status: ChecklistItemStatus, note: string): void | Promise<void>;
  onFinish(): void | Promise<void>;
}) {
  type PendingUpdate = { status: ChecklistItemStatus; note: string };
  type InFlightWrite = { update: PendingUpdate; promise: Promise<boolean> };
  const pendingUpdates = useRef(new Map<string, PendingUpdate>());
  const inFlightWrites = useRef(new Map<string, InFlightWrite>());

  const persist = (id: string, update: PendingUpdate): Promise<boolean> => {
    const existing = inFlightWrites.current.get(id);
    if (existing?.update === update) return existing.promise;

    const write = async () => {
      try {
        await props.onUpdate(id, update.status, update.note);
        if (pendingUpdates.current.get(id) === update) pendingUpdates.current.delete(id);
        return true;
      } catch {
        return false;
      }
    };
    const work = existing === undefined ? write() : existing.promise.then(write);
    const inFlight: InFlightWrite = { update, promise: Promise.resolve(false) };
    inFlight.promise = work.then((succeeded) => {
      if (inFlightWrites.current.get(id) === inFlight) inFlightWrites.current.delete(id);
      return succeeded;
    });
    inFlightWrites.current.set(id, inFlight);
    return inFlight.promise;
  };

  const commit = (id: string, status: ChecklistItemStatus, note: string) => {
    const update = { status, note };
    pendingUpdates.current.set(id, update);
    void persist(id, update);
  };

  const flushNotesAndFinish = async () => {
    while (pendingUpdates.current.size > 0) {
      const writes = [...pendingUpdates.current].map(async ([id, update]) => {
        const succeeded = await persist(id, update);
        if (succeeded || pendingUpdates.current.get(id) !== update) return true;
        return persist(id, update);
      });
      if ((await Promise.all(writes)).some((succeeded) => !succeeded)) return;
    }
    await props.onFinish();
  };
  return (
    <View style={styles.group}>
      <Text>这不是需要全部勾选的通关表</Text>
      {props.items.map((item) => (
        <ChecklistItemRow
          key={item.id}
          item={item}
          onNoteChange={(id, status, note) => pendingUpdates.current.set(id, { status, note })}
          onUpdate={commit}
        />
      ))}
      <Action label="完成回顾" onPress={flushNotesAndFinish} />
    </View>
  );
}

function ChecklistItemRow({ item, onNoteChange, onUpdate }: {
  item: { id: string; status: ChecklistItemStatus; userNote: string; label: string };
  onNoteChange(id: string, status: ChecklistItemStatus, note: string): void;
  onUpdate(id: string, status: ChecklistItemStatus, note: string): void | Promise<void>;
}) {
  const [status, setStatus] = useState(item.status);
  const [userNote, setUserNote] = useState(item.userNote);
  const update = (nextStatus: ChecklistItemStatus) => {
    setStatus(nextStatus);
    onUpdate(item.id, nextStatus, userNote);
  };
  return (
    <View>
      <Text>{item.label}</Text>
      <TextInput
        accessibilityLabel={`${item.label}补充说明（${item.id}）`}
        maxLength={240}
        onChangeText={(note) => {
          setUserNote(note);
          onNoteChange(item.id, status, note);
        }}
        placeholder="补充说明（可选）"
        value={userNote}
      />
      <Action label="已考虑" role="radio" selected={status === "considered"} onPress={() => update("considered")} />
      <Action label="还想准备" role="radio" selected={status === "prepare-more"} onPress={() => update("prepare-more")} />
      <Action label="与我无关" role="radio" selected={status === "not-relevant"} onPress={() => update("not-relevant")} />
    </View>
  );
}

export type ClipboardActionState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success" }
  | { status: "error"; code: "clipboard-write-failed" };

export function CommunicationCardPage(props: {
  fields: Array<{ id: string; text: string; needsReview: boolean }>;
  pointTotal: number;
  copyState?: ClipboardActionState;
  onEdit(id: string, text: string): void;
  onSave(): void;
  onCopy(): void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  if (fullscreen) {
    return (
      <View style={styles.fullscreen}>
        {props.fields.map((field) => <Text key={field.id}>{field.text}</Text>)}
        <Text>暂停与确认表达保持可见</Text>
        <Action label="退出展示" onPress={() => setFullscreen(false)} />
      </View>
    );
  }
  return (
    <View style={styles.group}>
      <Text>根据妳刚才的选择整理</Text>
      {props.fields.map((field) => (
        <View key={field.id}>
          <TextInput value={field.text} onChangeText={(text) => props.onEdit(field.id, text)} />
          {field.needsReview ? <Text>需要复核</Text> : null}
        </View>
      ))}
      <Text>{`探索积分：${props.pointTotal}`}</Text>
      <Action label="本机保存" onPress={props.onSave} />
      <Action label="复制当前卡片" disabled={props.copyState?.status === "pending"} onPress={props.onCopy} />
      {props.copyState?.status === "pending"
        ? <Text accessibilityLiveRegion="polite">正在复制…</Text>
        : null}
      {props.copyState?.status === "success"
        ? <Text accessibilityLiveRegion="polite">已复制</Text>
        : null}
      {props.copyState?.status === "error"
        ? <Text accessibilityLiveRegion="assertive">复制失败，请重试</Text>
        : null}
      <Action label="现场展示" onPress={() => setFullscreen(true)} />
      <Action label="云端保存（即将提供）" disabled />
    </View>
  );
}

const styles = StyleSheet.create({
  action: { paddingVertical: 8 },
  fullscreen: { flex: 1, gap: 20, justifyContent: "center", padding: 24 },
  group: { gap: 12 }
});
