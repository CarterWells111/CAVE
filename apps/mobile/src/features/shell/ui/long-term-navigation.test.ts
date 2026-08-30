import {
  getLongTermDestination,
  getLongTermDestinationByRouteName,
  LONG_TERM_DESTINATIONS,
  MAIN_TAB_DESTINATIONS,
} from "./long-term-navigation";

test("defines the four long-term destinations once with their routes and icons", () => {
  expect(LONG_TERM_DESTINATIONS).toEqual([
    { icon: "home-outline", label: "首页", path: "/(tabs)", routeName: "index", tab: "home" },
    { icon: "time-outline", label: "回顾", path: "/(tabs)/reviews", routeName: "reviews", tab: "reviews" },
    { icon: "chatbubbles-outline", label: "练习", path: "/(tabs)/practice", routeName: "practice", tab: "practice" },
    { icon: "person-outline", label: "我的", path: "/(tabs)/profile", routeName: "profile", tab: "profile" },
  ]);

  expect(getLongTermDestination("practice")).toBe(LONG_TERM_DESTINATIONS[2]);
  expect(getLongTermDestinationByRouteName("reviews")).toBe(LONG_TERM_DESTINATIONS[1]);
  expect(getLongTermDestinationByRouteName("unknown")).toBeUndefined();
});

test("keeps the review route registered while omitting it from the current bottom nav", () => {
  expect(MAIN_TAB_DESTINATIONS).toEqual([
    { icon: "home-outline", label: "首页", path: "/(tabs)", routeName: "index", tab: "home" },
    { icon: "chatbubbles-outline", label: "练习", path: "/(tabs)/practice", routeName: "practice", tab: "practice" },
    { icon: "person-outline", label: "我的", path: "/(tabs)/profile", routeName: "profile", tab: "profile" },
  ]);
  expect(LONG_TERM_DESTINATIONS.map(({ label }) => label)).toEqual(["首页", "回顾", "练习", "我的"]);
});
