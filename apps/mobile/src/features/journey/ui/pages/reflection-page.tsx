import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import { Card } from "../../../../core/ui/Card";
import { InfoCard } from "../../../../core/ui/info-card";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { TextAction } from "../../../../core/ui/text-action";
import type { JournalSaveChoice } from "../../domain/types";
import type { BehaviorAttitude } from "../../domain/types";
import { loadJourneyContentCatalog } from "../../infrastructure/journey-content-catalog";
import { JourneyAction } from "../components/JourneyAction";
import { JourneyChoice } from "../components/JourneyChoice";
import { JourneyScrollTarget, useJourneyGuidedScroll } from "../guided-scroll-screen";
import type { JourneyAction as JourneyActionCallback } from "../journey-ui-contracts";

type PressureAnswer = "still-want" | "slow-down" | "unsure" | "less-want" | "skip";
type RefusalSafety = "can" | "difficult-but-possible" | "fear-reaction" | "cannot-refuse" | "unsure";
type ExpressionDifficulty = "can-say" | "needs-phrase" | "not-ready" | "unsure";
type ComfortClarity = "mostly-clear" | "need-space";

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
  onEditBehaviorAttitude?(behaviorId: string, attitude: BehaviorAttitude): ReturnType<JourneyActionCallback>;
  onOpenComfort?(): ReturnType<JourneyActionCallback>;
  onOpenJournal?(): ReturnType<JourneyActionCallback>;
  onUsePracticePhrase?(phrase: string): ReturnType<JourneyActionCallback>;
  onComplete(value: ReflectionValue): ReturnType<JourneyActionCallback>;
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

const reviewGroups: Array<{ attitude: BehaviorAttitude; label: string }> = [
  { attitude: "looking-forward", label: "我有些期待" },
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

function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
      {children}
    </Text>
  );
}

function SupportingCopy({ children }: { children: string }) {
  const theme = useTheme();
  return <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{children}</Text>;
}

export function ReflectionPage({
  initialValue = {},
  behaviorAnswers = [],
  onEditBehaviorAttitude,
  onOpenComfort,
  onOpenJournal,
  onUsePracticePhrase,
  onComplete,
  storageMode = "device",
}: ReflectionPageProps) {
  const theme = useTheme();
  const { reveal } = useJourneyGuidedScroll();
  const [motivationIds, setMotivationIds] = useState(() => [...(initialValue.motivationIds ?? [])]);
  const [pressureWithoutDisappointment, setPressureWithoutDisappointment] = useState<PressureAnswer | null>(
    initialValue.pressureWithoutDisappointment ?? null,
  );
  const [refusalSafety, setRefusalSafety] = useState<RefusalSafety | null>(initialValue.refusalSafety ?? null);
  const [expressionDifficulty, setExpressionDifficulty] = useState<ExpressionDifficulty | null>(
    initialValue.expressionDifficulty ?? null,
  );
  const [comfortClarity, setComfortClarity] = useState<ComfortClarity | null>(initialValue.comfortClarity ?? null);
  const [comfortNeedIds, setComfortNeedIds] = useState(() => [...(initialValue.comfortNeedIds ?? [])]);
  const [comfortNote, setComfortNote] = useState(initialValue.comfortNote ?? "");
  const [journalPromptId, setJournalPromptId] = useState<string | undefined>(initialValue.journalPromptId);
  const [journalText, setJournalText] = useState(initialValue.journalText ?? "");
  const [journalSaveChoice, setJournalSaveChoice] = useState<JournalSaveChoice>(storageMode === "session-only"
    ? "not-saved"
    : initialValue.journalSaveChoice ?? "not-saved");
  const [journalDecisionMade, setJournalDecisionMade] = useState(
    initialValue.journalSaveChoice !== undefined,
  );
  const [journalStorageOpen, setJournalStorageOpen] = useState(false);
  const [localBehaviorAnswers, setLocalBehaviorAnswers] = useState(() => [...behaviorAnswers]);
  const [editingBehaviorId, setEditingBehaviorId] = useState<string | null>(null);
  const motivationAdvancedRef = useRef(false);
  const comfortAdvancedRef = useRef(false);
  const advancedSingleGroupsRef = useRef(new Set<string>());

  const revealSingleOnce = (groupId: string, targetId: string) => {
    if (advancedSingleGroupsRef.current.has(groupId)) return;
    advancedSingleGroupsRef.current.add(groupId);
    reveal(targetId);
  };

  const saveBehaviorAttitude = async (behaviorId: string, attitude: BehaviorAttitude) => {
    await onEditBehaviorAttitude?.(behaviorId, attitude);
    setLocalBehaviorAnswers((current) => current.map((answer) => answer.behaviorId === behaviorId
      ? { ...answer, attitude }
      : answer));
    setEditingBehaviorId(null);
    reveal("reflection-motivation");
  };

  const toggleMotivation = (id: string) => {
    setMotivationIds((current) => {
      if (id === skipMotivationId) return current.includes(id) ? [] : [id];
      const withoutSkip = current.filter((value) => value !== skipMotivationId);
      return withoutSkip.includes(id) ? withoutSkip.filter((value) => value !== id) : [...withoutSkip, id];
    });
    if (!motivationAdvancedRef.current) {
      motivationAdvancedRef.current = true;
      reveal(id === disappointmentMotivationId
        ? "reflection-pressure-question"
        : "reflection-refusal-question");
    }
  };

  const toggleComfort = (id: string) => {
    setComfortNeedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
    if (!comfortAdvancedRef.current) {
      comfortAdvancedRef.current = true;
      reveal("reflection-journal");
    }
  };

  const choosePressure = (answer: PressureAnswer) => {
    setPressureWithoutDisappointment(answer);
    revealSingleOnce("pressure", answer === "still-want" || answer === "slow-down" || answer === "less-want"
      ? "reflection-pressure-response"
      : "reflection-refusal-question");
  };

  const chooseRefusalSafety = (answer: RefusalSafety) => {
    setRefusalSafety(answer);
    revealSingleOnce("refusal-safety", answer === "fear-reaction" || answer === "cannot-refuse" || answer === "unsure"
      ? "reflection-refusal-support"
      : "reflection-expression-question");
  };

  const chooseExpressionDifficulty = (answer: ExpressionDifficulty) => {
    setExpressionDifficulty(answer);
    revealSingleOnce("expression-difficulty", answer === "needs-phrase" || answer === "not-ready"
      ? "reflection-expression-support"
      : "reflection-comfort-question");
  };

  const chooseComfortClarity = (answer: ComfortClarity) => {
    setComfortClarity(answer);
    revealSingleOnce("comfort-clarity", "reflection-comfort-needs");
  };

  const chooseJournalPrompt = (id: string) => {
    setJournalPromptId(id);
    revealSingleOnce("journal-prompt", "reflection-journal-input");
  };

  const completeJournalDecision = (choice: JournalSaveChoice) => {
    setJournalSaveChoice(choice);
    setJournalDecisionMade(true);
    setJournalStorageOpen(false);
    revealSingleOnce("journal-decision", "reflection-final-action");
  };

  const value: ReflectionValue = {
    motivationIds,
    pressureWithoutDisappointment,
    refusalSafety,
    expressionDifficulty,
    comfortClarity,
    comfortNeedIds,
    comfortNote,
    ...(journalPromptId ? { journalPromptId } : {}),
    journalText,
    journalSaveChoice,
  };
  const effectiveSaveChoice: JournalSaveChoice = storageMode === "session-only" ? "not-saved" : journalSaveChoice;
  const submissionValue: ReflectionValue = effectiveSaveChoice === "not-saved"
    ? {
        motivationIds,
        pressureWithoutDisappointment,
        refusalSafety,
        expressionDifficulty,
        comfortClarity,
        comfortNeedIds,
        comfortNote,
        journalText: "",
        journalSaveChoice: effectiveSaveChoice,
      }
    : value;
  const showsRefusalSafety = refusalSafety === "fear-reaction" || refusalSafety === "cannot-refuse" || refusalSafety === "unsure";

  return (
    <View style={{ gap: theme.space.xl, maxWidth: "100%", width: "100%" }} testID="page-4-content">
      <Card accessible={false} variant="muted">
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
          你准备了多少，不代表你做得好不好
        </Text>
        <SupportingCopy>这些答案不需要整齐，也可以随时改变；这里不会生成分数或准备度结论。</SupportingCopy>
      </Card>

      {localBehaviorAnswers.length > 0 ? (
        <Card accessible={false}>
          <SectionTitle>这是你刚才留下的答案</SectionTitle>
          {reviewGroups.map((group) => {
            const answers = localBehaviorAnswers.filter(({ attitude }) => attitude === group.attitude);
            return answers.length > 0 ? (
              <View key={group.attitude} style={{ gap: theme.space.sm }}>
                <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>{group.label}</Text>
                {answers.map((answer) => (
                  <View key={answer.behaviorId} style={{ gap: theme.space.compact }}>
                    <JourneyAction
                      accessibilityLabel={`修改${answer.behaviorLabel}的答案`}
                      label={answer.behaviorLabel}
                      loadingLabel="正在展开…"
                      onAction={onEditBehaviorAttitude
                        ? () => setEditingBehaviorId((current) => current === answer.behaviorId ? null : answer.behaviorId)
                        : undefined}
                    />
                    {editingBehaviorId === answer.behaviorId ? (
                      <View accessibilityRole="radiogroup" style={{ gap: theme.space.compact }}>
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

      <JourneyScrollTarget targetId="reflection-motivation">
      <Card accessible={false}>
        <SectionTitle>此刻，是什么在推动我靠近？</SectionTitle>
        <SupportingCopy>可以选择不止一个答案，也没有哪一种动机更加正确。</SupportingCopy>
        <View style={{ gap: theme.space.compact }}>
          {motivationOptions.map((option) => (
            <JourneyChoice
              key={option.id}
              label={option.label}
              onSelect={() => toggleMotivation(option.id)}
              selected={motivationIds.includes(option.id)}
            />
          ))}
        </View>
      </Card>
      </JourneyScrollTarget>

      {motivationIds.includes(disappointmentMotivationId) ? (
        <JourneyScrollTarget targetId="reflection-pressure-question">
        <Card accessible={false}>
          <InfoCard variant="pause">
            <SupportingCopy>顾及对方的感受，并不意味着你做错了什么。你仍然可以放慢、暂停或改变主意。</SupportingCopy>
          </InfoCard>
          <SectionTitle>如果暂时不用担心对方会不会失望，你此刻还想靠近吗？</SectionTitle>
          <View accessibilityRole="radiogroup" style={{ gap: theme.space.compact }}>
            {pressureOptions.map((option) => (
              <JourneyChoice
                accessibilityLabel={`如果不用担心失望：${option.label}`}
                key={option.value}
                label={option.label}
                mode="single"
                onSelect={() => choosePressure(option.value)}
                selected={pressureWithoutDisappointment === option.value}
              />
            ))}
          </View>
          <SupportingCopy>这道题不会覆盖你之前对任何行为留下的答案。</SupportingCopy>
          {pressureWithoutDisappointment === "still-want" || pressureWithoutDisappointment === "slow-down" ? (
            <JourneyScrollTarget targetId="reflection-pressure-response">
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
            </JourneyScrollTarget>
          ) : null}
          {pressureWithoutDisappointment === "less-want" ? (
            <JourneyScrollTarget targetId="reflection-pressure-response">
            <InfoCard variant="pause">
              <SupportingCopy>我知道你可能有所期待，但我现在不想尝试这件事。</SupportingCopy>
            </InfoCard>
            </JourneyScrollTarget>
          ) : null}
        </Card>
        </JourneyScrollTarget>
      ) : null}

      <JourneyScrollTarget targetId="reflection-refusal-question">
      <Card accessible={false}>
        <SectionTitle>此刻，你觉得自己可以说不、暂停或离开吗？</SectionTitle>
        <View accessibilityRole="radiogroup" style={{ gap: theme.space.compact }}>
          {refusalOptions.map((option) => (
            <JourneyChoice
              accessibilityLabel={`拒绝或离开：${option.label}`}
              key={option.value}
              label={option.label}
              mode="single"
              onSelect={() => chooseRefusalSafety(option.value)}
              selected={refusalSafety === option.value}
            />
          ))}
        </View>
        {showsRefusalSafety ? (
          <JourneyScrollTarget targetId="reflection-refusal-support">
          <InfoCard variant="safety">
            <SupportingCopy>如果说不、暂停或离开让你感到害怕，可以先把自己的安全和空间放在前面。你不需要马上作出关于亲密行为的决定。</SupportingCopy>
            <SupportingCopy>这不代表系统已经判断现实中正在发生危险。</SupportingCopy>
            {onOpenComfort ? (
              <JourneyAction
                label="看看什么能让我更安心"
                loadingLabel="正在打开…"
                onAction={onOpenComfort}
              />
            ) : null}
            {onOpenJournal ? (
              <JourneyAction
                label="先回到我的记录里"
                loadingLabel="正在打开…"
                onAction={onOpenJournal}
              />
            ) : null}
          </InfoCard>
          </JourneyScrollTarget>
        ) : null}
      </Card>
      </JourneyScrollTarget>

      <JourneyScrollTarget targetId="reflection-expression-question">
      <Card accessible={false}>
        <SectionTitle>如果感受发生变化，你觉得自己能让对方知道吗？</SectionTitle>
        <View accessibilityRole="radiogroup" style={{ gap: theme.space.compact }}>
          {expressionOptions.map((option) => (
            <JourneyChoice
              accessibilityLabel={`表达变化：${option.label}`}
              key={option.value}
              label={option.label}
              mode="single"
              onSelect={() => chooseExpressionDifficulty(option.value)}
              selected={expressionDifficulty === option.value}
            />
          ))}
        </View>
        {expressionDifficulty === "needs-phrase" ? (
          <JourneyScrollTarget targetId="reflection-expression-support">
          <InfoCard variant="education">
            <SupportingCopy>下一步会给你几句可以直接使用、也可以修改的表达。</SupportingCopy>
          </InfoCard>
          </JourneyScrollTarget>
        ) : null}
        {expressionDifficulty === "not-ready" ? (
          <JourneyScrollTarget targetId="reflection-expression-support">
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
              onAction={() => setExpressionDifficulty(null)}
            />
          </InfoCard>
          </JourneyScrollTarget>
        ) : null}
      </Card>
      </JourneyScrollTarget>

      <JourneyScrollTarget targetId="reflection-comfort-question">
      <Card accessible={false}>
        <SectionTitle>这个夜晚，如果要继续靠近，什么会让我更安心？</SectionTitle>
        <View accessibilityRole="radiogroup" style={{ gap: theme.space.compact }}>
          {comfortClarityOptions.map((option) => (
            <JourneyChoice
              accessibilityLabel={`安心清晰度：${option.label}`}
              key={option.value}
              label={option.label}
              mode="single"
              onSelect={() => chooseComfortClarity(option.value)}
              selected={comfortClarity === option.value}
            />
          ))}
        </View>
        {comfortClarity === "need-space" ? (
          <SupportingCopy>不需要马上找到完整答案。可以想一想希望怎样被询问、节奏如何变化，以及暂停以后希望发生什么。</SupportingCopy>
        ) : null}
        <JourneyScrollTarget targetId="reflection-comfort-needs">
        <View style={{ gap: theme.space.compact }}>
          {comfortOptions.map((option) => (
            <JourneyChoice
              key={option.id}
              label={option.label}
              onSelect={() => toggleComfort(option.id)}
              selected={comfortNeedIds.includes(option.id)}
            />
          ))}
        </View>
        </JourneyScrollTarget>
        <TextInput
          accessibilityLabel="安心条件补充"
          maxLength={500}
          multiline
          onChangeText={setComfortNote}
          placeholder="对我来说，更安心的是……"
          placeholderTextColor={theme.color.textTertiary}
          selectionColor={theme.color.primary}
          style={{
            ...theme.typography.body,
            backgroundColor: theme.color.surfaceSubtle,
            borderColor: theme.color.border,
            borderCurve: "continuous",
            borderRadius: theme.radius.control,
            borderWidth: theme.border.width,
            color: theme.color.text,
            minHeight: 112,
            padding: theme.space.md,
            textAlignVertical: "top",
            width: "100%",
          }}
          value={comfortNote}
        />
      </Card>
      </JourneyScrollTarget>

      <JourneyScrollTarget targetId="reflection-journal">
      <Card accessible={false}>
        <SectionTitle>给此刻留一句话</SectionTitle>
        <SupportingCopy>没有标准答案，也不需要写得完整。空白也可以继续。</SupportingCopy>
        <View accessibilityRole="radiogroup" style={{ gap: theme.space.compact }}>
          {journalPrompts.map((prompt) => (
            <JourneyChoice
              accessibilityLabel={`写作提示：${prompt.label}`}
              key={prompt.id}
              label={prompt.label}
              mode="single"
              onSelect={() => chooseJournalPrompt(prompt.id)}
              selected={journalPromptId === prompt.id}
            />
          ))}
        </View>
        <JourneyScrollTarget targetId="reflection-journal-input">
        <TextInput
          accessibilityLabel="给此刻留一句话"
          maxLength={1200}
          multiline
          onChangeText={setJournalText}
          placeholder="写下此刻想记住的感受"
          placeholderTextColor={theme.color.textTertiary}
          selectionColor={theme.color.primary}
          style={{
            ...theme.typography.body,
            backgroundColor: theme.color.surfaceSubtle,
            borderColor: theme.color.border,
            borderCurve: "continuous",
            borderRadius: theme.radius.control,
            borderWidth: theme.border.width,
            color: theme.color.text,
            minHeight: 152,
            padding: theme.space.md,
            textAlignVertical: "top",
            width: "100%",
          }}
          value={journalText}
        />
        </JourneyScrollTarget>
        {storageMode === "session-only" ? (
          <SupportingCopy>仅用于本次回顾，离开后内容会清除。</SupportingCopy>
        ) : (
          <JourneyAction
            label="保存这次记录"
            loadingLabel="正在准备保存…"
            onAction={() => {
              setJournalStorageOpen(true);
            }}
          />
        )}
        <TextAction
          label="暂时不写"
          onPress={() => {
            completeJournalDecision("not-saved");
          }}
        />
      </Card>
      </JourneyScrollTarget>

      {storageMode === "device" && journalDecisionMade ? <Card accessible={false}>
        <SectionTitle>这条记录要放在哪里？</SectionTitle>
        {journalSaveChoice === "device" ? <SupportingCopy>只保存在这台设备</SupportingCopy> : null}
        <SupportingCopy>记录不会上传到云端。更换设备、删除 App 或清除数据后，可能无法找回。</SupportingCopy>
        <SupportingCopy>如果其他人能够打开你的设备和 CAVE，也可能看到这些记录。</SupportingCopy>
        {journalSaveChoice === "not-saved" ? <SupportingCopy>这次不会保存记录正文。</SupportingCopy> : null}
      </Card> : null}

      <JourneyScrollTarget targetId="reflection-final-action">
      <JourneyAction
        accessibilityLabel={storageMode === "session-only" ? "完成本次回顾" : "带着这些发现去练习"}
        errorMessage={storageMode === "session-only" ? "完成回顾失败，请重试。" : "保存反思失败，请重试。"}
        label={storageMode === "session-only" ? "完成本次回顾" : "带着这些发现去练习"}
        loadingLabel={storageMode === "session-only" ? "正在完成回顾…" : "正在保存这些发现…"}
        onAction={() => onComplete(submissionValue)}
      />
      </JourneyScrollTarget>

      {storageMode === "device" ? (
        <BottomSheet
          onClose={() => setJournalStorageOpen(false)}
          title="记录会保存在哪里？"
          visible={journalStorageOpen}
        >
          <SupportingCopy>记录不会上传到云端。更换设备、删除 App 或清除数据后，可能无法找回。</SupportingCopy>
          <SupportingCopy>如果其他人能够打开你的设备和 CAVE，也可能看到这些记录。</SupportingCopy>
          <SecondaryButton
            label="确认只保存在这台设备"
            onPress={() => {
              completeJournalDecision("device");
            }}
          />
          <TextAction label="返回修改" onPress={() => setJournalStorageOpen(false)} />
        </BottomSheet>
      ) : null}
    </View>
  );
}
