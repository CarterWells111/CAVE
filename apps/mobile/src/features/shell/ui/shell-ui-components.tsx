import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { ActionRow } from "../../../core/ui/action-row";
import { PageHeader } from "../../../core/ui/page-header";
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

export function ShellFrame({ children, title, help }: { children: ReactNode; title: string; help?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexGrow: 1, gap: theme.space.xl, minWidth: 0, width: "100%" }}>
      <PageHeader title={title} help={help} />
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
  testID,
  item,
  onAction,
}: {
  actionLabel: string;
  testID?: string;
  item: ShellMetadataItem;
  onAction?: ((id: string) => void) | undefined;
}) {
  return (
    <ActionRow title={item.title} subtitle={`${item.dateLabel} · ${item.statusLabel}`}
      accessibilityLabel={actionLabel.includes(item.dateLabel) ? actionLabel : `${actionLabel}，${item.title}，${item.dateLabel}，${item.statusLabel}`}
      {...(testID ? { testID } : {})} disabled={!onAction} onPress={() => onAction?.(item.id)} />
  );
}
