import { useContext } from "react";
import { Modal, Text, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { useTheme } from "../../core/design/theme-provider";
import { Button } from "../../core/ui/Button";
import { TextAction } from "../../core/ui/text-action";

export function AssistantPermissionDialog({ visible, message, onAllow, onCancel }: {
  visible: boolean;
  message: string;
  onAllow(): void;
  onCancel(): void;
}) {
  const theme = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#00000099", padding: 24, paddingTop: Math.max(insets?.top ?? 0, 24), paddingBottom: Math.max(insets?.bottom ?? 0, 24) }}>
      <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 560, alignSelf: "center", backgroundColor: theme.color.surface, borderRadius: theme.radius.sheet, padding: 24, gap: 24 }}>
        <Text accessibilityRole="header" style={{ ...theme.typography.body, color: theme.color.text }}>{message}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 24 }}>
          <TextAction label="取消" onPress={onCancel} />
          <View style={{ flex: 1 }}><Button label="允许" onPress={onAllow} /></View>
        </View>
      </View>
    </View>
  </Modal>;
}
