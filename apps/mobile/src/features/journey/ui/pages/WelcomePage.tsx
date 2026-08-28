import { useState } from "react";
import { Text, View } from "react-native";

import { theme } from "../../../../core/design/theme";
import { BottomSheet } from "../../../../core/ui/bottom-sheet";
import { Button } from "../../../../core/ui/Button";
import { Card } from "../../../../core/ui/Card";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import { EchoBackground } from "../../../../core/ui/echo-background";
import { SecondaryButton } from "../../../../core/ui/secondary-button";
import { TextAction } from "../../../../core/ui/text-action";
import { JourneyAction } from "../components/JourneyAction";

type ActionResult = void | Promise<void>;
type AddressPreference = "你" | "妳";

export type WelcomePageProps = {
  onAdult: () => ActionResult;
  onUnderage: () => ActionResult;
  resumeAvailable: boolean;
  onResume?: () => ActionResult;
  onRestart?: () => ActionResult;
  onAddressPreferenceChange?: (preference: AddressPreference) => ActionResult;
  reducedMotion?: boolean;
};

export function WelcomePage({
  onAdult,
  onUnderage,
  resumeAvailable,
  onResume,
  onRestart,
  onAddressPreferenceChange,
  reducedMotion = false,
}: WelcomePageProps) {
  const [addressOpen, setAddressOpen] = useState(false);
  const [prefaceOpen, setPrefaceOpen] = useState(false);
  const [underage, setUnderage] = useState(false);
  const [preference, setPreference] = useState<AddressPreference | null>(null);

  const finish = async () => {
    await onAdult();
    setPrefaceOpen(false);
  };

  if (underage) {
    return (
      <View style={styles.page} testID="page-1-underage-terminal">
        <EchoBackground reducedMotion={reducedMotion} />
        <Card variant="accent">
          <Text accessibilityRole="header" style={styles.heading}>先在这里停下</Text>
          <Text selectable style={styles.body}>这个版本暂时只为成年人设计。你可以先离开，照顾好自己的节奏。</Text>
          <Button label="退出体验" onPress={() => { void onUnderage(); }} />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.page} testID="page-1-content">
      <EchoBackground reducedMotion={reducedMotion} />
      <View style={styles.brand}>
        <Text style={styles.eyebrow}>Consent · Awareness · Voice · Exploration</Text>
        <Text accessibilityRole="header" style={styles.cave}>CAVE</Text>
        <Text style={styles.chineseBrand}>内界</Text>
      </View>
      <Card variant="accent">
        <Text selectable style={styles.heading}>探索那些隐于沉默、未被好好说清的事。</Text>
        <Text selectable style={styles.body}>循着内心的回响，找到属于自己的靠近方式。</Text>
        <Text selectable style={styles.reassurance}>期待、紧张和犹豫，可以同时存在。</Text>
      </Card>
      <Text selectable style={styles.secondary}>此体验面向 18 岁及以上成年人。</Text>
      <View style={styles.actions}>
        {resumeAvailable && onResume ? <SecondaryButton label="继续本机旅程" onPress={() => { void onResume(); }} /> : null}
        <Button label="我已满 18 岁，开始探索" onPress={() => setAddressOpen(true)} />
        <TextAction label="我未满 18 岁" onPress={() => setUnderage(true)} />
        {resumeAvailable && onRestart ? <TextAction label="重新开始（需要确认）" onPress={() => { void onRestart(); }} /> : null}
      </View>

      <BottomSheet
        onClose={() => setAddressOpen(false)}
        reducedMotion={reducedMotion}
        title="接下来，想怎样被称呼？"
        visible={addressOpen}
      >
        <View accessibilityViewIsModal testID="welcome-address-sheet">
          <Text style={styles.body}>「你」是不限定性别的通用写法；「妳」在二十世纪逐渐被用来明确称呼女性，更有书信感。它们读音相同，没有哪一个更正确。</Text>
          <View style={styles.choices}>
            <ChoiceChip label="你｜日常、自然，不限定性别。" onPress={() => setPreference("你")} selected={preference === "你"} semantics="radio" />
            <ChoiceChip label="妳｜明确称呼女性，更有书信感。" onPress={() => setPreference("妳")} selected={preference === "妳"} semantics="radio" />
          </View>
          <Text style={styles.secondary}>只会改变界面中的称呼，不影响内容。之后也可以更改。</Text>
          <JourneyAction
            disabled={preference === null}
            errorMessage="称呼暂时无法保存，请重试。"
            label="这样称呼我"
            loadingLabel="正在保存称呼…"
            onAction={async () => {
              if (!preference) return;
              await onAddressPreferenceChange?.(preference);
              setAddressOpen(false);
              setPrefaceOpen(true);
            }}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        onClose={() => setPrefaceOpen(false)}
        reducedMotion={reducedMotion}
        title={`开始前，想告诉${preference ?? "你"}`}
        visible={prefaceOpen}
      >
        <Text selectable style={styles.body}>遇见喜欢的人，听到某句情话，或面对某种爱抚与刺激时，身体可能会自然作出反应。这些反应可能让{preference ?? "你"}好奇，也可能让{preference ?? "你"}不适，甚至觉得不可接受。</Text>
        <Text selectable style={styles.body}>无论是哪一种，{preference ?? "你"}都可以从认识身体与同意开始，慢慢形成自己对性与亲密的理解。</Text>
        <Text selectable style={styles.body}>我们知道，界面里的文字不一定能完整托住{preference ?? "你"}的经历，也不会替{preference ?? "你"}下结论。希望它们可以成为一个起点：{preference ?? "你"}可以记下此刻的感受，在情境练习里试着说出一句话，也可以在安全、独处时对着镜子练习。</Text>
        <Text selectable style={styles.body}>这不是为了让{preference ?? "你"}表现得更大胆，而是让那些过去没有被看见的需要与声音，更容易先被{preference ?? "你"}自己听见，再由{preference ?? "你"}决定是否告诉别人。</Text>
        <JourneyAction
          errorMessage="暂时无法开始，请重试。"
          label="我知道了，开始探索"
          loadingLabel="正在开始…"
          onAction={finish}
        />
        <TextAction label="先跳过" onPress={() => { void finish(); }} />
      </BottomSheet>
    </View>
  );
}

const styles = {
  page: { flexGrow: 1, gap: theme.space.lg, minWidth: 0, position: "relative" as const },
  brand: { alignItems: "center" as const, gap: theme.space.xs, paddingTop: theme.space.card },
  eyebrow: { ...theme.typography.numericLabel, color: theme.color.textSecondary, flexShrink: 1, textAlign: "center" as const },
  cave: { ...theme.typography.brandEnglish, color: theme.color.text, letterSpacing: 5.28 },
  chineseBrand: { ...theme.typography.brandChinese, color: theme.color.text },
  heading: { ...theme.typography.heading, color: theme.color.text, flexShrink: 1 },
  body: { ...theme.typography.body, color: theme.color.text, flexShrink: 1 },
  secondary: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
  reassurance: { ...theme.typography.cardTitle, color: theme.color.lightWarm, flexShrink: 1 },
  actions: { gap: theme.space.compact, marginTop: "auto" as const },
  choices: { gap: theme.space.compact, marginVertical: theme.space.md },
};
