import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { Href } from "expo-router";

export type LongTermTab = "journey" | "ai" | "practice" | "journal" | "profile";

export type LongTermRouteName = "index" | "journey" | "ai" | "reviews" | "practice" | "journal" | "profile";

export type LongTermPath =
  | "/(tabs)/journey"
  | "/(tabs)"
  | "/(tabs)/reviews"
  | "/(tabs)/practice"
  | "/(tabs)/journal"
  | "/(tabs)/ai"
  | "/(tabs)/profile";

export type LongTermIconName = ComponentProps<typeof Ionicons>["name"];

export type LongTermDestination = Readonly<{
  icon: LongTermIconName;
  label: string;
  path: LongTermPath;
  routeName: LongTermRouteName;
  tab: LongTermTab;
}>;

export const LONG_TERM_DESTINATIONS = [
  { icon: "compass-outline", label: "旅程", path: "/(tabs)", routeName: "index", tab: "journey" },
  { icon: "book-outline", label: "内界手记", path: "/(tabs)/journal", routeName: "journal", tab: "journal" },
  { icon: "sparkles-outline", label: "AI", path: "/(tabs)/ai", routeName: "ai", tab: "ai" },
  { icon: "person-outline", label: "我的", path: "/(tabs)/profile", routeName: "profile", tab: "profile" },
  { icon: "chatbubbles-outline", label: "练习", path: "/(tabs)/practice", routeName: "practice", tab: "practice" },
] as const satisfies ReadonlyArray<LongTermDestination & { path: Href }>;

export const MAIN_TAB_DESTINATIONS: ReadonlyArray<LongTermDestination> =
  LONG_TERM_DESTINATIONS.filter(({ tab }) => tab !== "practice");

const DESTINATIONS_BY_TAB = Object.fromEntries(
  LONG_TERM_DESTINATIONS.map((destination) => [destination.tab, destination]),
) as Readonly<Record<LongTermTab, LongTermDestination>>;

export function getLongTermDestination(tab: LongTermTab): LongTermDestination {
  return DESTINATIONS_BY_TAB[tab];
}

export function getLongTermDestinationByRouteName(
  routeName: string,
): LongTermDestination | undefined {
  const canonical = routeName === "journey" ? "index" : routeName;
  return LONG_TERM_DESTINATIONS.find((destination) => destination.routeName === canonical);
}
