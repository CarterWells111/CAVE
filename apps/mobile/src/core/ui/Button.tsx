import { useState } from "react";
import { Pressable, Text } from "react-native";

import { theme } from "../design/theme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  testID
}: ButtonProps) {
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
        gap: theme.space.sm,
        justifyContent: "center",
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
          color: disabled ? theme.color.textMuted : theme.color.onPrimary
        }}
      >
        {label}
      </Text>
      {loading ? (
        <Text style={{ ...theme.typography.caption, color: theme.color.onPrimary }}>加载中</Text>
      ) : null}
    </Pressable>
  );
}
