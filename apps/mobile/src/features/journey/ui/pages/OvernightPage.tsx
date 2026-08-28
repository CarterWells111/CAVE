import type { JourneyOption, JourneySource } from "@cave/content";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, Text, TextInput, View } from "react-native";

import { theme } from "../../../../core/design/theme";
import { Card } from "../../../../core/ui/Card";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import { InfoCard } from "../../../../core/ui/info-card";
import { SourceDrawer } from "../../../../core/ui/source-drawer";
import { TextAction } from "../../../../core/ui/text-action";
import { JourneyAction } from "../components/JourneyAction";

type ActionResult = void | Promise<void>;
type Stage = "expectations" | "concerns";

export type OvernightPageProps = {
  options: JourneyOption[];
  onContinue: (input: { expectationIds: string[]; concernIds: string[]; customNote: string }) => ActionResult;
  initialExpectationIds?: string[];
  initialConcernIds?: string[];
  initialCustomNote?: string;
  initialStage?: Stage;
  onStageChange?: (stage: Stage) => ActionResult;
  consentSource?: JourneySource;
  onSourceAction?: (source: JourneySource) => ActionResult;
  reducedMotion?: boolean;
};

function updateSelection(current: string[], option: JourneyOption, group: JourneyOption[]): string[] {
  if (option.exclusive) return current.includes(option.id) ? [] : [option.id];
  const withoutExclusive = current.filter((id) => !group.find((item) => item.id === id)?.exclusive);
  return withoutExclusive.includes(option.id)
    ? withoutExclusive.filter((id) => id !== option.id)
    : [...withoutExclusive, option.id];
}

function Summary({ title, ids, options }: { title: string; ids: string[]; options: JourneyOption[] }) {
  return (
    <Card accessibilityLabel={`${title}摘要`} variant="muted">
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.body}>{ids.length === 0 ? "暂时留白" : ids.map((id) => options.find((item) => item.id === id)?.label).filter(Boolean).join("；")}</Text>
    </Card>
  );
}

export function OvernightPage({
  options,
  onContinue,
  initialExpectationIds = [],
  initialConcernIds = [],
  initialCustomNote = "",
  initialStage = "expectations",
  onStageChange,
  consentSource,
  onSourceAction,
  reducedMotion = false,
}: OvernightPageProps) {
  const expectations = options.filter((item) => item.group === "expectation").sort((a, b) => a.order - b.order);
  const concerns = options.filter((item) => item.group === "concern").sort((a, b) => a.order - b.order);
  const [stage, setStage] = useState<Stage>(initialStage);
  const [expectationIds, setExpectationIds] = useState([...initialExpectationIds]);
  const [concernIds, setConcernIds] = useState([...initialConcernIds]);
  const [customNote, setCustomNote] = useState(initialCustomNote);
  const [sourceOpen, setSourceOpen] = useState(false);
  const concernHeadingRef = useRef<ComponentRef<typeof Text>>(null);

  useEffect(() => {
    if (stage !== "concerns") return;
    const tag = findNodeHandle(concernHeadingRef.current);
    if (tag !== null) AccessibilityInfo.setAccessibilityFocus(tag);
  }, [stage]);

  const moveTo = (next: Stage): ActionResult => {
    const result = onStageChange?.(next);
    if (result && typeof result.then === "function") {
      return result.then(() => setStage(next));
    }
    setStage(next);
  };

  return (
    <View style={styles.page} testID="page-2-content">
      <Text accessibilityRole="header" style={styles.title}>这个夜晚，我们会一起待到明天</Text>
      <InfoCard title="一起过夜，不代表任何事情必须发生。" variant="education">
        <Text style={styles.body}>想象一个可能的晚上：你和正在靠近的人商量好，会在同一个空间待到明天。也许是聊天、看电影、拥抱，或者只是各自睡去。</Text>
        {consentSource ? <TextAction label="同意原则与来源" onPress={() => setSourceOpen(true)} underlined /> : null}
      </InfoCard>

      {stage === "expectations" ? (
        <Card accessible={false}>
          <Text accessibilityRole="header" style={styles.heading}>想到这次过夜，你有一点期待的是……</Text>
          <View style={styles.choices}>
            {expectations.map((option) => (
              <ChoiceChip
                key={option.id}
                label={option.label}
                onPress={() => setExpectationIds((current) => updateSelection(current, option, expectations))}
                selected={expectationIds.includes(option.id)}
                semantics="checkbox"
              />
            ))}
          </View>
          <Text style={styles.secondary}>暂时不选也可以</Text>
          <JourneyAction
            errorMessage="阶段暂时无法保存，请重试。"
            label="继续看看我的在意"
            loadingLabel="正在保存期待…"
            onAction={() => moveTo("concerns")}
          />
        </Card>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <Summary ids={expectationIds} options={expectations} title="我的期待" />
            <Summary ids={concernIds} options={concerns} title="我的在意" />
          </View>
          <JourneyAction
            errorMessage="阶段暂时无法保存，请重试。"
            label="修改期待"
            loadingLabel="正在返回…"
            onAction={() => moveTo("expectations")}
          />
          <Card accessible={false}>
            <Text accessibilityRole="header" ref={concernHeadingRef} style={styles.heading}>同时，你也有一些在意的是……</Text>
            <View style={styles.choices}>
              {concerns.map((option) => (
                <ChoiceChip
                  key={option.id}
                  label={option.label}
                  onPress={() => setConcernIds((current) => updateSelection(current, option, concerns))}
                  selected={concernIds.includes(option.id)}
                  semantics="checkbox"
                />
              ))}
            </View>
          </Card>
          <Card accessible={false} variant="muted">
            <Text style={styles.cardTitle}>可选补充</Text>
            <TextInput
              accessibilityLabel="这个夜晚的可选补充"
              maxLength={240}
              multiline
              onChangeText={setCustomNote}
              placeholder="想补充的话，可以写在这里"
              placeholderTextColor={theme.color.textTertiary}
              selectionColor={theme.color.primary}
              style={styles.input}
              value={customNote}
            />
          </Card>
          <InfoCard title="这些感受可以同时被留下，不需要现在整理成一个确定答案。" />
          <JourneyAction
            errorMessage="保存失败，请重试。"
            label="带着这些感受继续"
            loadingLabel="正在继续…"
            onAction={() => onContinue({ expectationIds, concernIds, customNote })}
          />
        </>
      )}

      {consentSource ? (
        <SourceDrawer
          institution={consentSource.organization}
          onAction={() => { void onSourceAction?.(consentSource); }}
          onClose={() => setSourceOpen(false)}
          reducedMotion={reducedMotion}
          title={consentSource.title}
          updatedAt={`${consentSource.publicationOrReviewDate} · 访问于 ${consentSource.accessedAt}`}
          visible={sourceOpen}
        />
      ) : null}
    </View>
  );
}

const styles = {
  page: { flexGrow: 1, gap: theme.space.xl, minWidth: 0 },
  title: { ...theme.typography.title, color: theme.color.text, flexShrink: 1 },
  heading: { ...theme.typography.heading, color: theme.color.text, flexShrink: 1 },
  cardTitle: { ...theme.typography.cardTitle, color: theme.color.text, flexShrink: 1 },
  body: { ...theme.typography.body, color: theme.color.text, flexShrink: 1 },
  secondary: { ...theme.typography.caption, color: theme.color.textSecondary, flexShrink: 1 },
  choices: { gap: theme.space.compact },
  summaryRow: { gap: theme.space.compact, width: "100%" as const },
  input: {
    ...theme.typography.body,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.interactiveBorder,
    borderRadius: theme.radius.control,
    borderWidth: theme.border.width,
    color: theme.color.text,
    minHeight: 120,
    padding: theme.space.md,
    textAlignVertical: "top" as const,
  },
};
