import { useState } from "react";
import { Pressable, Text } from "react-native";

import { useTheme } from "../design/theme-provider";
import { useReducedMotion } from "../design/motion-preferences";

type ChoiceChipProps = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  selected: boolean;
  semantics: "checkbox" | "radio";
  disabled?: boolean;
  testID?: string;
};

export function ChoiceChip({
  label,
  accessibilityLabel,
  onPress,
  selected,
  semantics,
  disabled = false,
  testID
}: ChoiceChipProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const marker = semantics === "checkbox" ? (selected ? "✓" : "□") : selected ? "●" : "○";
  const state =
    semantics === "checkbox"
      ? { checked: selected, disabled }
      : { checked: selected, disabled, selected };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={semantics}
      accessibilityState={state}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        alignSelf: "stretch",
        backgroundColor: disabled
          ? theme.color.surfaceMuted
          : pressed
            ? theme.color.surfacePressed
            : selected
              ? theme.color.surfaceAccent
              : theme.color.surface,
        borderColor: selected ? theme.color.brandSoft : theme.color.border,
        borderCurve: "continuous",
        borderRadius: theme.radius.control,
        borderWidth: selected ? theme.border.selectedWidth : theme.border.width,
        flexDirection: "row",
        gap: theme.space.sm,
        maxWidth: "100%",
        minHeight: 56,
        minWidth: theme.size.minimumTouchTarget,
        opacity: disabled ? 0.55 : pressed && !reducedMotion ? 0.82 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.compact,
        width: "100%"
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
      {disabled ? (
        <Text style={{ ...theme.typography.caption, color: theme.color.disabledText }}>
          不可用
        </Text>
      ) : null}
    </Pressable>
  );
}
