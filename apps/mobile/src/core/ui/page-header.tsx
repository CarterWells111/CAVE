import { useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../design/theme-provider";
import { BottomSheet } from "./bottom-sheet";
import { IconTextAction } from "./icon-text-action";

export type PageHelpProps = {
  title: string;
  children: ReactNode;
};

export function PageHelp({ title, children }: PageHelpProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<View>(null);
  return <>
    <IconTextAction ref={trigger} icon="help-circle-outline" iconOnly label={`${title}，帮助`} onPress={() => setOpen(true)} />
    <BottomSheet title={`${title} · 帮助`} visible={open} onClose={() => setOpen(false)} returnFocusRef={trigger}>
      {children}
    </BottomSheet>
  </>;
}

export type PageHeaderProps = {
  title: string;
  help?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
};

export function PageHeader({ title, help, actions, onBack, backLabel = "返回" }: PageHeaderProps) {
  const theme = useTheme();
  return <View style={{ alignItems: "center", flexDirection: "row", gap: theme.space.sm, minWidth: 0, width: "100%" }}>
    {onBack ? <IconTextAction icon="chevron-back" iconOnly label={backLabel} onPress={onBack} /> : null}
    <Text accessibilityRole="header" selectable style={{ ...theme.typography.title, color: theme.color.text, flex: 1, flexShrink: 1 }}>{title}</Text>
    <View style={{ alignItems: "center", flexDirection: "row", flexShrink: 0, gap: theme.space.xs }}>
      {actions}
      {help ? <PageHelp title={title}>{help}</PageHelp> : null}
    </View>
  </View>;
}

export function HelpText({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>{children}</Text>;
}
