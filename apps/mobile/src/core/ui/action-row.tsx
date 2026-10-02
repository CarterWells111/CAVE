import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../design/theme-provider";

export type ActionRowProps = {
  title: string;
  subtitle?: string;
  accessibilityLabel?: string;
  children?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

// Navigation content only: do not put inputs or nested buttons inside this row.
export function ActionRow({ title, subtitle, accessibilityLabel, children, onPress, disabled = false, testID }: ActionRowProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join("，")}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} testID={testID}
    style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
      borderRadius: theme.radius.md, flexDirection: "row", gap: theme.space.md, minHeight: theme.size.minimumTouchTarget,
      minWidth: 0, padding: theme.space.md, opacity: disabled ? 0.65 : 1,
      outlineColor: theme.color.focus, outlineOffset: theme.border.focusOffset, outlineWidth: focused ? theme.border.focusWidth : 0 })}>
    <View style={{ flex: 1, gap: theme.space.xs, minWidth: 0 }}>
      <Text style={{ ...theme.typography.cardTitle, color: theme.color.text }}>{title}</Text>
      {subtitle ? <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{subtitle}</Text> : null}
      {children}
    </View>
    <Ionicons accessible={false} name="chevron-forward" color={theme.color.textSecondary} size={theme.size.icon} />
  </Pressable>;
}
