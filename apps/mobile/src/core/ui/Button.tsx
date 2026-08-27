import { useState } from "react";
import type { AccessibilityRole, AccessibilityState } from "react-native";
import { Pressable, Text } from "react-native";

import { theme } from "../design/theme";

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
          ? theme.color.disabled
          : loading
            ? theme.color.primary
          : pressed
            ? theme.color.primaryPressed
            : theme.color.primary,
        borderColor: theme.color.primary,
        borderRadius: theme.radius.md,
        borderWidth: theme.border.width,
        flexDirection: "row",
        flexShrink: 1,
        flexWrap: "wrap",
        gap: theme.space.sm,
        justifyContent: "center",
        maxWidth: "100%",
        minHeight: theme.size.minimumTouchTarget,
        minWidth: theme.size.minimumTouchTarget,
        opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.space.xs,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.sm
      })}
      testID={testID}
    >
      <Text
        style={{
          ...theme.typography.button,
          color: disabled ? theme.color.textMuted : theme.color.onPrimary,
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
    </Pressable>
  );
}
