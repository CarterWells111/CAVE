import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View, type ViewStyle } from "react-native";

import { useReducedMotion } from "../../../core/design/motion-preferences";
import { useTheme } from "../../../core/design/theme-provider";
import { FIRST_OVERNIGHT, SAMPLE_JOURNEYS, type SampleJourney } from "../catalog";

type JourneyMapProps = {
  onOpenSample: (id: string) => void;
  onOpenScenario: () => void | Promise<void>;
  scenarioPending?: boolean;
  scenarioError?: boolean;
};

function SampleNode({ journey, onOpen }: { journey: SampleJourney; onOpen: (id: string) => void }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ alignItems: "center", gap: theme.space.sm, minWidth: 0, width: "100%" }}>
      <Pressable
        accessibilityHint="打开三页框架预览，不会保存答案"
        accessibilityLabel={`打开${journey.title}，样板`}
        accessibilityRole="button"
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onPress={() => onOpen(journey.id)}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surfaceAccent,
          borderColor: theme.color.primary,
          borderRadius: theme.radius.pill,
          borderWidth: theme.border.width,
          height: 80,
          justifyContent: "center",
          opacity: pressed && !reducedMotion ? 0.82 : 1,
          outlineColor: theme.color.focus,
          outlineOffset: theme.border.focusOffset,
          outlineWidth: focused ? theme.border.focusWidth : 0,
          width: 80,
        })}
      >
        <Ionicons accessible={false} color={theme.color.primary} name={journey.icon} size={32} />
      </Pressable>
      <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text, textAlign: "center" }}>
        {journey.title}
      </Text>
      <Text selectable style={{ ...theme.typography.label, color: theme.color.textSecondary, textAlign: "center" }}>
        样板
      </Text>
    </View>
  );
}

// Each connector owns its own flow space; only the non-interactive dots are positioned.
function Trail({ from = 50, to = 50 }: { from?: number; to?: number }) {
  const theme = useTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ height: 64, width: "100%" }}
      testID="journey-map-trail"
    >
      {Array.from({ length: 9 }, (_, index) => {
        const t = (index + 1) / 10;
        const eased = t * t * (3 - 2 * t);
        return (
          <View
            key={index}
            style={{
              backgroundColor: theme.color.border,
              borderRadius: theme.radius.pill,
              height: 4,
              left: `${from + (to - from) * eased}%`,
              position: "absolute",
              top: t * 60,
              transform: [{ translateX: -2 }],
              width: 4,
            }}
          />
        );
      })}
    </View>
  );
}

function ScenarioNode({
  onOpen,
  pending,
  error,
}: { onOpen: () => void | Promise<void>; pending: boolean; error: boolean }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ alignItems: "center", gap: theme.space.sm, minWidth: 0, width: "100%" }}>
      <Pressable
        accessibilityHint="可选情景演绎，独立于样板旅程"
        accessibilityLabel={`体验${FIRST_OVERNIGHT.title}`}
        accessibilityRole="button"
        accessibilityState={{ busy: pending, disabled: pending }}
        disabled={pending}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onPress={() => { if (!pending) void onOpen(); }}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: pressed ? theme.color.surfacePressed : theme.color.canvasRaised,
          borderColor: theme.color.lightWarm,
          borderCurve: "continuous",
          borderRadius: theme.radius.feature,
          borderWidth: theme.border.width,
          height: 72,
          justifyContent: "center",
          opacity: pending ? 0.6 : 1,
          outlineColor: theme.color.focus,
          outlineOffset: theme.border.focusOffset,
          outlineWidth: focused ? theme.border.focusWidth : 0,
          width: 72,
        })}
      >
        <Ionicons accessible={false} color={theme.color.lightWarm} name="moon-outline" size={30} />
      </Pressable>
      <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text, textAlign: "center" }}>
        {FIRST_OVERNIGHT.title}
      </Text>
      <Text selectable style={{ ...theme.typography.label, color: theme.color.textSecondary, textAlign: "center" }}>
        情景演绎 · 可选体验
      </Text>
      {pending ? (
        <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary, textAlign: "center" }}>
          正在打开…
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" selectable style={{ ...theme.typography.caption, color: theme.color.text, textAlign: "center" }}>
          暂时无法打开，请再试一次。
        </Text>
      ) : null}
    </View>
  );
}

export function JourneyMap({
  onOpenSample,
  onOpenScenario,
  scenarioPending = false,
  scenarioError = false,
}: JourneyMapProps) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState<number | undefined>();
  const flowLayout = width < 360 || fontScale > 1.25 || (contentWidth !== undefined && contentWidth < 320);
  const side = flowLayout ? 50 : 17;
  const node = (index: number, alignment: ViewStyle["alignSelf"] = "center") => (
    <View style={{ alignSelf: flowLayout ? "center" : alignment, width: flowLayout ? "100%" : "34%" }}>
      <SampleNode journey={SAMPLE_JOURNEYS[index]!} onOpen={onOpenSample} />
    </View>
  );

  return (
    <View
      onLayout={({ nativeEvent }) => setContentWidth(nativeEvent.layout.width)}
      style={{ minWidth: 0, paddingVertical: theme.space.sm, width: "100%" }}
      testID="journey-map"
    >
      {node(0)}
      <Trail from={50} to={side} />
      <View
        style={{ alignItems: "center", flexDirection: flowLayout ? "column" : "row", gap: theme.space.lg, width: "100%" }}
        testID="journey-map-scenario-branch"
      >
        <View style={{ width: flowLayout ? "100%" : "34%" }}>
          <SampleNode journey={SAMPLE_JOURNEYS[1]!} onOpen={onOpenSample} />
          <Trail />
          <SampleNode journey={SAMPLE_JOURNEYS[2]!} onOpen={onOpenSample} />
        </View>
        <View style={{ flex: flowLayout ? undefined : 1, minWidth: 0, width: flowLayout ? "100%" : undefined }}>
          <ScenarioNode error={scenarioError} onOpen={onOpenScenario} pending={scenarioPending} />
        </View>
      </View>
      <Trail from={side} to={100 - side} />
      {node(3, "flex-end")}
      <Trail from={100 - side} to={100 - side} />
      {node(4, "flex-end")}
      <Trail from={100 - side} to={50} />
      {node(5)}
    </View>
  );
}
