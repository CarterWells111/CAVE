import type { RefObject } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../design/theme-provider";
import { BottomSheet } from "./bottom-sheet";
import { SecondaryButton } from "./secondary-button";

export type SourceDrawerProps = {
  visible: boolean;
  title: string;
  institution: string;
  updatedAt: string;
  onClose: () => void;
  onAction: () => void;
  actionLabel?: string;
  onInitialFocus?: () => void;
  onDismiss?: () => void;
  onRestoreFocus?: () => void;
  returnFocusRef?: RefObject<View | null> | undefined;
  reducedMotion?: boolean | undefined;
};

export function SourceDrawer({
  visible,
  title,
  institution,
  updatedAt,
  onClose,
  onAction,
  actionLabel = "在浏览器中打开",
  onInitialFocus,
  onDismiss,
  onRestoreFocus,
  returnFocusRef,
  reducedMotion,
}: SourceDrawerProps) {
  const theme = useTheme();
  return (
    <BottomSheet
      {...(onInitialFocus ? { onInitialFocus } : {})}
      {...(onDismiss ? { onDismiss } : {})}
      {...(onRestoreFocus ? { onRestoreFocus } : {})}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      {...(reducedMotion === undefined ? {} : { reducedMotion })}
      onClose={onClose}
      title={title}
      visible={visible}
    >
      <View style={{ gap: theme.space.sm }}>
        <Text style={{ ...theme.typography.cardTitle, color: theme.color.text }}>{institution}</Text>
        <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>{updatedAt}</Text>
        <Text style={{ ...theme.typography.caption, color: theme.color.textSecondary }}>将在浏览器中打开</Text>
      </View>
      <SecondaryButton label={actionLabel} onPress={onAction} />
    </BottomSheet>
  );
}
