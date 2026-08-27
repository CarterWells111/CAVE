import { useState } from "react";
import { Pressable, Text } from "react-native";

import { theme } from "../design/theme";

type ChoiceChipProps = {
  label: string;
  onPress: () => void;
  selected: boolean;
  semantics: "checkbox" | "radio";
  disabled?: boolean;
  testID?: string;
};

export function ChoiceChip({
  label,
  onPress,
  selected,
  semantics,
  disabled = false,
  testID
}: ChoiceChipProps) {
  const [focused, setFocused] = useState(false);
  const marker = semantics === "checkbox" ? (selected ? "✓" : "□") : selected ? "●" : "○";
  const state =
    semantics === "checkbox"
      ? { checked: selected, disabled }
      : { checked: selected, disabled, selected };

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={semantics}
      accessibilityState={state}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: disabled
          ? theme.color.surfaceMuted
          : pressed
            ? theme.color.surfacePressed
            : selected
              ? theme.color.surfaceAccent
              : theme.color.surface,
        borderColor: selected ? theme.color.primary : theme.color.border,
        borderRadius: theme.radius.pill,
        borderWidth: theme.border.width,
        flexDirection: "row",
        gap: theme.space.sm,
        maxWidth: "100%",
        minHeight: theme.size.minimumTouchTarget,
        minWidth: theme.size.minimumTouchTarget,
        opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.space.xs,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.xs
      })}
      testID={testID}
    >
      <Text
        style={{ ...theme.typography.label, color: theme.color.text, flexShrink: 0 }}
      >
        {marker}
      </Text>
      <Text
        style={{
          ...theme.typography.label,
          color: disabled ? theme.color.textMuted : theme.color.text,
          flexShrink: 1,
          flexWrap: "wrap",
          maxWidth: "100%"
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
