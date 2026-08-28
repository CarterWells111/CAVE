import {
  getLongTermDestination,
  getLongTermDestinationByRouteName,
  LONG_TERM_DESTINATIONS,
} from "./long-term-navigation";

test("defines the four long-term destinations once with their routes and icons", () => {
  expect(LONG_TERM_DESTINATIONS).toEqual([
    { icon: "⌂", label: "首页", path: "/(tabs)", routeName: "index", tab: "home" },
    { icon: "↺", label: "回顾", path: "/(tabs)/reviews", routeName: "reviews", tab: "reviews" },
    { icon: "◇", label: "练习", path: "/(tabs)/practice", routeName: "practice", tab: "practice" },
    { icon: "▤", label: "卡片", path: "/(tabs)/cards", routeName: "cards", tab: "cards" },
  ]);

  expect(getLongTermDestination("practice")).toBe(LONG_TERM_DESTINATIONS[2]);
  expect(getLongTermDestinationByRouteName("reviews")).toBe(LONG_TERM_DESTINATIONS[1]);
  expect(getLongTermDestinationByRouteName("unknown")).toBeUndefined();
});
