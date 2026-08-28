import { Text, View } from "react-native";

import { theme } from "../../../../core/design/theme";

export function UnderageExitPage() {
  return (
    <View style={{ gap: theme.space.md }} testID="underage-exit">
      <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>
        此内容仅限成年人
      </Text>
      <Text selectable style={{ ...theme.typography.body, color: theme.color.text }}>
        你未满 18 岁，无法继续使用。请关闭 App。
      </Text>
    </View>
  );
}
