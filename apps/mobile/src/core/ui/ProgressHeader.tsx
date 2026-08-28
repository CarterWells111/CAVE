import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";

import { useTheme } from "../design/theme-provider";

type ProgressHeaderProps = {
  currentPage: number;
  totalPages?: number;
  showProgress?: boolean;
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

function HeaderAction({ label, onPress, busy = false, disabled = false }: HeaderActionProps) {
  const theme = useTheme();
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
      onPress={() => { if (!unavailable) onPress(); }}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? theme.color.surfacePressed : "transparent",
        borderColor: unavailable ? theme.color.disabledText : "transparent",
        borderCurve: "continuous",
        borderRadius: theme.radius.control,
        borderWidth: unavailable ? theme.border.width : 0,
        flexShrink: 1,
        justifyContent: "center",
        maxWidth: "100%",
        minHeight: theme.size.minimumTouchTarget,
        minWidth: theme.size.minimumTouchTarget,
        opacity: unavailable ? 0.55 : pressed ? 0.82 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.sm,
      })}
    >
      <Text style={{ ...theme.typography.button, color: theme.color.textSecondary, flexShrink: 1, flexWrap: "wrap", maxWidth: "100%", textAlign: "center" }}>
        {label}
      </Text>
      {busy ? <Text style={{ ...theme.typography.numericLabel, color: theme.color.textSecondary }}>加载中</Text> : null}
      {disabled && !busy ? <Text style={{ ...theme.typography.numericLabel, color: theme.color.disabledText }}>不可用</Text> : null}
    </Pressable>
  );
}

export function ProgressHeader({
  currentPage,
  totalPages = 7,
  showProgress = currentPage !== 1,
  onBack,
  onExit,
  backLabel = "返回上一页",
  exitLabel = "退出旅程",
  backBusy = false,
  backDisabled = false,
  testID,
}: ProgressHeaderProps) {
  const theme = useTheme();
  const validTotal = Number.isInteger(totalPages) && totalPages > 0;
  const validCurrent = validTotal && Number.isInteger(currentPage) && currentPage >= 1 && currentPage <= totalPages;
  const announcement = `第 ${currentPage} 页，共 ${totalPages} 页`;

  useEffect(() => {
    if (validCurrent && showProgress && process.env.EXPO_OS === "ios") {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [announcement, showProgress, validCurrent]);

  if (!validCurrent) {
    throw new RangeError("ProgressHeader currentPage must be an integer from 1 through totalPages.");
  }

  const leading = (
    <View style={{ alignItems: "flex-start", flex: 1 }} testID="progress-leading-slot">
      {onBack ? <HeaderAction busy={backBusy} disabled={backDisabled} label={backLabel} onPress={onBack} /> : null}
    </View>
  );
  const trailing = (
    <View style={{ alignItems: "flex-end", flex: 1 }} testID="progress-trailing-slot">
      {onExit ? <HeaderAction label={exitLabel} onPress={onExit} /> : null}
    </View>
  );
  const progress = showProgress ? (
    <Text
      accessibilityLabel={announcement}
      accessibilityLiveRegion="polite"
      accessibilityRole="header"
      style={{ ...theme.typography.numericLabel, color: theme.color.textSecondary, flexShrink: 1, flexWrap: "wrap", fontVariant: ["tabular-nums"], maxWidth: "100%", textAlign: "center" }}
      testID="progress-center"
    >
      {currentPage} / {totalPages}
    </Text>
  ) : null;

  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: theme.space.sm, minHeight: theme.size.navigationHeight, width: "100%" }} testID={testID}>
      {leading}{progress}{trailing}
    </View>
  );
}
