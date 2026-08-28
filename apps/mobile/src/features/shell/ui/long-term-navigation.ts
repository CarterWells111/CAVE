export type LongTermTab = "home" | "reviews" | "practice" | "cards";

export type LongTermRouteName = "index" | "reviews" | "practice" | "cards";

export type LongTermPath =
  | "/(tabs)"
  | "/(tabs)/reviews"
  | "/(tabs)/practice"
  | "/(tabs)/cards";

export type LongTermDestination = Readonly<{
  icon: string;
  label: string;
  path: LongTermPath;
  routeName: LongTermRouteName;
  tab: LongTermTab;
}>;

export const LONG_TERM_DESTINATIONS: ReadonlyArray<LongTermDestination> = [
  { icon: "⌂", label: "首页", path: "/(tabs)", routeName: "index", tab: "home" },
  { icon: "↺", label: "回顾", path: "/(tabs)/reviews", routeName: "reviews", tab: "reviews" },
  { icon: "◇", label: "练习", path: "/(tabs)/practice", routeName: "practice", tab: "practice" },
  { icon: "▤", label: "卡片", path: "/(tabs)/cards", routeName: "cards", tab: "cards" },
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
