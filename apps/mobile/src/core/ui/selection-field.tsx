import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../design/theme-provider";
import { BottomSheet } from "./bottom-sheet";

export type SelectionOption<T extends string> = { value: T; label: string; detail?: string };
export type SelectionFieldProps<T extends string> = {
  label: string;
  value: T;
  options: ReadonlyArray<SelectionOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function SelectionField<T extends string>({ label, value, options, onChange, disabled = false }: SelectionFieldProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const trigger = useRef<View>(null);
  const selected = options.find(option => option.value === value);
  return <>
    <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={`${label}，${selected?.label ?? "请选择"}`} accessibilityState={{ disabled, expanded: open }}
      disabled={disabled} onPress={() => setOpen(true)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.color.surfacePressed : theme.color.surface,
        borderRadius: theme.radius.md, minHeight: theme.size.minimumTouchTarget, padding: theme.space.md,
        flexDirection: "row", alignItems: "center", gap: theme.space.sm, opacity: disabled ? 0.65 : 1,
        outlineColor: theme.color.focus, outlineOffset: theme.border.focusOffset, outlineWidth: focused ? theme.border.focusWidth : 0 })}>
      <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{label}</Text>
      <Text style={{ ...theme.typography.body, color: theme.color.text, flex: 1, textAlign: "right" }}>{selected?.label ?? "请选择"} ▾</Text>
    </Pressable>
    <BottomSheet title={label} visible={open} onClose={() => setOpen(false)} returnFocusRef={trigger}>
      {options.map(option => <SelectionOptionRow key={option.value} option={option} checked={option.value === value} disabled={disabled}
        onPress={() => { onChange(option.value); setOpen(false); }} />)}
    </BottomSheet>
  </>;
}

function SelectionOptionRow<T extends string>({ option, checked, disabled, onPress }: { option: SelectionOption<T>; checked: boolean; disabled: boolean; onPress(): void }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="radio" accessibilityLabel={[option.label, option.detail].filter(Boolean).join("，")}
    accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minHeight: theme.size.minimumTouchTarget, padding: theme.space.md, borderRadius: theme.radius.md,
      backgroundColor: pressed ? theme.color.surfacePressed : checked ? theme.color.surfaceAccent : theme.color.surface,
      outlineColor: theme.color.focus, outlineOffset: theme.border.focusOffset, outlineWidth: focused ? theme.border.focusWidth : 0 })}>
    <Text style={{ ...theme.typography.body, color: theme.color.text }}>{checked ? "✓ " : ""}{option.label}</Text>
    {option.detail ? <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{option.detail}</Text> : null}
  </Pressable>;
}
