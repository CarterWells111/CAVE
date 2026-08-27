import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { BehaviorAttitude, ChecklistItemStatus, JournalSaveChoice } from "../../domain/types";

function Action({ label, onPress, disabled = false }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}>
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
  onContinue(input: { expectationIds: string[]; concernIds: string[]; customNote: string }): void;
}) {
  const [expectationIds, setExpectationIds] = useState<string[]>([]);
  const [concernIds, setConcernIds] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");
  const toggle = (ids: string[], id: string, update: (next: string[]) => void) => {
    update(ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  };
  return (
    <View style={styles.group}>
      <Text>我对过夜情境的期待</Text>
      {props.expectationOptions.map((option) => (
        <Action key={option.id} label={option.label} onPress={() => toggle(expectationIds, option.id, setExpectationIds)} />
      ))}
      <Text>我在意或担心的事</Text>
      {props.concernOptions.map((option) => (
        <Action key={option.id} label={option.label} onPress={() => toggle(concernIds, option.id, setConcernIds)} />
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
  onSet(id: string, attitude: BehaviorAttitude): void;
}) {
  return (
    <View style={styles.group}>
      <Text>每项都可独立选择，没有高低顺序</Text>
      {props.behaviors.map((behavior) => (
        <View key={behavior.id}>
          <Text>{behavior.label}</Text>
          {ATTITUDES.map(({ value, label }) => (
            <Action key={value} label={label} onPress={() => props.onSet(behavior.id, value)} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function ReflectionPage({ onComplete }: {
  onComplete(input: { motivationIds: string[]; comfortNeedIds: string[]; expressionSupportNeeded: boolean | null; journalSaveChoice: JournalSaveChoice }): void;
}) {
  return (
    <View style={styles.group}>
      <Text>回看动机、压力和安心条件（草稿）</Text>
      <Text>本机加密保存</Text>
      <Action label="完成反思" onPress={() => onComplete({
        motivationIds: [],
        comfortNeedIds: [],
        expressionSupportNeeded: null,
        journalSaveChoice: "device"
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
  onUpdate(id: string, status: ChecklistItemStatus, note: string): void;
  onFinish(): void;
}) {
  return (
    <View style={styles.group}>
      <Text>这不是需要全部勾选的通关表</Text>
      {props.items.map((item) => (
        <View key={item.id}>
          <Text>{item.label}</Text>
          <Action label="已考虑" onPress={() => props.onUpdate(item.id, "considered", item.userNote)} />
          <Action label="还想准备" onPress={() => props.onUpdate(item.id, "prepare-more", item.userNote)} />
          <Action label="与我无关" onPress={() => props.onUpdate(item.id, "not-relevant", item.userNote)} />
        </View>
      ))}
      <Action label="完成回顾" onPress={props.onFinish} />
    </View>
  );
}

export function CommunicationCardPage(props: {
  fields: Array<{ id: string; text: string; needsReview: boolean }>;
  pointTotal: number;
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
      <Action label="复制当前卡片" onPress={props.onCopy} />
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
