import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Card } from "../../../core/ui/Card";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { StatusBanner } from "../../../core/ui/StatusBanner";

export type ShellLoadState = "loading" | "ready" | "error";

export type ShellMetadataItem = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  statusLabel: string;
}>;

export type ActiveJourneyMetadataItem = ShellMetadataItem & Readonly<{
  kind: "initial" | "review";
}>;

export function ShellFrame({ children, title }: { children: ReactNode; title: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexGrow: 1, gap: theme.space.xl, minWidth: 0, width: "100%" }}>
      <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function ShellLoading() {
  return <StatusBanner message="正在读取这台设备上的内容…" variant="info" />;
}

export function SectionHeading({ children }: { children: string }) {
  const theme = useTheme();
  return <Text accessibilityRole="header" selectable style={{ ...theme.typography.heading, color: theme.color.text }}>{children}</Text>;
}

export function SupportingText({ children }: { children: string }) {
  const theme = useTheme();
  return <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{children}</Text>;
}

export function MetadataCard({
  actionLabel,
  item,
  onAction,
}: {
  actionLabel: string;
  item: ShellMetadataItem;
  onAction?: ((id: string) => void) | undefined;
}) {
  const theme = useTheme();
  return (
    <Card accessible={false}>
      <Text selectable style={{ ...theme.typography.cardTitle, color: theme.color.text }}>{item.title}</Text>
      <Text selectable style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>
        {`${item.dateLabel} · ${item.statusLabel}`}
      </Text>
      <SecondaryButton disabled={!onAction} label={actionLabel} onPress={() => onAction?.(item.id)} />
    </Card>
  );
}
