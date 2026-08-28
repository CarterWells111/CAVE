import { Tabs } from "expo-router";

import { ShellRouteGate } from "../../src/features/shell/ui/ShellRouteGate";
import { LongTermTabBar } from "../../src/features/shell/ui/LongTermTabBar";

export default function LongTermTabsLayout() {
  return (
    <ShellRouteGate>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ navigation, state }) => (
          <LongTermTabBar
            emitTabPress={(target) => navigation.emit({
              type: "tabPress",
              target,
              canPreventDefault: true
            })}
            navigate={(routeName) => navigation.navigate(routeName)}
            state={state}
          />
        )}
      >
        <Tabs.Screen name="index" options={{ title: "首页", tabBarAccessibilityLabel: "首页，底部导航" }} />
        <Tabs.Screen name="reviews" options={{ title: "回顾", tabBarAccessibilityLabel: "回顾，底部导航" }} />
        <Tabs.Screen name="practice" options={{ title: "练习", tabBarAccessibilityLabel: "练习，底部导航" }} />
        <Tabs.Screen name="profile" options={{ title: "我的", tabBarAccessibilityLabel: "我的，底部导航" }} />
      </Tabs>
    </ShellRouteGate>
  );
}
