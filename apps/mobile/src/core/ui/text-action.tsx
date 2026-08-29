import { forwardRef, useState } from "react";
import { Pressable, Text, type View } from "react-native";

import { useTheme } from "../design/theme-provider";
import { useReducedMotion } from "../design/motion-preferences";

export type TextActionProps = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  underlined?: boolean;
  testID?: string;
};

export const TextAction = forwardRef<View, TextActionProps>(function TextAction(
  { label, accessibilityLabel, onPress, disabled = false, loading = false, underlined = false, testID },
  ref,
) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || loading;
  return (
    <Pressable
      ref={ref}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => { if (!unavailable) onPress(); }}
      style={({ pressed }) => ({
        alignItems: "center",
        alignSelf: "flex-start",
        borderCurve: "continuous",
        borderRadius: theme.radius.label,
        justifyContent: "center",
        minHeight: theme.size.minimumTouchTarget,
        minWidth: theme.size.minimumTouchTarget,
        opacity: disabled ? 0.65 : pressed && !reducedMotion ? 0.72 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space.sm,
      })}
      testID={testID}
    >
      <Text style={{ ...theme.typography.button, color: disabled ? theme.color.disabledText : theme.color.textSecondary, flexShrink: 1, flexWrap: "wrap", textDecorationLine: underlined ? "underline" : "none" }}>
        {label}
      </Text>
      {loading ? <Text style={{ ...theme.typography.numericLabel, color: theme.color.textSecondary }}>加载中</Text> : null}
      {disabled && !loading ? <Text style={{ ...theme.typography.numericLabel, color: theme.color.disabledText }}>不可用</Text> : null}
    </Pressable>
  );
});
