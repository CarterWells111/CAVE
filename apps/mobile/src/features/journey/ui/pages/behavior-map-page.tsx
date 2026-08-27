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
  onSetAttitude(behaviorId: string, attitude: BehaviorAttitude): ReturnType<JourneyActionCallback>;
  onAddCustomBehavior?(behavior: CustomBehavior): ReturnType<JourneyActionCallback>;
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

function toDomainAttitude(value: (typeof catalogAttitudes)[number]["value"]): BehaviorAttitude {
  return value === "expecting" ? "looking-forward" : value;
}

function fromDomainAttitude(value: BehaviorAttitude | undefined) {
  return value === "looking-forward" ? "expecting" : value;
}

export function BehaviorMapPage({
  initialAttitudes = {},
  initialCustomBehaviors = [],
  onSetAttitude,
  onAddCustomBehavior,
  onComplete,
  createCustomBehaviorId = () => `custom-${Date.now()}`,
}: BehaviorMapPageProps) {
  const [activePointId, setActivePointId] = useState(mapPoints[0]?.id);
  const [attitudes, setAttitudes] = useState<Record<string, BehaviorAttitude>>(() => ({ ...initialAttitudes }));
  const [customBehaviors, setCustomBehaviors] = useState<CustomBehavior[]>(() => [...initialCustomBehaviors]);
  const [customLabel, setCustomLabel] = useState("");
  const [activeMoreBehaviorId, setActiveMoreBehaviorId] = useState<string>();
  const [activeCustomBehaviorId, setActiveCustomBehaviorId] = useState(initialCustomBehaviors[0]?.id);

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
            return (
              <Pressable
                accessibilityLabel={`行为地图，第 ${index + 1} 项，共 ${mapPoints.length} 项：${point.label}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected }}
                key={point.id}
                onPress={() => setActivePointId(point.id)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  borderColor: selected ? theme.color.brandSoft : theme.color.border,
                  borderCurve: "continuous",
                  borderRadius: theme.radius.pill,
                  borderWidth: selected ? theme.border.selectedWidth : theme.border.width,
                  justifyContent: "center",
                  minHeight: theme.size.minimumTouchTarget,
                  minWidth: theme.size.minimumTouchTarget,
                  opacity: pressed ? 0.72 : 1,
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

      {activePoint?.kind === "more" && !activeBehavior ? (
        <Card accessible={false}>
          <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>
            还有一些更具体的身体接触
          </Text>
          <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
            这里使用直接健康教育用语。是否查看，由你决定。
          </Text>
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

      <JourneyAction
        accessibilityLabel="带着这些感受继续"
        disabled={Object.keys(attitudes).length === 0}
        label="带着这些感受继续"
        loadingLabel="正在继续…"
        onAction={() => onComplete({ participated: true })}
      />
    </View>
  );
}
