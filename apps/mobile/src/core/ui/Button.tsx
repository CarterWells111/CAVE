import { useState } from "react";
import type { AccessibilityRole, AccessibilityState } from "react-native";
import { Pressable, Text } from "react-native";

import { useTheme } from "../design/theme-provider";
import { useReducedMotion } from "../design/motion-preferences";

type ButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  role?: AccessibilityRole | undefined;
  selected?: boolean | undefined;
  state?: AccessibilityState | undefined;
  testID?: string | undefined;
};

export function Button({
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
  loading = false,
  role = "button",
  selected,
  state,
  testID
}: ButtonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || loading;
  const accessibilityState: AccessibilityState = {
    ...state,
    busy: loading,
    disabled: unavailable
  };

  if (selected !== undefined) {
    accessibilityState.selected = selected;
    if (role === "checkbox" || role === "radio") {
      accessibilityState.checked = selected;
    }
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={role}
      accessibilityState={accessibilityState}
      disabled={unavailable}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => {
        if (!unavailable) {
          onPress();
        }
      }}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: disabled
          ? theme.color.disabledFill
          : loading
            ? theme.color.primary
          : pressed
            ? theme.color.primaryPressed
            : theme.color.primary,
        borderColor: theme.color.primary,
        borderCurve: "continuous",
        borderRadius: theme.radius.control,
        borderWidth: selected ? theme.border.selectedWidth : theme.border.width,
        flexDirection: "row",
        flexShrink: 1,
        flexWrap: "wrap",
        gap: theme.space.sm,
        justifyContent: "center",
        maxWidth: "100%",
        minHeight: theme.size.primaryActionHeight,
        minWidth: theme.size.minimumTouchTarget,
        opacity: disabled ? 0.55 : pressed && !reducedMotion ? 0.82 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.compact,
        width: "100%"
      })}
      testID={testID}
    >
      <Text
        style={{
          ...theme.typography.button,
          color: disabled ? theme.color.disabledText : theme.color.onPrimary,
          flexShrink: 1,
          flexWrap: "wrap",
          maxWidth: "100%",
          textAlign: "center"
        }}
      >
        {label}
      </Text>
      {loading ? (
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.color.onPrimary,
            flexShrink: 1,
            flexWrap: "wrap",
            textAlign: "center"
          }}
        >
          加载中
        </Text>
      ) : null}
      {disabled && !loading ? (
        <Text style={{ ...theme.typography.caption, color: theme.color.disabledText }}>
          不可用
        </Text>
      ) : null}
      {selected ? (
        <Text style={{ ...theme.typography.caption, color: disabled ? theme.color.disabledText : theme.color.onPrimary }}>
          ✓ 已选中
        </Text>
      ) : null}
    </Pressable>
  );
}
