import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../../core/design/theme-provider";
import {
  MAIN_TAB_DESTINATIONS,
  type LongTermDestination,
  type LongTermTab,
} from "./long-term-navigation";

export type { LongTermTab } from "./long-term-navigation";

export type LongTermBottomNavProps = Readonly<{
  activeTab?: LongTermTab | undefined;
  destinations?: ReadonlyArray<LongTermDestination> | undefined;
  disabled?: boolean | undefined;
  navigate: (tab: LongTermTab) => void;
}>;

export function LongTermBottomNav({
  activeTab,
  destinations = MAIN_TAB_DESTINATIONS,
  disabled = false,
  navigate,
}: LongTermBottomNavProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ backgroundColor: theme.color.surface }}
      testID="long-term-bottom-nav-safe-area"
    >
      <View
        accessibilityLabel="长期使用导航"
        testID="long-term-bottom-nav-content"
        style={{
          alignItems: "stretch",
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
          borderTopWidth: theme.border.width,
          flexDirection: "row",
          gap: theme.space.xs,
          height: theme.size.navigationHeight,
          paddingHorizontal: theme.space.sm,
          paddingVertical: theme.space.none
        }}
      >
        {destinations.map(({ icon, label, tab }) => {
          const selected = activeTab === tab;
          return (
            <Pressable
              accessibilityHint={`切换到${label}`}
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ disabled, selected }}
              disabled={disabled}
              key={tab}
              onPress={() => navigate(tab)}
              style={{
                alignItems: "center",
                backgroundColor: theme.color.surface,
                borderWidth: 0,
                flex: 1,
                gap: theme.space.none,
                justifyContent: "center",
                minHeight: theme.size.minimumTouchTarget,
                minWidth: theme.size.minimumTouchTarget,
                opacity: disabled ? 0.55 : 1,
                paddingHorizontal: theme.space.xs,
                paddingVertical: theme.space.none
              }}
            >
              <Ionicons
                accessible={false}
                color={selected ? theme.color.primary : theme.color.textSecondary}
                name={icon}
                size={selected ? theme.size.iconLarge : theme.size.icon}
              />
              <Text style={{ ...theme.typography.label, color: selected ? theme.color.primary : theme.color.textSecondary, textAlign: "center" }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
