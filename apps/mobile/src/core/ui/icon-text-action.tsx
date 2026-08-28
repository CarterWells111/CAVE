import { Ionicons } from "@expo/vector-icons";
import { type ComponentProps, forwardRef, useState } from "react";
import { Pressable, Text, type View } from "react-native";

import { useTheme } from "../design/theme-provider";

export type IconTextActionProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress(): void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export const IconTextAction = forwardRef<View, IconTextActionProps>(function IconTextAction({
  disabled = false,
  icon,
  label,
  loading = false,
  onPress,
  testID,
}: IconTextActionProps, ref) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || loading;

  return (
    <Pressable
      ref={ref}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        borderCurve: "continuous",
        borderRadius: theme.radius.label,
        flexDirection: "row",
        gap: theme.space.xs,
        justifyContent: "center",
        minHeight: theme.size.minimumTouchTarget,
        minWidth: theme.size.minimumTouchTarget,
        opacity: unavailable ? 0.65 : pressed ? 0.72 : 1,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusOffset,
        outlineWidth: focused ? theme.border.focusWidth : 0,
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space.sm,
      })}
      testID={testID}
    >
      <Ionicons accessible={false} color={unavailable ? theme.color.disabledText : theme.color.textSecondary} name={icon} size={theme.size.icon} />
      <Text style={{ ...theme.typography.button, color: unavailable ? theme.color.disabledText : theme.color.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
});
