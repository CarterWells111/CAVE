import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../../core/design/theme-provider";
import { LONG_TERM_DESTINATIONS, type LongTermTab } from "./long-term-navigation";

export type { LongTermTab } from "./long-term-navigation";

export type LongTermBottomNavProps = Readonly<{
  activeTab?: LongTermTab | undefined;
  navigate: (tab: LongTermTab) => void;
}>;

export function LongTermBottomNav({ activeTab, navigate }: LongTermBottomNavProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ backgroundColor: theme.color.surface }}
      testID="long-term-bottom-nav-safe-area"
    >
      <View
        accessibilityLabel="长期使用导航"
        style={{
          alignItems: "stretch",
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
          borderTopWidth: theme.border.width,
          flexDirection: "row",
          gap: theme.space.xs,
          paddingHorizontal: theme.space.sm,
          paddingVertical: theme.space.xs
        }}
      >
        {LONG_TERM_DESTINATIONS.map(({ icon, label, tab }) => {
          const selected = activeTab === tab;
          return (
            <Pressable
              accessibilityHint={`切换到${label}`}
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab}
              onPress={() => navigate(tab)}
              style={{
                alignItems: "center",
                backgroundColor: selected ? theme.color.surfaceAccent : theme.color.surface,
                borderColor: selected ? theme.color.focus : "transparent",
                borderRadius: theme.radius.control,
                borderWidth: selected ? theme.border.selectedWidth : theme.border.width,
                flex: 1,
                gap: theme.space.xs,
                justifyContent: "center",
                minHeight: theme.size.minimumTouchTarget,
                minWidth: theme.size.minimumTouchTarget,
                paddingHorizontal: theme.space.xs,
                paddingVertical: theme.space.xs
              }}
            >
              <Text style={{ ...theme.typography.heading, color: selected ? theme.color.focus : theme.color.textSecondary }}>
                {icon}
              </Text>
              <Text style={{ ...theme.typography.label, color: selected ? theme.color.text : theme.color.textSecondary, textAlign: "center" }}>
                {label}
              </Text>
              {selected ? (
                <Text style={{ ...theme.typography.numericLabel, color: theme.color.focus }}>当前</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
