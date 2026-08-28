import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";

import { theme } from "../src/core/design/theme";
import { Screen } from "../src/core/ui/Screen";

export default function IndexRoute() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/journey/welcome");
  }, [router]);

  return (
    <Screen contentContainerStyle={{ justifyContent: "center" }}>
      <Text accessibilityLiveRegion="polite" style={{ ...theme.typography.body, color: theme.color.text }}>
        正在打开内界 CAVE…
      </Text>
    </Screen>
  );
}
