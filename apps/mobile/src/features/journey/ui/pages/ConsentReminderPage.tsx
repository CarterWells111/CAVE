import { Text, View } from "react-native";

import { useTheme } from "../../../../core/design/theme-provider";
import { JourneyAction } from "../components/JourneyAction";
import type { JourneyAction as JourneyActionCallback } from "../journey-ui-contracts";

type Props = Readonly<{
  onComplete(): ReturnType<JourneyActionCallback>;
}>;

export function ConsentReminderPage({ onComplete }: Props) {
  const theme = useTheme();
  const statementStyle = {
    ...theme.typography.display,
    color: theme.color.text,
  };

  return (
    <View style={{ gap: theme.space.xl }} testID="page-4-content">
      <View style={{ gap: theme.space.lg }}>
        <Text selectable style={statementStyle}>
          这是你此刻的感受，不是你必须履行的承诺。
        </Text>
        <Text selectable style={statementStyle}>
          即使之前同意过，你仍然可以随时改变主意、撤回同意。
        </Text>
        <Text selectable style={statementStyle}>
          你可以说“慢一点”“停一下”或“我不想继续”。
        </Text>
        <Text selectable style={statementStyle}>
          你不需要解释，也不需要把话说得完美。
        </Text>
        <Text selectable style={statementStyle}>
          当你叫停时，对方应当立即停止。
        </Text>
      </View>
      <JourneyAction
        errorMessage="暂时无法继续，请重试。"
        label="我知道了，继续整理沟通草稿"
        loadingLabel="正在打开沟通草稿…"
        onAction={onComplete}
      />
    </View>
  );
}
