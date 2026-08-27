import type { JourneyPracticeCatalog } from "@cave/content";
import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { theme } from "../../../../core/design/theme";
import { Button } from "../../../../core/ui/Button";
import { Card } from "../../../../core/ui/Card";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
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
  editPracticePhrase,
  selectPracticeBehavior,
  selectPracticeNeed,
  showRespectfulResponse,
  startScenario,
  type SevenScreenPracticeState
} from "../../domain/seven-screen-practice-machine";

type Props = {
  catalog: JourneyPracticeCatalog;
  behaviorOptions: Array<{ id: string; label: string }>;
  onComplete(input: {
    behaviorId: string | null;
    intent: PracticeIntent;
    phrase: string;
    aftercareId: string;
    completed: true;
    pointEventKey?: string;
  }): void | Promise<void>;
  onCopySupportNumber?: (number: string) => void | Promise<void>;
  onOpenSources?: (sourceIds: string[]) => void | Promise<void>;
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
  onCopySupportNumber,
  onOpenSources
}: Props) {
  const initial = useMemo(() => beginPractice(catalog), [catalog]);
  const [state, setState] = useState<SevenScreenPracticeState>(initial);
  const [mirrorVisible, setMirrorVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftPhrase, setDraftPhrase] = useState("");

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
  const finish = () => {
    const completed = completePractice(state);
    setState(completed);
    if (completed.intent && completed.phrase && completed.aftercareId) {
      void onComplete({
        behaviorId: completed.behaviorId ?? null,
        intent: completed.intent,
        phrase: completed.phrase,
        aftercareId: completed.aftercareId,
        completed: true,
        ...(completed.pointEventKey ? { pointEventKey: completed.pointEventKey } : {})
      });
    }
  };

  return (
    <View style={{ gap: theme.space.lg, width: "100%" }} testID="page-6-content">
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm, justifyContent: "space-between" }}>
        <Text style={{ ...theme.typography.caption, color: theme.color.info }}>预设对话，不使用 AI</Text>
        <Text accessibilityLabel="第 6 屏，共 7 屏" style={{ ...theme.typography.caption, color: theme.color.textMuted }}>6 / 7</Text>
      </View>
      <Heading>改变主意，也属于过程</Heading>
      <Card variant="accent">
        <Heading>暂停不需要道歉。</Heading>
        <Body>一开始愿意，不代表之后必须继续。你可以放慢、暂停、换一种方式，或者结束正在发生的事。</Body>
      </Card>

      {mirrorVisible ? (
        <Card accessibilityLabel="镜前练习，不录音">
          <Heading>先对着镜子说一遍</Heading>
          <Body>这次练习不会录音，也不会识别你说了什么。</Body>
          {state.phrase ? <Body>{state.phrase}</Body> : null}
          <Button label="我说过一遍了" onPress={() => { setState(completeMirror(state)); setMirrorVisible(false); }} />
          <SecondaryButton label="暂时跳过" onPress={() => { setState(startScenario(state)); setMirrorVisible(false); }} />
        </Card>
      ) : null}

      {!mirrorVisible && state.stage === "entry" ? (
        <Card>
          <Heading>练习前灵感</Heading>
          <Body>练习不是为了表现得正确，而是帮助你慢慢发现、听见和讲述自己的需要。</Body>
          <Button label="开始情境练习" onPress={() => setState(startScenario(state))} />
          <SecondaryButton label="先对着镜子说一遍" onPress={() => setMirrorVisible(true)} />
          <TextAction label="我想先看看可以怎么说" onPress={() => setState(startScenario(state))} />
        </Card>
      ) : null}

      {!mirrorVisible && state.stage === "behavior" ? (
        <Card>
          <Heading>这次想用哪一种靠近来练习？</Heading>
          {behaviorOptions.map((option) => (
            <ChoiceChip key={option.id} label={option.label} onPress={() => chooseBehavior(option.id)} selected={false} semantics="radio" />
          ))}
          <SecondaryButton label="不说具体行为" onPress={() => chooseBehavior(null)} />
        </Card>
      ) : null}

      {state.stage === "need" ? (
        <Card>
          <Heading>此刻，你更接近哪一种需要？</Heading>
          {NEEDS.map((need) => (
            <ChoiceChip key={need.intent} label={need.label} onPress={() => chooseNeed(need.intent)} selected={false} semantics="radio" />
          ))}
        </Card>
      ) : null}

      {state.stage === "editable-phrase" ? (
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
          <Heading>可选练习</Heading>
          <Body>接下来的情境可能让人不舒服。你可以跳过，不影响流程或积分。</Body>
          <Button label="跳过不太理想的回应" onPress={() => setState(chooseOptionalBranch(state, catalog, "skip"))} />
          <SecondaryButton label="也练习一次不太理想的回应" onPress={() => setState({ ...state, stage: "optional-response" })} />
        </Card>
      ) : null}

      {state.stage === "optional-response" && !state.optionalBranch ? (
        <Card>
          <Heading>选择一个预设分支</Heading>
          {catalog.safetyBranches.map((branch) => (
            <SecondaryButton key={branch.branch} label={branch.partnerText.replace(/[。.]+$/u, "")} onPress={() => setState(chooseOptionalBranch(state, catalog, branch.branch as "disappointed-but-stops" | "continues-pressure" | "ignores-or-blocks-exit"))} />
          ))}
        </Card>
      ) : null}

      {state.stage === "optional-response" && state.optionalBranch ? (
        <Card>
          <Heading>预设回应练习</Heading>
          {state.optionalPartnerText ? <Body>{state.optionalPartnerText}</Body> : null}
          {state.optionalUserTexts?.map((text) => <Body key={text}>{text}</Body>)}
          {state.optionalGuidance ? <Body>{state.optionalGuidance}</Body> : null}
          <Button label="完成这个分支" onPress={finish} />
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
          <Body>你练习了发现感受的变化、表达此刻的需要，以及辨认尊重边界的回应。</Body>
          <Button label="继续整理我的准备" onPress={finish} />
        </Card>
      ) : null}
    </View>
  );
}
