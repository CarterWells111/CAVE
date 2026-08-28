import type { PropsWithChildren } from "react";
import { Text, View, type ViewProps } from "react-native";

import { useTheme } from "../design/theme-provider";

export type InfoCardVariant = "default" | "medical" | "education" | "pause" | "safety";
export type InfoCardProps = PropsWithChildren<ViewProps & { title?: string; variant?: InfoCardVariant }>;

export function InfoCard({ children, title, variant = "default", style, ...props }: InfoCardProps) {
  const theme = useTheme();
  const presentation: Record<InfoCardVariant, { label: string; tone: string }> = {
    default: { label: "说明", tone: theme.color.brandLavender },
    medical: { label: "医学事实", tone: theme.color.brandLavender },
    education: { label: "教育原则", tone: theme.color.infoMuted },
    pause: { label: "暂停原则", tone: theme.color.brandSoft },
    safety: { label: "安全资源", tone: theme.color.safetyMuted },
  };
  const item = presentation[variant];
  return (
    <View
      accessibilityRole="summary"
      {...props}
      style={[
        {
          backgroundColor: theme.color.surface,
          borderCurve: "continuous",
          borderLeftColor: item.tone,
          borderLeftWidth: 3,
          borderRadius: theme.radius.control,
          gap: theme.space.compact,
          padding: theme.space.md,
        },
        style,
      ]}
    >
      <Text style={{ ...theme.typography.label, color: theme.color.textSecondary }}>{item.label}</Text>
      {title ? <Text style={{ ...(variant === "pause" ? theme.typography.heading : theme.typography.cardTitle), color: theme.color.text }}>{title}</Text> : null}
      {children}
    </View>
  );
}
