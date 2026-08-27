import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  Text,
  useWindowDimensions,
  View
} from "react-native";

import { theme } from "../design/theme";

const TOTAL_PAGES = 8;

type ProgressHeaderProps = {
  currentPage: number;
  onBack?: () => void;
  onExit?: () => void;
  backLabel?: string;
  exitLabel?: string;
  backBusy?: boolean;
  backDisabled?: boolean;
  testID?: string;
};

type HeaderActionProps = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
};

function HeaderAction({
  label,
  onPress,
  busy = false,
  disabled = false
}: HeaderActionProps) {
  const [focused, setFocused] = useState(false);
  const unavailable = busy || disabled;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: unavailable }}
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
        backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
        borderColor: theme.color.surface,
        borderRadius: theme.radius.md,
        borderWidth: theme.border.width,
        flexShrink: 1,
        justifyContent: "center",
        maxWidth: "100%",
        minHeight: theme.size.minimumTouchTarget,
        minWidth: theme.size.minimumTouchTarget,
        opacity: pressed ? 0.82 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.space.xs,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.sm
      })}
    >
      <Text
        style={{
          ...theme.typography.button,
          color: theme.color.primary,
          flexShrink: 1,
          flexWrap: "wrap",
          maxWidth: "100%",
          textAlign: "center"
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ProgressHeader({
  currentPage,
  onBack,
  onExit,
  backLabel = "返回上一页",
  exitLabel = "退出旅程",
  backBusy = false,
  backDisabled = false,
  testID
}: ProgressHeaderProps) {
  const { fontScale, width } = useWindowDimensions();
  const validCurrentPage =
    Number.isInteger(currentPage) && currentPage >= 1 && currentPage <= TOTAL_PAGES;
  const announcement = `第 ${currentPage} 页，共 ${TOTAL_PAGES} 页`;
  const useTwoLineLayout = width <= 360 || fontScale >= 1.5;

  useEffect(() => {
    if (validCurrentPage && process.env.EXPO_OS === "ios") {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [announcement, validCurrentPage]);

  if (!validCurrentPage) {
    throw new RangeError("ProgressHeader currentPage must be an integer from 1 through 8.");
  }

  const leadingSlot = (
    <View
      style={{ alignItems: "flex-start", flex: 1 }}
      testID="progress-leading-slot"
    >
      {onBack ? (
        <HeaderAction
          busy={backBusy}
          disabled={backDisabled}
          label={backLabel}
          onPress={onBack}
        />
      ) : null}
    </View>
  );
  const progress = (
    <Text
      accessibilityLabel={announcement}
      accessibilityLiveRegion="polite"
      accessibilityRole="header"
      style={{
        ...theme.typography.label,
        color: theme.color.textMuted,
        flexShrink: 1,
        flexWrap: "wrap",
        fontVariant: ["tabular-nums"],
        maxWidth: "100%",
        textAlign: "center"
      }}
      testID="progress-center"
    >
      {announcement}
    </Text>
  );
  const trailingSlot = (
    <View
      style={{ alignItems: "flex-end", flex: 1 }}
      testID="progress-trailing-slot"
    >
      {onExit ? <HeaderAction label={exitLabel} onPress={onExit} /> : null}
    </View>
  );

  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: useTwoLineLayout ? "column" : "row",
        gap: theme.space.sm,
        width: "100%"
      }}
      testID={testID}
    >
      {useTwoLineLayout ? (
        <>
          <View
            style={{
              alignItems: "flex-start",
              flexDirection: "row",
              gap: theme.space.sm,
              width: "100%"
            }}
            testID="progress-actions-row"
          >
            {leadingSlot}
            {trailingSlot}
          </View>
          {progress}
        </>
      ) : (
        <>
          {leadingSlot}
          {progress}
          {trailingSlot}
        </>
      )}
    </View>
  );
}
