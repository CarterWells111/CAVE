import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";

import { theme } from "../design/theme";

type StatusVariant = "info" | "success" | "warning" | "error";

type StatusBannerProps = {
  message: string;
  variant: StatusVariant;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

const STATUS_PRESENTATION: Record<
  StatusVariant,
  { backgroundColor: string; icon: string; tone: string }
> = {
  info: {
    backgroundColor: theme.color.surfaceMuted,
    icon: "ⓘ",
    tone: theme.color.info
  },
  success: {
    backgroundColor: theme.color.surfaceMuted,
    icon: "✓",
    tone: theme.color.success
  },
  warning: {
    backgroundColor: theme.color.surfaceMuted,
    icon: "!",
    tone: theme.color.warning
  },
  error: {
    backgroundColor: theme.color.dangerSurface,
    icon: "×",
    tone: theme.color.error
  }
};

export function StatusBanner({
  message,
  variant,
  actionLabel,
  onAction,
  testID
}: StatusBannerProps) {
  const [actionFocused, setActionFocused] = useState(false);
  const presentation = STATUS_PRESENTATION[variant];
  const isError = variant === "error";

  useEffect(() => {
    if (process.env.EXPO_OS === "ios") {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message, variant]);

  return (
    <View
      style={{
        backgroundColor: presentation.backgroundColor,
        borderColor: presentation.tone,
        borderRadius: theme.radius.md,
        borderWidth: theme.border.width,
        gap: theme.space.sm,
        padding: theme.space.md
      }}
      testID={testID}
    >
      <View
        accessible
        accessibilityLabel={`${presentation.icon} ${message}`}
        accessibilityLiveRegion={isError ? "assertive" : "polite"}
        role={isError ? "alert" : "status"}
        style={{ alignItems: "flex-start", flexDirection: "row", gap: theme.space.sm }}
      >
        <Text
          style={{ ...theme.typography.heading, color: presentation.tone }}
        >
          {presentation.icon}
        </Text>
        <Text selectable style={{ ...theme.typography.body, color: theme.color.text, flex: 1 }}>
          {message}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onBlur={() => setActionFocused(false)}
          onFocus={() => setActionFocused(true)}
          onPress={onAction}
          style={({ pressed }) => ({
            alignItems: "center",
            alignSelf: "flex-start",
            backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
            borderColor: theme.color.surface,
            borderRadius: theme.radius.md,
            borderWidth: theme.border.width,
            justifyContent: "center",
            minHeight: theme.size.minimumTouchTarget,
            minWidth: theme.size.minimumTouchTarget,
            opacity: pressed ? 0.82 : 1,
            outlineColor: theme.color.focus,
            outlineOffset: theme.space.xs,
            outlineWidth: actionFocused ? theme.border.focusWidth : 0,
            paddingHorizontal: theme.space.md
          })}
        >
          <Text style={{ ...theme.typography.button, color: presentation.tone }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
