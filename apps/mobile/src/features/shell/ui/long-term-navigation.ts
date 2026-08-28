import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

export type LongTermTab = "home" | "reviews" | "practice" | "profile";

export type LongTermRouteName = "index" | "reviews" | "practice" | "profile";

export type LongTermPath =
  | "/(tabs)"
  | "/(tabs)/reviews"
  | "/(tabs)/practice"
  | "/(tabs)/profile";

export type LongTermIconName = ComponentProps<typeof Ionicons>["name"];

export type LongTermDestination = Readonly<{
  icon: LongTermIconName;
  label: string;
  path: LongTermPath;
  routeName: LongTermRouteName;
  tab: LongTermTab;
}>;

export const LONG_TERM_DESTINATIONS: ReadonlyArray<LongTermDestination> = [
  { icon: "home-outline", label: "首页", path: "/(tabs)", routeName: "index", tab: "home" },
  { icon: "time-outline", label: "回顾", path: "/(tabs)/reviews", routeName: "reviews", tab: "reviews" },
  { icon: "chatbubbles-outline", label: "练习", path: "/(tabs)/practice", routeName: "practice", tab: "practice" },
  { icon: "person-outline", label: "我的", path: "/(tabs)/profile", routeName: "profile", tab: "profile" },
];

const DESTINATIONS_BY_TAB = Object.fromEntries(
  LONG_TERM_DESTINATIONS.map((destination) => [destination.tab, destination]),
) as Readonly<Record<LongTermTab, LongTermDestination>>;

export function getLongTermDestination(tab: LongTermTab): LongTermDestination {
  return DESTINATIONS_BY_TAB[tab];
}

export function getLongTermDestinationByRouteName(
  routeName: string,
): LongTermDestination | undefined {
  return LONG_TERM_DESTINATIONS.find((destination) => destination.routeName === routeName);
}
