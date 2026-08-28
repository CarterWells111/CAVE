import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";

import { useTheme } from "../design/theme-provider";

export type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();
  const [actionFocused, setActionFocused] = useState(false);
  const hasAction = Boolean(actionLabel && onAction);

  useEffect(() => {
    if (process.env.EXPO_OS === "ios") {
      AccessibilityInfo.announceForAccessibility(`${title}。${message}`);
    }
  }, [message, title]);

  return (
    <View style={{ alignItems: "center", gap: theme.space.lg, paddingVertical: theme.space.xl }}>
      <View
        style={{ alignItems: "center", gap: theme.space.sm }}
      >
        <Text
          selectable
          accessibilityRole="header"
          style={{ color: theme.color.text, ...theme.typography.heading }}
        >
          {title}
        </Text>
        <Text
          selectable
          accessible
          accessibilityRole="summary"
          accessibilityLiveRegion="polite"
          style={{ color: theme.color.textMuted, ...theme.typography.body, textAlign: "center" }}
        >
          {message}
        </Text>
      </View>
      {hasAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onBlur={() => setActionFocused(false)}
          onFocus={() => setActionFocused(true)}
          onPress={onAction}
          style={{
            alignItems: "center",
            backgroundColor: theme.color.primary,
            borderColor: theme.color.primary,
            borderCurve: "continuous",
            borderRadius: theme.radius.md,
            borderWidth: theme.border.width,
            justifyContent: "center",
            minHeight: theme.size.minimumTouchTarget,
            minWidth: theme.size.minimumTouchTarget,
            outlineColor: actionFocused ? theme.color.focus : "transparent",
            outlineOffset: theme.border.focusWidth,
            outlineStyle: "solid",
            outlineWidth: actionFocused ? theme.border.focusWidth : 0,
            paddingHorizontal: theme.space.lg,
          }}
        >
          <Text style={{ color: theme.color.onPrimary, ...theme.typography.label }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
