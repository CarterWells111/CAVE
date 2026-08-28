import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { useReducedMotion } from "../../../../core/design/motion-preferences";
import { ChoiceChip } from "../../../../core/ui/ChoiceChip";
import type { JourneyAction as JourneyActionCallback } from "../journey-ui-contracts";
import { JourneyStatusBanner } from "./JourneyStatusBanner";

export type JourneyChoiceProps = {
  label: string;
  selected: boolean;
  onSelect?: JourneyActionCallback | undefined;
  mode?: "single" | "multiple" | undefined;
  disabled?: boolean | undefined;
  accessibilityLabel?: string | undefined;
  testID?: string | undefined;
};

const GENERIC_ACTION_ERROR = "操作失败，请重试。";

export function JourneyChoice({
  label,
  selected,
  onSelect,
  mode = "multiple",
  disabled = false,
  accessibilityLabel,
  testID
}: JourneyChoiceProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [focused, setFocused] = useState(false);
  const loading = status === "loading";
  const unavailable = disabled || !onSelect || loading;
  const semantics = mode === "single" ? "radio" : "checkbox";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      inFlightRef.current = false;
    };
  }, []);

  const settleStatus = (nextStatus: "idle" | "error") => {
    if (mountedRef.current) setStatus(nextStatus);
  };

  const handlePress = () => {
    if (inFlightRef.current || unavailable || !onSelect) return;

    inFlightRef.current = true;
    setStatus("loading");
    try {
      const result = onSelect();
      if (result && typeof result.then === "function") {
        void Promise.resolve(result)
          .then(() => settleStatus("idle"))
          .catch(() => settleStatus("error"))
          .finally(() => {
            inFlightRef.current = false;
          });
        return;
      }
      settleStatus("idle");
    } catch {
      settleStatus("error");
    }
    inFlightRef.current = false;
  };

  const needsAccessibilityAdapter =
    (accessibilityLabel !== undefined && accessibilityLabel !== label) || loading;
  const chip = (
    <ChoiceChip
      disabled={unavailable}
      label={loading ? "正在更新" : label}
      onPress={handlePress}
      selected={selected}
      semantics={semantics}
      {...(!needsAccessibilityAdapter && testID !== undefined ? { testID } : {})}
    />
  );

  return (
    <View style={{ gap: theme.space.sm }}>
      {needsAccessibilityAdapter ? (
        <Pressable
          accessible
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityRole={semantics}
          accessibilityState={{
            busy: loading,
            checked: selected,
            disabled: unavailable,
            ...(semantics === "radio" ? { selected } : {})
          }}
          disabled={unavailable}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          onPress={handlePress}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            minHeight: theme.size.minimumTouchTarget,
            minWidth: theme.size.minimumTouchTarget,
            opacity: pressed ? 0.82 : 1,
            outlineColor: theme.color.focus,
            outlineOffset: theme.space.xs,
            outlineWidth: focused ? theme.border.focusWidth : 0,
            ...(reducedMotion ? {} : { transform: [{ scale: pressed ? 0.98 : 1 }] })
          })}
          testID={testID}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
          >
            {chip}
          </View>
        </Pressable>
      ) : chip}
      {loading ? (
        <Text style={{ ...theme.typography.caption, color: theme.color.textMuted }}>
          正在更新
        </Text>
      ) : null}
      {status === "error" ? (
        <JourneyStatusBanner message={GENERIC_ACTION_ERROR} tone="error" />
      ) : null}
    </View>
  );
}
