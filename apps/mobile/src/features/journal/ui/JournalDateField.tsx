import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { formatJournalDate, journalDateFromDate, parseJournalDate } from "../domain/journal-date";

export function JournalDateField({ disabled = false, label, onChange, value }: Readonly<{
  disabled?: boolean;
  label: string;
  onChange(value: string): void;
  value: string;
}>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const isIos = process.env.EXPO_OS === "ios";
  const update = (event: DateTimePickerEvent, selected?: Date) => {
    if (!isIos) setOpen(false);
    if (event.type !== "dismissed" && selected !== undefined) onChange(journalDateFromDate(selected));
  };

  return <View style={{ gap: theme.space.sm }}>
    <Text style={{ ...theme.typography.label, color: theme.color.textMuted }}>{label}</Text>
    <Pressable
      accessibilityLabel={`${label}，${formatJournalDate(value)}`}
      accessibilityRole="button"
      accessibilityState={{ disabled, expanded: open }}
      disabled={disabled}
      onPress={() => setOpen(true)}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
        borderColor: theme.color.border,
        borderCurve: "continuous",
        borderRadius: theme.radius.md,
        borderWidth: theme.border.width,
        flexDirection: "row",
        justifyContent: "space-between",
        minHeight: theme.size.minimumTouchTarget,
        opacity: disabled ? 0.6 : 1,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.compact,
      })}
    >
      <Text style={{ ...theme.typography.body, color: theme.color.text }}>{formatJournalDate(value)}</Text>
      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color: theme.color.primary }}>选择日期</Text>
    </Pressable>
    {open ? <View style={{ backgroundColor: theme.color.surface, borderCurve: "continuous", borderRadius: theme.radius.md, overflow: "hidden" }}>
      <DateTimePicker
        display={isIos ? "inline" : "default"}
        mode="date"
        onChange={update}
        themeVariant={theme.name}
        value={parseJournalDate(value)}
      />
      {isIos ? <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ alignSelf: "flex-end", minHeight: theme.size.minimumTouchTarget, padding: theme.space.md }}>
        <Text style={{ ...theme.typography.button, color: theme.color.primary }}>完成</Text>
      </Pressable> : null}
    </View> : null}
  </View>;
}
