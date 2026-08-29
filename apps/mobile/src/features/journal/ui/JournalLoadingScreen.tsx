import { Text } from "react-native";

import { useTheme } from "../../../core/design/theme-provider";
import { Screen } from "../../../core/ui/Screen";

export function JournalLoadingScreen({ message }: Readonly<{ message: string }>) {
  const theme = useTheme();
  return (
    <Screen>
      <Text accessibilityLiveRegion="polite" selectable style={{ ...theme.typography.body, color: theme.color.textSecondary }}>
        {message}
      </Text>
    </Screen>
  );
}
