import { getLongTermDestination, getLongTermDestinationByRouteName, LONG_TERM_DESTINATIONS, MAIN_TAB_DESTINATIONS } from "./long-term-navigation";
test("journey is the default with journal, AI and profile in order", () => {
 expect(MAIN_TAB_DESTINATIONS.map(({ label }) => label)).toEqual(["旅程", "内界手记", "AI", "我的"]);
 expect(getLongTermDestination("journey")).toMatchObject({ path: "/(tabs)", routeName: "index" });
 expect(getLongTermDestination("journal").path).toBe("/(tabs)/journal");
 expect(getLongTermDestination("ai").path).toBe("/(tabs)/ai");
 expect(getLongTermDestination("practice").path).toBe("/(tabs)/practice");
 expect(LONG_TERM_DESTINATIONS).toHaveLength(5);
 expect(getLongTermDestinationByRouteName("journey")).toBe(getLongTermDestination("journey"));
 expect(getLongTermDestinationByRouteName("reviews")).toBeUndefined();
 expect(getLongTermDestinationByRouteName("unknown")).toBeUndefined();
});
