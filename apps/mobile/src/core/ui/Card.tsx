import { View, type ViewProps, type ViewStyle } from "react-native";

import { useTheme } from "../design/theme-provider";
import type { AppTheme } from "../design/theme";

export type CardVariant = "default" | "muted" | "accent";

export type CardProps = ViewProps & {
  variant?: CardVariant;
};

function getVariantStyles(theme: AppTheme): Record<CardVariant, ViewStyle> {
  return {
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
}

export function Card({
  accessible = true,
  accessibilityRole = "summary",
  children,
  style,
  variant = "default",
  ...props
}: CardProps) {
  const theme = useTheme();
  const variantStyles = getVariantStyles(theme);
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
