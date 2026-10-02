import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";
import { IconTextAction } from "../../../core/ui/icon-text-action";
import { PageHeader } from "../../../core/ui/page-header";

// Keep the existing save-time back guard visible to assistive technology.
export function JournalEditorHeader({ title, help, onBack, saving }: {
  title: string; help: ReactNode; onBack?: (() => void) | undefined; saving: boolean;
}) {
  const theme = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space.sm }}>
    {onBack ? <IconTextAction icon="chevron-back" iconOnly disabled={saving} label="返回手记列表" onPress={onBack} /> : null}
    <View style={{ flex: 1, minWidth: 0 }}><PageHeader title={title} help={help} /></View>
  </View>;
}
