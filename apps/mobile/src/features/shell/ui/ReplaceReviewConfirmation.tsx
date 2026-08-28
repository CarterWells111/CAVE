import { View } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Button } from "../../../core/ui/Button";
import { Card } from "../../../core/ui/Card";
import { SecondaryButton } from "../../../core/ui/secondary-button";
import { SectionHeading, SupportingText } from "./shell-ui-components";

export function ReplaceReviewConfirmation({ onCancel, onConfirm }: {
  onCancel(): void;
  onConfirm(): void;
}) {
  const theme = useTheme();
  return (
    <Card accessibilityRole="alert" variant="accent">
      <SectionHeading>已有进行中的回顾</SectionHeading>
      <SupportingText>开始新的完整回顾会替换当前草稿。已保存的历史记录不会被删除。</SupportingText>
      <View style={{ gap: theme.space.md }}>
        <Button label="确认开始新回顾" onPress={onConfirm} />
        <SecondaryButton label="取消新回顾" onPress={onCancel} />
      </View>
    </Card>
  );
}
