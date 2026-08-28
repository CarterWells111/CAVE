import { Tabs } from "expo-router";

import { theme } from "../../src/core/design/theme";
import { ShellRouteGate } from "../../src/features/shell/ui/ShellRouteGate";

export default function LongTermTabsLayout() {
  return (
    <ShellRouteGate>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.color.primary,
          tabBarInactiveTintColor: theme.color.textSecondary,
          tabBarStyle: { backgroundColor: theme.color.surface, borderTopColor: theme.color.border },
          tabBarLabelStyle: { ...theme.typography.caption }
        }}
      >
        <Tabs.Screen name="index" options={{ title: "首页", tabBarAccessibilityLabel: "首页，底部导航" }} />
        <Tabs.Screen name="reviews" options={{ title: "回顾", tabBarAccessibilityLabel: "回顾，底部导航" }} />
        <Tabs.Screen name="practice" options={{ title: "练习", tabBarAccessibilityLabel: "练习，底部导航" }} />
        <Tabs.Screen name="cards" options={{ title: "卡片", tabBarAccessibilityLabel: "卡片，底部导航" }} />
      </Tabs>
    </ShellRouteGate>
  );
}
