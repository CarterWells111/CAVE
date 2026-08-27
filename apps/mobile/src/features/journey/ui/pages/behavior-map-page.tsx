import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { theme } from "../../../../core/design/theme";
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
  const initialUnlockedIndex = (() => {
    const missingBaseIndex = requiredBaseBehaviorIds.findIndex((id) => initialAttitudes[id] === undefined);
    if (missingBaseIndex >= 0) return missingBaseIndex;
    return initialSensitiveContentConsent === null ? 7 : 8;
  })();
  const requestedInitialIndex = mapPoints.findIndex(({ id }) => id === initialPointId);
  const initialPointIndex = requestedInitialIndex >= 0 && requestedInitialIndex <= initialUnlockedIndex
    ? requestedInitialIndex
    : Math.min(initialUnlockedIndex, mapPoints.length - 1);
  const [activePointId, setActivePointId] = useState(mapPoints[initialPointIndex]?.id);
  const [attitudes, setAttitudes] = useState<Record<string, BehaviorAttitude>>(() => ({ ...initialAttitudes }));
  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>(() => [...initialCustomBehaviors]);
  const [customLabel, setCustomLabel] = useState("");
  const [activeMoreBehaviorId, setActiveMoreBehaviorId] = useState<string>();
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
  const unlockedPointIndex = firstMissingBaseIndex >= 0
    ? firstMissingBaseIndex
    : sensitiveConsent === null
      ? 7
      : 8;

  const moveToPoint = (index: number) => {
    const point = mapPoints[Math.max(0, Math.min(index, mapPoints.length - 1))];
    if (point) setActivePointId(point.id);
  };

  const persistSensitiveConsent = (consented: boolean, onSuccess: () => void) => {
    const finish = () => {
      setSensitiveConsent(consented);
      setSensitiveGateStage(consented ? "confirmed" : "declined");
      onSuccess();
    };
    const result = onSetSensitiveContentConsent?.(consented);
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
    <View style={{ gap: theme.space.xl, maxWidth: "100%", width: "100%" }} testID="page-4-content">
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
            这里使用直接健康教育用语。是否查看，由你决定。
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
          <SectionTitleText>查看前确认</SectionTitleText>
          <SupportingText>具体行为会使用直接健康教育用语描述。你可以确认查看，也可以返回并选择这次不查看。</SupportingText>
          <JourneyChoice
            label="我选择查看这些具体行为"
            onSelect={() => setSensitiveConfirmationChecked((current) => !current)}
            selected={sensitiveConfirmationChecked}
          />
          <JourneyAction
            disabled={!sensitiveConfirmationChecked}
            label="确认并查看"
            loadingLabel="正在记录选择…"
            onAction={() => persistSensitiveConsent(true, () => undefined)}
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
          <SectionTitleText>选择想继续了解的具体行为</SectionTitleText>
          <View style={{ gap: theme.space.compact }}>
            {activePoint.behaviorIds.map((behaviorId) => {
              const option = behaviorOptions.get(behaviorId);
              return option ? (
                <JourneyChoice
                  key={behaviorId}
                  label={option.label}
                  mode="single"
                  onSelect={() => setActiveMoreBehaviorId(behaviorId)}
                  selected={activeMoreBehaviorId === behaviorId}
                />
              ) : null;
            })}
          </View>
          <JourneyAction
            label="继续到自定义行为"
            loadingLabel="正在继续…"
            onAction={() => moveToPoint(8)}
          />
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
            添加一个我在意的行为
          </Text>
          <TextInput
            accessibilityLabel="我在意的自定义行为"
            maxLength={120}
            onChangeText={setCustomLabel}
            placeholder="用自己的话写下来"
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
            label="添加这个行为"
            loadingLabel="正在添加…"
            onAction={addCustomBehavior}
          />
        </Card>
      ) : null}

      {activeBehavior ? (
        <Card accessible={false} testID={`behavior-card-${activeBehavior.id}`}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
            {`对于${activeBehavior.label}，此刻的你更接近哪种感觉？`}
          </Text>
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
                    setAttitudes((current) => ({ ...current, [activeBehavior.id]: domainAttitude }));
                    return onSetAttitude(activeBehavior.id, domainAttitude);
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
  return <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>{children}</Text>;
}

function SupportingText({ children }: { children: string }) {
  return <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{children}</Text>;
}
