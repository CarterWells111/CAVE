import { useState } from "react";
import { Pressable, Text } from "react-native";

import { useTheme } from "../design/theme-provider";
import { useReducedMotion } from "../design/motion-preferences";

export type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export function SecondaryButton({ label, onPress, disabled = false, loading = false, testID }: SecondaryButtonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || loading;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => { if (!unavailable) onPress(); }}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? theme.color.surfacePressed : "transparent",
        borderColor: disabled ? theme.color.disabledText : theme.color.interactiveBorder,
        borderCurve: "continuous",
        borderRadius: theme.radius.control,
        borderWidth: theme.border.width,
        flexDirection: "row",
        flexShrink: 1,
        flexWrap: "wrap",
        gap: theme.space.sm,
        justifyContent: "center",
        maxWidth: "100%",
        minHeight: theme.size.secondaryActionHeight,
        minWidth: theme.size.minimumTouchTarget,
        opacity: disabled ? 0.65 : pressed && !reducedMotion ? 0.82 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.compact,
        width: "100%",
      })}
      testID={testID}
    >
      <Text style={{ ...theme.typography.button, color: disabled ? theme.color.disabledText : theme.color.text, flexShrink: 1, flexWrap: "wrap", textAlign: "center" }}>
        {label}
      </Text>
      {loading ? <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>加载中</Text> : null}
      {disabled && !loading ? <Text style={{ ...theme.typography.caption, color: theme.color.disabledText }}>不可用</Text> : null}
    </Pressable>
  );
}
