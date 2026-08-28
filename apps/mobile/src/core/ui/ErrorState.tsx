import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";

import { useTheme } from "../design/theme-provider";

export type ErrorStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ErrorState({ title, message, actionLabel, onAction }: ErrorStateProps) {
  const theme = useTheme();
  const [actionFocused, setActionFocused] = useState(false);
  const hasAction = Boolean(actionLabel && onAction);

  useEffect(() => {
    if (process.env.EXPO_OS === "ios") {
      AccessibilityInfo.announceForAccessibility(`${title}。${message}`);
    }
  }, [message, title]);

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.color.dangerSurface,
        borderColor: theme.color.danger,
        borderCurve: "continuous",
        borderRadius: theme.radius.lg,
        borderWidth: theme.border.width,
        gap: theme.space.lg,
        padding: theme.space.lg,
      }}
    >
      <View
        style={{ alignItems: "center", gap: theme.space.sm }}
      >
        <Text
          selectable
          accessibilityRole="header"
          style={{ color: theme.color.danger, ...theme.typography.heading }}
        >
          {title}
        </Text>
        <Text
          selectable
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={{ color: theme.color.text, ...theme.typography.body, textAlign: "center" }}
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
            backgroundColor: theme.color.surface,
            borderColor: theme.color.danger,
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
          <Text style={{ color: theme.color.text, ...theme.typography.label }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
