import type { JourneyPracticeCatalog } from "@cave/content";
import { useEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { Button } from "../../../../core/ui/Button";
import { Card } from "../../../../core/ui/Card";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import { InfoCard } from "../../../../core/ui/info-card";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { TextAction } from "../../../../core/ui/text-action";
import type { PracticeIntent } from "../../domain/practice-types";
import {
  beginPractice,
  chooseAftercare,
  chooseOptionalBranch,
  closeSafetyPractice,
  completeMirror,
  completePractice,
  continueToAftercare,
  editOptionalUserResponse,
  editPracticePhrase,
  selectOptionalUserResponse,
  selectPracticeNeed,
  showRespectfulResponse,
  skipMirror,
  startScenario,
  type SevenScreenPracticeState
} from "../../domain/seven-screen-practice-machine";
import { JourneyAction } from "../components/JourneyAction";
import { JourneyScrollTarget, useJourneyGuidedScroll } from "../guided-scroll-screen";
import { useJourneyStepBack } from "../journey-step-back";

type Props = {
  context?: "journey" | "standalone";
  initialIntent?: PracticeIntent;
  initialPhrase?: string;
  catalog: JourneyPracticeCatalog;
  onComplete(input: {
    behaviorId: string | null;
    intent: PracticeIntent;
    phrase: string;
    aftercareId: string;
    completed: true;
    pointEventKey?: string;
    optionalBranch?: SevenScreenPracticeState["optionalBranch"];
    optionalResponse?: string;
  }): void | Promise<void>;
  onCopySupportNumber?: (number: string) => void | Promise<void>;
  onOpenSources?: () => void | Promise<void>;
  onAddToPreparation?: (phrase: string) => void | Promise<void>;
  onPracticeAgain?: () => void | Promise<void>;
};

const NEEDS: ReadonlyArray<{ intent: PracticeIntent; label: string }> = [
  { intent: "slow-down", label: "整体推进得有点快" },
  { intent: "adjust-touch", label: "当前动作太快或力度不舒服" },
  { intent: "pause-and-decide", label: "想先暂停，再感受一下" },
  { intent: "stop-current-action", label: "不想继续正在发生的事" },
  { intent: "choose-another-closeness", label: "想换一种亲近方式" },
  { intent: "pause-to-feel", label: "还不知道接下来想怎样" }
];

const AFTERCARE = [
  { id: "quiet", label: "安静待一会儿" },
  { id: "space", label: "保持一点距离" },
  { id: "hug-if-asked", label: "如果双方都愿意，只抱一会儿" },
  { id: "end-night", label: "结束这个夜晚的亲密接触" },
  { id: "undecided", label: "我还不想决定" }
] as const;

const COMPLETION_FEELINGS = [
  "更容易开口一点",
  "还是有些紧张",
  "可能需要更短一句",
  "还不知道",
  "想自己记下来",
  "暂时不记录",
] as const;

function Heading({ children }: { children: string }) {
  const theme = useTheme();
  return <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>{children}</Text>;
}

function Body({ children }: { children: string }) {
  const theme = useTheme();
  return <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{children}</Text>;
}

export function PresetPracticePage({
  catalog,
  onComplete,
  onAddToPreparation,
  onCopySupportNumber,
  onOpenSources,
  onPracticeAgain,
  context = "journey",
  initialIntent,
  initialPhrase,
}: Props) {
  const theme = useTheme();
  const { reveal } = useJourneyGuidedScroll();
  const initial = useMemo(() => beginPractice(catalog), [catalog]);
  const [state, setState] = useState<SevenScreenPracticeState>(initial);
  const [mirrorVisible, setMirrorVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftPhrase, setDraftPhrase] = useState("");
  const [optionalResponseEditing, setOptionalResponseEditing] = useState(false);
  const [optionalResponseDraft, setOptionalResponseDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completionFeelings, setCompletionFeelings] = useState<string[]>([]);
  const [completionStep, setCompletionStep] = useState<"review" | "actions">("review");
  const submittedRef = useRef(false);
  const historyRef = useRef<SevenScreenPracticeState[]>([]);
  const previousVisibleStepRef = useRef("entry");
  const selectedNeedLabel = NEEDS.find(({ intent }) => intent === state.intent)?.label;
  const selectedAftercareLabel = AFTERCARE.find(({ id }) => id === state.aftercareId)?.label;
  const visibleStep = mirrorVisible
    ? "mirror"
    : state.stage === "completed"
      ? `completed-${completionStep}`
      : state.stage;

  useEffect(() => {
    if (previousVisibleStepRef.current === visibleStep) return;
    previousVisibleStepRef.current = visibleStep;
    reveal(`practice-stage-${visibleStep}`, { mode: "nearest" });
  }, [reveal, visibleStep]);

  const advanceTo = (next: SevenScreenPracticeState) => {
    historyRef.current.push(state);
    setState(next);
  };

  const startPractice = () => {
    const started = startScenario(state);
    const selected = initialIntent ? selectPracticeNeed(started, initialIntent) : started;
    const next = initialPhrase && selected.phrase
      ? editPracticePhrase(selected, initialPhrase)
      : selected;
    setDraftPhrase(next.phrase ?? "");
    advanceTo(next);
  };
  const chooseNeed = (intent: PracticeIntent) => {
    const next = selectPracticeNeed(state, intent);
    setDraftPhrase(next.phrase ?? "");
    advanceTo(next);
  };
  const usePhrase = () => {
    const edited = editPracticePhrase(state, draftPhrase || state.phrase || "");
    advanceTo(showRespectfulResponse(edited, catalog));
    setEditing(false);
  };
  const completionInput = (completed: SevenScreenPracticeState) => {
    if (!completed.intent || !completed.phrase || !completed.aftercareId) {
      throw new Error("practice-completion-required");
    }
    return {
      behaviorId: completed.behaviorId ?? null,
      intent: completed.intent,
      phrase: completed.phrase,
      aftercareId: completed.aftercareId,
      completed: true as const,
      ...(completed.pointEventKey ? { pointEventKey: completed.pointEventKey } : {}),
      ...(completed.optionalBranch ? { optionalBranch: completed.optionalBranch } : {}),
      ...(completed.optionalUserResponse ? { optionalResponse: completed.optionalUserResponse } : {})
    };
  };
  const submit = async () => {
    if (submittedRef.current) return;
    const completed = completePractice(state);
    setState(completed);
    setSubmitting(true);
    try {
      await onComplete(completionInput(completed));
      submittedRef.current = true;
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };
  const toggleCompletionFeeling = (feeling: string) => {
    setCompletionFeelings((current) => {
      if (feeling === "暂时不记录") return current.includes(feeling) ? [] : [feeling];
      const withoutSkip = current.filter((value) => value !== "暂时不记录");
      return withoutSkip.includes(feeling)
        ? withoutSkip.filter((value) => value !== feeling)
        : [...withoutSkip, feeling];
    });
  };

  const returnToPreviousStep = () => {
    if (mirrorVisible) {
      setMirrorVisible(false);
      return;
    }
    if (editing) {
      setEditing(false);
      return;
    }
    if (optionalResponseEditing) {
      setOptionalResponseEditing(false);
      return;
    }
    if (state.stage === "completed" && completionStep === "actions") {
      setCompletionStep("review");
      return;
    }
    const previous = historyRef.current.pop();
    if (!previous) return;
    setMirrorVisible(false);
    setEditing(false);
    setOptionalResponseEditing(false);
    setCompletionStep("review");
    setDraftPhrase(previous.phrase ?? "");
    setOptionalResponseDraft(previous.optionalUserResponse ?? "");
    setState(previous);
  };

  useJourneyStepBack({
    active: context === "journey" && (
      mirrorVisible
      || editing
      || optionalResponseEditing
      || (state.stage === "completed" && completionStep === "actions")
      || historyRef.current.length > 0
    ),
    disabled: submitting || submitted,
    onBack: returnToPreviousStep,
  });

  return (
    <View style={{ gap: theme.space.lg, width: "100%" }} testID="page-5-content">
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm, justifyContent: "space-between" }}>
        <Text style={{ ...theme.typography.caption, color: theme.color.info }}>预设对话，不使用 AI</Text>
        {context === "standalone" ? <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>独立练习</Text> : null}
      </View>

      <JourneyScrollTarget targetId={`practice-stage-${visibleStep}`}>
      <View style={{ gap: theme.space.lg, width: "100%" }}>

      {state.stage === "entry" ? (
        <>
          <Heading>改变主意，也属于过程</Heading>
          <Card variant="accent">
            <Heading>暂停不需要道歉。</Heading>
            <Body>一开始愿意，不代表之后必须继续。你可以放慢、暂停、换一种方式，或者结束正在发生的事。</Body>
          </Card>
          <Card>
            <Heading>练习前灵感</Heading>
            <Body>练习不是为了表现得正确，而是帮助你慢慢发现、听见和讲述自己的需要。</Body>
            <Button label="开始情境练习" onPress={startPractice} />
          </Card>
        </>
      ) : null}

      {mirrorVisible ? (
        <Card accessibilityLabel="镜前练习，不录音">
          <Heading>先对着镜子说一遍</Heading>
          <Body>这次练习不会录音、不会请求麦克风权限，也不会识别你说了什么。</Body>
          {state.phrase ? <Body>{state.phrase}</Body> : null}
          <Button label="我说过一遍了" onPress={() => { setState(completeMirror(state)); setMirrorVisible(false); }} />
          <SecondaryButton label="我想再看看这句话" onPress={() => setMirrorVisible(false)} />
          <TextAction label="暂时跳过" onPress={() => { setState(skipMirror(state)); setMirrorVisible(false); }} />
        </Card>
      ) : null}

      {state.stage === "need" ? (
        <Card>
          <Heading>感受可以在过程中改变</Heading>
          <Body>你和对方正在按照已经商量好的方式亲近。开始时，这是你愿意的。</Body>
          <Body>过了一会儿，你发现自己的感受有了变化。</Body>
          <Body>感受发生变化，不需要一个足够充分的理由。</Body>
          <Heading>此刻，你更接近哪一种需要？</Heading>
          {NEEDS.map((need) => (
            <ChoiceChip key={need.intent} label={need.label} onPress={() => chooseNeed(need.intent)} selected={false} semantics="radio" />
          ))}
        </Card>
      ) : null}

      {!mirrorVisible && state.stage === "editable-phrase" ? (
        <Card>
          <Heading>把需要说出来</Heading>
          {editing ? (
            <TextInput
              accessibilityLabel="我的表达句"
              multiline
              onChangeText={setDraftPhrase}
              style={{ ...theme.typography.body, borderColor: theme.color.interactiveBorder, borderRadius: theme.radius.control, borderWidth: theme.border.width, color: theme.color.text, minHeight: 112, padding: theme.space.md }}
              value={draftPhrase}
            />
          ) : <Body>{state.phrase ?? ""}</Body>}
          <Button label="就用这句话" onPress={usePhrase} />
          <SecondaryButton label="改成我的说法" onPress={() => setEditing(true)} />
          <TextAction label="先对着镜子说一遍" onPress={() => setMirrorVisible(true)} />
        </Card>
      ) : null}

      {state.stage === "respectful-response" ? (
        <Card>
          <Heading>一种尊重边界的回应</Heading>
          <Body>{state.partnerResponse ?? ""}</Body>
          <Button label="继续" onPress={() => advanceTo(continueToAftercare(state))} />
        </Card>
      ) : null}

      {state.stage === "aftercare" ? (
        <Card>
          <Heading>停下来以后，此刻的你更想怎样？</Heading>
          {AFTERCARE.map((option) => (
            <ChoiceChip key={option.id} label={option.label} onPress={() => advanceTo(chooseAftercare(state, option.id))} selected={false} semantics="radio" />
          ))}
        </Card>
      ) : null}

      {state.stage === "optional-branch" ? (
        <Card>
          {state.aftercareId === "hug-if-asked" ? (
            <InfoCard variant="education">
              <Body>现在可以抱你吗？</Body>
              <Body>停止原来的行为，不自动等于同意拥抱。</Body>
            </InfoCard>
          ) : null}
          <Heading>可选练习</Heading>
          <Body>接下来的情境可能让人不舒服。你可以跳过，不影响流程或积分。</Body>
          <Button label="跳过不太理想的回应" onPress={() => advanceTo(chooseOptionalBranch(state, catalog, "skip"))} />
          <SecondaryButton
            label="也练习一次不太理想的回应"
            onPress={() => advanceTo(chooseOptionalBranch(state, catalog, "disappointed-but-stops"))}
          />
        </Card>
      ) : null}

      {state.stage === "optional-response" && state.optionalBranch ? (
        <Card>
          <Heading>预设回应练习</Heading>
          {state.optionalPartnerText ? <Body>{state.optionalPartnerText}</Body> : null}
          {state.optionalUserTexts?.map((text) => (
            <ChoiceChip
              key={text}
              label={text}
              onPress={() => {
                setOptionalResponseDraft(text);
                setState(selectOptionalUserResponse(state, text));
              }}
              selected={state.optionalUserResponse === text && !state.optionalUserResponseEdited}
              semantics="radio"
            />
          ))}
          {optionalResponseEditing ? (
            <TextInput
              accessibilityLabel="我的可选回应"
              multiline
              onChangeText={setOptionalResponseDraft}
              style={{ ...theme.typography.body, borderColor: theme.color.interactiveBorder, borderRadius: theme.radius.control, borderWidth: theme.border.width, color: theme.color.text, minHeight: 112, padding: theme.space.md }}
              value={optionalResponseDraft}
            />
          ) : null}
          <SecondaryButton
            label="改成我的说法"
            onPress={() => {
              setOptionalResponseDraft(state.optionalUserResponse ?? state.optionalUserTexts?.[0] ?? "");
              setOptionalResponseEditing(true);
            }}
          />
          {optionalResponseEditing ? (
            <Button
              disabled={!optionalResponseDraft.trim()}
              label="使用这句回应"
              onPress={() => {
                setState(editOptionalUserResponse(state, optionalResponseDraft));
                setOptionalResponseEditing(false);
              }}
            />
          ) : null}
          {state.optionalGuidance ? <Body>{state.optionalGuidance}</Body> : null}
          {state.optionalBranch === "disappointed-but-stops" ? (
            <>
              <Button
                disabled={!state.optionalUserResponse}
                label="完成这个分支"
                onPress={() => advanceTo(completePractice(state))}
              />
              <SecondaryButton
                disabled={!state.optionalUserResponse}
                label="继续练习对方施压"
                onPress={() => advanceTo(chooseOptionalBranch(state, catalog, "continues-pressure"))}
              />
            </>
          ) : null}
          {state.optionalBranch === "continues-pressure" ? (
            <>
              <Button
                disabled={!state.optionalUserResponse}
                label="对方停止，完成练习"
                onPress={() => advanceTo(completePractice(state))}
              />
              <SecondaryButton
                disabled={!state.optionalUserResponse}
                label="对方仍在说服、继续触碰或阻止离开"
                onPress={() => advanceTo(chooseOptionalBranch(state, catalog, "ignores-or-blocks-exit"))}
              />
            </>
          ) : null}
        </Card>
      ) : null}

      {state.stage === "safety-resources" ? (
        <Card style={{ borderColor: theme.color.danger }}>
          <Heading>这不是因为你没有说清楚</Heading>
          <Body>{state.optionalGuidance ?? "优先选择对自己安全、可行的行动。"}</Body>
          {catalog.supportResources.map((resource) => (
            <View key={resource.number} style={{ gap: theme.space.sm }}>
              <Text style={{ ...theme.typography.heading, color: theme.color.text }}>{resource.number}</Text>
              <Body>{resource.usage}</Body>
              <TextAction label={`复制 ${resource.number}`} onPress={() => { void onCopySupportNumber?.(resource.number); }} />
            </View>
          ))}
          <SecondaryButton
            accessibilityLabel="打开内界官网信息来源"
            label="查看完整信息来源"
            onPress={() => { void onOpenSources?.(); }}
          />
          <Button label="结束这次练习" onPress={() => advanceTo(closeSafetyPractice(state))} />
        </Card>
      ) : null}

      {state.stage === "completed" ? (
        completionStep === "review" ? (
          <Card>
            <Heading>这次练习先到这里</Heading>
            <Body>你刚刚练习了发现感受的变化、表达此刻的需要，以及辨认什么样的回应是在尊重边界。</Body>
            <Body>真正发生时，你可以说得更短，也可以随时换一种表达。</Body>
            <Heading>这次练习回看</Heading>
            <Body>{`我注意到的需要：${selectedNeedLabel ?? "未选择"}`}</Body>
            <Body>{`我想使用的话：${state.phrase ?? "未选择"}`}</Body>
            <Body>{`停下来以后，我更想：${selectedAftercareLabel ?? "未选择"}`}</Body>
            <Heading>刚才试着说出这句话时，你有什么感觉？</Heading>
            {COMPLETION_FEELINGS.map((feeling) => (
              <ChoiceChip
                key={feeling}
                label={feeling}
                onPress={() => toggleCompletionFeeling(feeling)}
                selected={completionFeelings.includes(feeling)}
                semantics="checkbox"
              />
            ))}
            {completionFeelings.includes("可能需要更短一句") ? (
              <>
                <Heading>也可以用更短的一句</Heading>
                <Body>先停一下，我需要一点时间。</Body>
              </>
            ) : null}
            <Button label="继续" onPress={() => setCompletionStep("actions")} />
          </Card>
        ) : (
          <Card>
            <Heading>接下来，你可以</Heading>
            {onAddToPreparation ? (
              <JourneyAction
                errorMessage="加入准备清单失败，请重试。"
                label="把这句话加入准备清单"
                loadingLabel="正在加入准备清单…"
                onAction={() => onAddToPreparation(state.phrase ?? "")}
              />
            ) : null}
            {onPracticeAgain ? (
              <SecondaryButton label="再练习一个情境" onPress={() => { void onPracticeAgain(); }} />
            ) : null}
            <JourneyAction
              disabled={submitted}
              errorMessage={context === "standalone" ? "完成练习失败，请重试。" : "保存练习失败，请重试。"}
              label={context === "standalone"
                ? "完成本次练习"
                : submitted ? "已保存练习" : "继续整理我的准备"}
              loadingLabel={context === "standalone" ? "正在完成练习…" : "正在保存练习…"}
              onAction={submit}
            />
            {submitted && context === "standalone" ? <Body>本次练习已完成，内容不会保存。</Body> : null}
            {submitted && context === "journey" ? <Body>+1 回响｜你完成了一次表达练习</Body> : null}
          </Card>
        )
      ) : null}
      </View>
      </JourneyScrollTarget>
    </View>
  );
}
