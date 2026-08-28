import { View, type ViewProps, type ViewStyle } from "react-native";

import { theme } from "../design/theme";

export type CardVariant = "default" | "muted" | "accent";

export type CardProps = ViewProps & {
  variant?: CardVariant;
};

const variantStyles: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    borderStyle: "solid",
  },
  muted: {
    backgroundColor: theme.color.surfaceMuted,
    borderColor: theme.color.border,
    borderStyle: "dashed",
  },
  accent: {
    backgroundColor: theme.color.surfaceAccent,
    borderColor: theme.color.primary,
    borderStyle: "solid",
    borderWidth: theme.border.focusWidth,
  },
};

export function Card({
  accessible = true,
  accessibilityRole = "summary",
  children,
  style,
  variant = "default",
  ...props
}: CardProps) {
  return (
    <View
      {...props}
      accessible={accessible}
      accessibilityRole={accessibilityRole}
      style={[
        {
          borderCurve: "continuous",
          borderRadius: theme.radius.lg,
          borderWidth: theme.border.width,
          gap: theme.space.md,
          padding: theme.space.lg,
        },
        variantStyles[variant],
        style,
      ]}
    >
      {children}
    </View>
  );
}
