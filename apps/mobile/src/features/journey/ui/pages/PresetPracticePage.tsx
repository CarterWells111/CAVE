import type { JourneyPracticeCatalog } from "@cave/content";
import { useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { theme } from "../../../../core/design/theme";
import { Button } from "../../../../core/ui/Button";
import { Card } from "../../../../core/ui/Card";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import { InfoCard } from "../../../../core/ui/info-card";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { TextAction } from "../../../../core/ui/text-action";
import type { PracticeIntent } from "../../domain/practice-types";
import type { BehaviorAttitude } from "../../domain/types";
import {
  beginPractice,
  chooseAftercare,
  chooseOptionalBranch,
  closeSafetyPractice,
  completeMirror,
  completePractice,
  editOptionalUserResponse,
  editPracticePhrase,
  selectOptionalUserResponse,
  selectPracticeBehavior,
  selectPracticeNeed,
  showRespectfulResponse,
  skipMirror,
  startScenario,
  type SevenScreenPracticeState
} from "../../domain/seven-screen-practice-machine";
import { JourneyAction } from "../components/JourneyAction";

type Props = {
  context?: "journey" | "standalone";
  catalog: JourneyPracticeCatalog;
  behaviorOptions: Array<{
    id: string;
    label: string;
    attitude?: BehaviorAttitude;
    requiresFreshSelection?: boolean;
  }>;
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
  onOpenSources?: (sourceIds: string[]) => void | Promise<void>;
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
  return <Text accessibilityRole="header" style={{ ...theme.typography.heading, color: theme.color.text }}>{children}</Text>;
}

function Body({ children }: { children: string }) {
  return <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>{children}</Text>;
}

export function PresetPracticePage({
  behaviorOptions,
  catalog,
  onComplete,
  onAddToPreparation,
  onCopySupportNumber,
  onOpenSources,
  onPracticeAgain,
  context = "journey",
}: Props) {
  const initial = useMemo(() => beginPractice(catalog), [catalog]);
  const [state, setState] = useState<SevenScreenPracticeState>(initial);
  const [mirrorVisible, setMirrorVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftPhrase, setDraftPhrase] = useState("");
  const [optionalResponseEditing, setOptionalResponseEditing] = useState(false);
  const [optionalResponseDraft, setOptionalResponseDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [completionFeelings, setCompletionFeelings] = useState<string[]>([]);
  const submittedRef = useRef(false);
  const availableBehaviorOptions = behaviorOptions.filter(
    ({ attitude }) => attitude !== "not-this-time" && attitude !== "skip",
  );
  const selectedBehaviorLabel = behaviorOptions.find(({ id }) => id === state.behaviorId)?.label;
  const selectedNeedLabel = NEEDS.find(({ intent }) => intent === state.intent)?.label;
  const selectedAftercareLabel = AFTERCARE.find(({ id }) => id === state.aftercareId)?.label;

  const chooseBehavior = (behaviorId: string | null) => setState((current) => selectPracticeBehavior(current, behaviorId));
  const chooseNeed = (intent: PracticeIntent) => {
    const next = selectPracticeNeed(state, intent);
    setDraftPhrase(next.phrase ?? "");
    setState(next);
  };
  const usePhrase = () => {
    const edited = editPracticePhrase(state, draftPhrase || state.phrase || "");
    setState(showRespectfulResponse(edited, catalog));
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
    await onComplete(completionInput(completed));
    submittedRef.current = true;
    setSubmitted(true);
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

  return (
    <View style={{ gap: theme.space.lg, width: "100%" }} testID="page-6-content">
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm, justifyContent: "space-between" }}>
        <Text style={{ ...theme.typography.caption, color: theme.color.info }}>预设对话，不使用 AI</Text>
        {context === "journey" ? (
          <Text accessibilityLabel="第 6 屏，共 7 屏" style={{ ...theme.typography.caption, color: theme.color.textMuted }}>6 / 7</Text>
        ) : <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>独立练习</Text>}
      </View>
      <Heading>改变主意，也属于过程</Heading>
      <Card variant="accent">
        <Heading>暂停不需要道歉。</Heading>
        <Body>一开始愿意，不代表之后必须继续。你可以放慢、暂停、换一种方式，或者结束正在发生的事。</Body>
      </Card>

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

      {!mirrorVisible && state.stage === "entry" ? (
        <Card>
          <Heading>练习前灵感</Heading>
          <Body>练习不是为了表现得正确，而是帮助你慢慢发现、听见和讲述自己的需要。</Body>
          <Button label="开始情境练习" onPress={() => setState(startScenario(state))} />
          <SecondaryButton disabled label="先选择一句话后可镜前练习" onPress={() => undefined} />
          <TextAction label="我想先看看可以怎么说" onPress={() => setState(startScenario(state))} />
        </Card>
      ) : null}

      {!mirrorVisible && state.stage === "behavior" ? (
        <Card>
          <Heading>这次想用哪一种靠近来练习？</Heading>
          {availableBehaviorOptions.map((option) => (
            <ChoiceChip
              key={option.id}
              label={option.requiresFreshSelection ? `${option.label}（需在本次练习中重新选择）` : option.label}
              onPress={() => chooseBehavior(option.id)}
              selected={false}
              semantics="radio"
            />
          ))}
          <SecondaryButton label="不说具体行为" onPress={() => chooseBehavior(null)} />
        </Card>
      ) : null}

      {state.stage === "need" ? (
        <Card>
          <Heading>感受可以在过程中改变</Heading>
          <Body>{selectedBehaviorLabel
            ? `你和对方正在按照之前商量好的方式进行${selectedBehaviorLabel}。开始时，这是你愿意的。`
            : "你和对方正在按照之前商量好的方式亲近。开始时，这是你愿意的。"}</Body>
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
          <Heading>停下来以后，此刻的你更想怎样？</Heading>
          {AFTERCARE.map((option) => (
            <ChoiceChip key={option.id} label={option.label} onPress={() => setState(chooseAftercare(state, option.id))} selected={false} semantics="radio" />
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
          <Button label="跳过不太理想的回应" onPress={() => setState(chooseOptionalBranch(state, catalog, "skip"))} />
          <SecondaryButton
            label="也练习一次不太理想的回应"
            onPress={() => setState(chooseOptionalBranch(state, catalog, "disappointed-but-stops"))}
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
                onPress={() => setState(completePractice(state))}
              />
              <SecondaryButton
                disabled={!state.optionalUserResponse}
                label="继续练习对方施压"
                onPress={() => setState(chooseOptionalBranch(state, catalog, "continues-pressure"))}
              />
            </>
          ) : null}
          {state.optionalBranch === "continues-pressure" ? (
            <>
              <Button
                disabled={!state.optionalUserResponse}
                label="对方停止，完成练习"
                onPress={() => setState(completePractice(state))}
              />
              <SecondaryButton
                disabled={!state.optionalUserResponse}
                label="对方仍在说服、继续触碰或阻止离开"
                onPress={() => setState(chooseOptionalBranch(state, catalog, "ignores-or-blocks-exit"))}
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
          <SecondaryButton label="查看信息来源" onPress={() => { void onOpenSources?.([...new Set(catalog.supportResources.flatMap(({ sourceIds }) => sourceIds))]); }} />
          <Button label="结束这次练习" onPress={() => setState(closeSafetyPractice(state))} />
        </Card>
      ) : null}

      {state.stage === "completed" ? (
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
          <Heading>也可以用更短的一句</Heading>
          <Body>先停一下，我需要一点时间。</Body>
          <JourneyAction
            disabled={!onAddToPreparation}
            errorMessage="加入准备清单失败，请重试。"
            label={onAddToPreparation ? "把这句话加入准备清单" : "把这句话加入准备清单（暂不可用）"}
            loadingLabel="正在加入准备清单…"
            onAction={() => onAddToPreparation?.(state.phrase ?? "")}
          />
          <SecondaryButton
            disabled={!onPracticeAgain}
            label={onPracticeAgain ? "再练习一个情境" : "再练习一个情境（暂不可用）"}
            onPress={() => { void onPracticeAgain?.(); }}
          />
          <JourneyAction
            disabled={submitted}
            errorMessage="保存练习失败，请重试。"
            label={submitted ? "已保存练习" : "继续整理我的准备"}
            loadingLabel="正在保存练习…"
            onAction={submit}
          />
          {submitted ? <Body>+1 回响｜你完成了一次表达练习</Body> : null}
        </Card>
      ) : null}
    </View>
  );
}
