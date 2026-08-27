import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";

import { theme } from "../design/theme";

const TOTAL_PAGES = 8;

type ProgressHeaderProps = {
  currentPage: number;
  onBack?: () => void;
  onExit?: () => void;
  backLabel?: string;
  exitLabel?: string;
  testID?: string;
};

type HeaderActionProps = {
  label: string;
  onPress: () => void;
};

function HeaderAction({ label, onPress }: HeaderActionProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
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
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.sm
      })}
    >
      <Text style={{ ...theme.typography.button, color: theme.color.primary }}>{label}</Text>
    </Pressable>
  );
}

export function ProgressHeader({
  currentPage,
  onBack,
  onExit,
  backLabel = "返回上一页",
  exitLabel = "退出旅程",
  testID
}: ProgressHeaderProps) {
  const validCurrentPage =
    Number.isInteger(currentPage) && currentPage >= 1 && currentPage <= TOTAL_PAGES;
  const announcement = `第 ${currentPage} 页，共 ${TOTAL_PAGES} 页`;

  useEffect(() => {
    if (validCurrentPage && process.env.EXPO_OS === "ios") {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [announcement, validCurrentPage]);

  if (!validCurrentPage) {
    throw new RangeError("ProgressHeader currentPage must be an integer from 1 through 8.");
  }

  return (
    <View
      style={{ alignItems: "center", flexDirection: "row", gap: theme.space.sm, width: "100%" }}
      testID={testID}
    >
      <View
        style={{ alignItems: "flex-start", flex: 1 }}
        testID="progress-leading-slot"
      >
        {onBack ? <HeaderAction label={backLabel} onPress={onBack} /> : null}
      </View>
      <Text
        accessibilityLabel={announcement}
        accessibilityLiveRegion="polite"
        accessibilityRole="header"
        style={{
          ...theme.typography.label,
          color: theme.color.textMuted,
          flexShrink: 0,
          fontVariant: ["tabular-nums"],
          textAlign: "center"
        }}
        testID="progress-center"
      >
        {announcement}
      </Text>
      <View
        style={{ alignItems: "flex-end", flex: 1 }}
        testID="progress-trailing-slot"
      >
        {onExit ? <HeaderAction label={exitLabel} onPress={onExit} /> : null}
      </View>
    </View>
  );
}
