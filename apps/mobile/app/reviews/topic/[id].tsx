import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "react-native";

import { useTheme } from "../../../src/core/design/theme-provider";
import { Screen } from "../../../src/core/ui/Screen";
import { ReflectionPage } from "../../../src/features/journey/ui/pages/reflection-page";

const topicTitles: Record<string, string> = {
  body: "身体感受回顾",
  boundaries: "边界与表达回顾",
};

export default function StandaloneReviewTopicRoute() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <Screen>
      <Text accessibilityRole="header" style={{ ...theme.typography.title, color: theme.color.text }}>
        {topicTitles[typeof id === "string" ? id : ""] ?? "主题回顾"}
      </Text>
      <ReflectionPage
        onComplete={async () => { router.replace("/(tabs)/reviews"); }}
        onSave={async () => undefined}
      />
    </Screen>
  );
}
