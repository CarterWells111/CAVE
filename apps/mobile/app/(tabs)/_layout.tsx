import { Tabs } from "expo-router";

import { LongTermTabBar } from "../../src/features/shell/ui/LongTermTabBar";

export default function LongTermTabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
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
      <Tabs.Screen name="index" options={{ title: "旅程", tabBarAccessibilityLabel: "旅程，底部导航" }} />
      <Tabs.Screen name="journal" options={{ title: "内界手记", tabBarAccessibilityLabel: "内界手记，底部导航" }} />
      <Tabs.Screen name="ai" options={{ title: "AI", tabBarAccessibilityLabel: "AI，底部导航" }} />
      <Tabs.Screen name="profile" options={{ title: "我的", tabBarAccessibilityLabel: "我的，底部导航" }} />
      <Tabs.Screen name="journey" options={{ href: null }} />
      <Tabs.Screen name="reviews" options={{ href: null }} />
      <Tabs.Screen name="practice" options={{ href: null }} />
    </Tabs>
  );
}
