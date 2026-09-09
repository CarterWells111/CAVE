import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { darkTheme } from "../design/theme";

// Keep one visual surface while local account and appearance state is restored.
export function StartupScreen() {
  return <View style={{ flex: 1, backgroundColor: darkTheme.color.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
    <StatusBar style="light" />
    <Text accessibilityLiveRegion="polite" style={{ ...darkTheme.typography.body, color: darkTheme.color.textSecondary }}>正在打开内界 CAVE…</Text>
  </View>;
}
