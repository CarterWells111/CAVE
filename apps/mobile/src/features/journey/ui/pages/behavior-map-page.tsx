import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { Card } from "../../../../core/ui/Card";
import { InfoCard } from "../../../../core/ui/info-card";
import type { BehaviorAttitude } from "../../domain/types";
import { loadJourneyContentCatalog } from "../../infrastructure/journey-content-catalog";
import { JourneyAction } from "../components/JourneyAction";
import { JourneyChoice } from "../components/JourneyChoice";
import type { JourneyAction as JourneyActionCallback } from "../journey-ui-contracts";

type CustomBehavior = { id: string; label: string };

export type BehaviorMapPageProps = {
  initialAttitudes?: Record<string, BehaviorAttitude>;
  initialCustomBehaviors?: CustomBehavior[];
  initialPointId?: string;
  initialSensitiveContentConsent?: boolean | null;
  onSetAttitude(behaviorId: string, attitude: BehaviorAttitude): ReturnType<JourneyActionCallback>;
  onAddCustomBehavior?(behavior: CustomBehavior): ReturnType<JourneyActionCallback>;
  onSetSensitiveContentConsent?(consented: boolean): ReturnType<JourneyActionCallback>;
  onComplete(input: { participated: true }): ReturnType<JourneyActionCallback>;
  createCustomBehaviorId?: () => string;
};

const content = loadJourneyContentCatalog();
const mapPoints = [...content.uiCopy.behaviorMapPoints].sort((first, second) => first.order - second.order);
const catalogAttitudes = [...content.uiCopy.attitudes].sort((first, second) => first.order - second.order);
const behaviorOptions = new Map(
  content.options
    .filter(({ group }) => group === "behavior")
    .map((option) => [option.id, option] as const),
);
const requiredBaseBehaviorIds = mapPoints
  .slice(0, 7)
  .flatMap(({ behaviorIds }) => behaviorIds.slice(0, 1));
const sensitiveBehaviorIds = mapPoints.find(({ kind }) => kind === "more")?.behaviorIds ?? [];

function toDomainAttitude(value: (typeof catalogAttitudes)[number]["value"]): BehaviorAttitude {
  return value === "expecting" ? "looking-forward" : value;
}

function fromDomainAttitude(value: BehaviorAttitude | undefined) {
  return value === "looking-forward" ? "expecting" : value;
}

export function BehaviorMapPage({
  initialAttitudes = {},
  initialCustomBehaviors = [],
  initialPointId,
  initialSensitiveContentConsent = null,
  onSetAttitude,
  onAddCustomBehavior,
  onSetSensitiveContentConsent,
  onComplete,
  createCustomBehaviorId = () => `custom-${Date.now()}`,
}: BehaviorMapPageProps) {
  const theme = useTheme();
  const initialUnlockedIndex = (() => {
    const missingBaseIndex = requiredBaseBehaviorIds.findIndex((id) => initialAttitudes[id] === undefined);
    if (missingBaseIndex >= 0) return missingBaseIndex;
    if (initialSensitiveContentConsent === false) return 8;
    if (initialSensitiveContentConsent === true && sensitiveBehaviorIds.every((id) => initialAttitudes[id] !== undefined)) return 8;
    return 7;
  })();
  const requestedInitialIndex = mapPoints.findIndex(({ id }) => id === initialPointId);
  const initialPointIndex = requestedInitialIndex >= 0 && requestedInitialIndex <= initialUnlockedIndex
    ? requestedInitialIndex
    : Math.min(initialUnlockedIndex, mapPoints.length - 1);
  const [activePointId, setActivePointId] = useState(mapPoints[initialPointIndex]?.id);
  const [attitudes, setAttitudes] = useState<Record<string, BehaviorAttitude>>(() => ({ ...initialAttitudes }));
  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>(() => [...initialCustomBehaviors]);
  const [customLabel, setCustomLabel] = useState("");
  const [activeMoreBehaviorId, setActiveMoreBehaviorId] = useState<string | undefined>(() => {
    if (initialSensitiveContentConsent !== true) return undefined;
    return sensitiveBehaviorIds.find((id) => initialAttitudes[id] === undefined)
      ?? sensitiveBehaviorIds[sensitiveBehaviorIds.length - 1];
  });
  const [activeCustomBehaviorId, setActiveCustomBehaviorId] = useState(initialCustomBehaviors[0]?.id);
  const [sensitiveConsent, setSensitiveConsent] = useState<boolean | null>(initialSensitiveContentConsent);
  const [sensitiveGateStage, setSensitiveGateStage] = useState<"intro" | "learned" | "confirmed" | "declined">(
    initialSensitiveContentConsent === true
      ? "confirmed"
      : initialSensitiveContentConsent === false
        ? "declined"
        : "intro",
  );
  const [sensitiveConfirmationChecked, setSensitiveConfirmationChecked] = useState(false);

  const activePoint = mapPoints.find(({ id }) => id === activePointId) ?? mapPoints[0];
  const activeBehavior = useMemo(() => {
    if (!activePoint) return undefined;
    if (activePoint.kind === "custom") {
      return customBehaviors.find(({ id }) => id === activeCustomBehaviorId);
    }
    const behaviorId = activePoint.kind === "more" ? activeMoreBehaviorId : activePoint.behaviorIds[0];
    const option = behaviorId ? behaviorOptions.get(behaviorId) : undefined;
    return option ? { id: option.id, label: option.label } : undefined;
  }, [activeCustomBehaviorId, activeMoreBehaviorId, activePoint, customBehaviors]);

  const selectedCatalogAttitude = fromDomainAttitude(
    activeBehavior ? attitudes[activeBehavior.id] : undefined,
  );
  const activePointIndex = mapPoints.findIndex(({ id }) => id === activePoint?.id);
  const firstMissingBaseIndex = requiredBaseBehaviorIds.findIndex((id) => attitudes[id] === undefined);
  const baseComplete = firstMissingBaseIndex === -1;
  const sensitiveAnswersComplete = sensitiveBehaviorIds.every((id) => attitudes[id] !== undefined);
  const unlockedPointIndex = firstMissingBaseIndex >= 0
    ? firstMissingBaseIndex
    : sensitiveConsent === false || (sensitiveConsent === true && sensitiveAnswersComplete)
      ? 8
      : 7;

  const moveToPoint = (index: number) => {
    const point = mapPoints[Math.max(0, Math.min(index, mapPoints.length - 1))];
    if (point) setActivePointId(point.id);
  };

  const persistSensitiveConsent = (consented: boolean, onSuccess: () => void) => {
    const finish = () => {
      setSensitiveConsent(consented);
      setSensitiveGateStage(consented ? "confirmed" : "declined");
      setActiveMoreBehaviorId(consented
        ? sensitiveBehaviorIds.find((id) => attitudes[id] === undefined) ?? sensitiveBehaviorIds[0]
        : undefined);
      onSuccess();
    };
    const result = onSetSensitiveContentConsent?.(consented);
    if (result && typeof result.then === "function") return Promise.resolve(result).then(finish);
    finish();
  };

  const persistAttitude = (
    behaviorId: string,
    attitude: BehaviorAttitude,
    onSuccess?: () => void,
  ) => {
    const finish = () => {
      setAttitudes((current) => ({ ...current, [behaviorId]: attitude }));
      onSuccess?.();
    };
    const result = onSetAttitude(behaviorId, attitude);
    if (result && typeof result.then === "function") return Promise.resolve(result).then(finish);
    finish();
  };

  const addCustomBehavior = () => {
    const label = customLabel.trim();
    if (!label) return;
    const behavior = { id: createCustomBehaviorId(), label };
    const finish = () => {
      setCustomBehaviors((current) => [...current, behavior]);
      setActiveCustomBehaviorId(behavior.id);
      setCustomLabel("");
    };
    const result = onAddCustomBehavior?.(behavior);
    if (result && typeof result.then === "function") return Promise.resolve(result).then(finish);
    finish();
  };

  return (
    <View style={{ gap: theme.space.xl, maxWidth: "100%", width: "100%" }} testID="page-3-content">
      <Card accessible={false} variant="muted">
        <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
          每一种靠近，都可以有不同答案
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
          你可能愿意拥抱，却还不想接吻；这些答案不需要保持一致，也可以随时改变。
        </Text>
      </Card>

      <View style={{ gap: theme.space.compact }}>
        <ScrollView
          contentContainerStyle={{ alignItems: "center", gap: theme.space.lg, paddingHorizontal: theme.space.xs }}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          testID="behavior-map-scroll"
        >
          {mapPoints.map((point, index) => {
            const selected = point.id === activePoint?.id;
            const disabled = index > unlockedPointIndex;
            return (
              <Pressable
                accessibilityLabel={`行为地图，第 ${index + 1} 项，共 ${mapPoints.length} 项：${point.label}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled, selected }}
                disabled={disabled}
                key={point.id}
                onPress={() => { if (!disabled) setActivePointId(point.id); }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  borderColor: selected ? theme.color.brandSoft : theme.color.border,
                  borderCurve: "continuous",
                  borderRadius: theme.radius.pill,
                  borderWidth: selected ? theme.border.selectedWidth : theme.border.width,
                  justifyContent: "center",
                  minHeight: theme.size.minimumTouchTarget,
                  minWidth: theme.size.minimumTouchTarget,
                  opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
                })}
              >
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ ...theme.typography.label, color: theme.color.text }}
                >
                  {selected ? "●" : "○"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
          这些点没有先后高低，只是陪你一次看清一种感受。
        </Text>
      </View>

      {activePoint?.kind === "more" && sensitiveGateStage === "intro" ? (
        <Card accessible={false}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
            还有一些更具体的身体接触
          </Text>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
            这里包含使用直接健康教育用语描述的内容。是否查看、是否回答，都由你决定；跳过不会影响后续流程或积分。
          </Text>
          <JourneyAction
            label="了解内容后再决定"
            loadingLabel="正在打开说明…"
            onAction={() => setSensitiveGateStage("learned")}
          />
          <JourneyAction
            label="这次不查看"
            loadingLabel="正在记录…"
            onAction={() => persistSensitiveConsent(false, () => moveToPoint(8))}
          />
        </Card>
      ) : null}

      {activePoint?.kind === "more" && sensitiveGateStage === "learned" ? (
        <Card accessible={false}>
          <SectionTitleText>继续查看更具体的身体接触</SectionTitleText>
          <SupportingText>接下来的内容会使用直接、明确的健康教育用语，涉及口腔与私密部位的接触、插入式行为等。</SupportingText>
          <SupportingText>这里的内容以成年人的身体认识、同意与健康教育为目的，不提供色情材料，也不鼓励任何违法行为或要求你尝试任何行为。</SupportingText>
          <SupportingText>部分内容可能让人不舒服。你可以随时返回；不查看不会影响后续流程或积分。</SupportingText>
          <JourneyChoice
            label="我知道接下来会看到更具体的健康教育内容，并愿意继续"
            onSelect={() => setSensitiveConfirmationChecked((current) => !current)}
            selected={sensitiveConfirmationChecked}
          />
          <JourneyAction
            disabled={!sensitiveConfirmationChecked}
            label="我了解，继续查看"
            loadingLabel="正在记录选择…"
            onAction={() => persistSensitiveConsent(true, () => undefined)}
          />
          <JourneyAction
            label="返回更多具体行为"
            loadingLabel="正在返回…"
            onAction={() => {
              setSensitiveConfirmationChecked(false);
              setSensitiveGateStage("intro");
            }}
          />
          <JourneyAction
            label="这次不查看"
            loadingLabel="正在记录…"
            onAction={() => persistSensitiveConsent(false, () => moveToPoint(8))}
          />
        </Card>
      ) : null}

      {activePoint?.kind === "more" && sensitiveGateStage === "confirmed" ? (
        <Card accessible={false}>
          <SectionTitleText>{`具体行为 ${Math.max(1, sensitiveBehaviorIds.indexOf(activeMoreBehaviorId ?? "") + 1)} / ${sensitiveBehaviorIds.length}`}</SectionTitleText>
          {activeMoreBehaviorId === "draft-penetrative-sex" ? (
            <SupportingText>包括手指、玩具或身体部位进入阴道或肛门。</SupportingText>
          ) : null}
          <SupportingText>两项需要分别留下此刻的答案；“暂时不回答”也是明确答案。</SupportingText>
        </Card>
      ) : null}

      {activePoint?.kind === "more" && sensitiveGateStage === "declined" ? (
        <Card accessible={false}>
          <SectionTitleText>更多具体行为</SectionTitleText>
          <SupportingText>你选择了这次不查看具体行为。</SupportingText>
          <JourneyAction
            label="继续到自定义行为"
            loadingLabel="正在继续…"
            onAction={() => moveToPoint(8)}
          />
        </Card>
      ) : null}

      {activePoint?.kind === "custom" && !activeBehavior ? (
        <Card accessible={false}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
            还有没有一件你在意、但没有出现在前面的事？
          </Text>
          <TextInput
            accessibilityLabel="我在意的自定义行为"
            maxLength={120}
            onChangeText={setCustomLabel}
            placeholder="例如：只想拥抱、不想关灯、希望保留衣物……"
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
              minHeight: theme.size.primaryActionHeight,
              paddingHorizontal: theme.space.md,
              paddingVertical: theme.space.compact,
              width: "100%",
            }}
            value={customLabel}
          />
          <JourneyAction
            disabled={!customLabel.trim()}
            label="添加到我的地图"
            loadingLabel="正在添加…"
            onAction={addCustomBehavior}
          />
          <JourneyAction
            label="这次没有"
            loadingLabel="正在继续…"
            onAction={() => onComplete({ participated: true })}
          />
        </Card>
      ) : null}

      {activeBehavior ? (
        <Card accessible={false} testID={`behavior-card-${activeBehavior.id}`}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
            {`对于${activeBehavior.label}，此刻的你更接近哪种感觉？`}
          </Text>
          {activePoint?.kind === "more" ? (
            <SupportingText>对方也需要对每一种行为表达自己的意愿。你的选择不能代替对方的同意。</SupportingText>
          ) : null}
          {selectedCatalogAttitude ? (
            <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
              {`当前选择：${catalogAttitudes.find(({ value }) => value === selectedCatalogAttitude)?.label}`}
            </Text>
          ) : null}
          <View accessibilityRole="radiogroup" style={{ gap: theme.space.compact }}>
            {catalogAttitudes.map((attitude) => {
              const domainAttitude = toDomainAttitude(attitude.value);
              return (
                <JourneyChoice
                  accessibilityLabel={`${activeBehavior.label}：${attitude.label}`}
                  key={attitude.id}
                  label={attitude.label}
                  mode="single"
                  onSelect={() => {
                    const sensitiveIndex = sensitiveBehaviorIds.indexOf(activeBehavior.id);
                    return persistAttitude(activeBehavior.id, domainAttitude, sensitiveIndex >= 0 && sensitiveIndex < sensitiveBehaviorIds.length - 1
                      ? () => setActiveMoreBehaviorId(sensitiveBehaviorIds[sensitiveIndex + 1])
                      : undefined);
                  }}
                  selected={attitudes[activeBehavior.id] === domainAttitude}
                />
              );
            })}
          </View>
          {selectedCatalogAttitude ? (
            <InfoCard variant="education">
              <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
                {catalogAttitudes.find(({ value }) => value === selectedCatalogAttitude)?.feedback}
              </Text>
            </InfoCard>
          ) : null}
        </Card>
      ) : null}

      {activePointIndex > 0 ? (
        <JourneyAction
          label="返回上一项"
          loadingLabel="正在返回…"
          onAction={() => moveToPoint(activePointIndex - 1)}
        />
      ) : null}
      {activePointIndex >= 0 && activePointIndex < 7 && activeBehavior ? (
        <JourneyAction
          disabled={attitudes[activeBehavior.id] === undefined}
          label="记录这个感受，继续"
          loadingLabel="正在记录…"
          onAction={() => moveToPoint(activePointIndex + 1)}
        />
      ) : null}
      {activePointIndex === 7 && sensitiveGateStage === "confirmed" && sensitiveAnswersComplete ? (
        <JourneyAction
          label="继续到自定义行为"
          loadingLabel="正在继续…"
          onAction={() => moveToPoint(8)}
        />
      ) : null}
      {activePointIndex === 8 ? (
        <JourneyAction
          accessibilityLabel="带着这些感受继续"
          disabled={!baseComplete}
          label="带着这些感受继续"
          loadingLabel="正在继续…"
          onAction={() => onComplete({ participated: true })}
        />
      ) : null}
    </View>
  );
}

function SectionTitleText({ children }: { children: string }) {
  const theme = useTheme();
  return <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>{children}</Text>;
}

function SupportingText({ children }: { children: string }) {
  const theme = useTheme();
  return <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{children}</Text>;
}
