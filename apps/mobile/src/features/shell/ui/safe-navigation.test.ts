import { backOrHome, journalReturnDestination } from "./safe-navigation";

test("cold-start back falls back to public home", () => {
  const router = { canGoBack: () => false, back: jest.fn(), replace: jest.fn() };
  backOrHome(router);
  expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  expect(router.back).not.toHaveBeenCalled();
});

test("back respects existing navigation history", () => {
  const router = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };
  backOrHome(router);
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
});

test.each([
  ["/journal", { pathname: "/(tabs)/journal" }],
  ["/journal?cardId=card-1", { pathname: "/(tabs)/journal", params: { cardId: "card-1" } }],
  ["/journal/new?cardId=card%20%2F%20%E7%A7%81%E5%AF%86&ignored=yes", { pathname: "/journal/new", params: { cardId: "card / 私密" } }],
  ["/journal/review", { pathname: "/journal/review" }],
  ["/journal/record-1", { pathname: "/journal/[id]", params: { id: "record-1" } }],
  ["/journal/record-1/edit", { pathname: "/journal/[id]/edit", params: { id: "record-1" } }],
  ["/journal/record-1/add", { pathname: "/journal/[id]/add", params: { id: "record-1" } }],
  ["/journal/record-1/entry/entry-1", { pathname: "/journal/[id]/entry/[entryId]", params: { id: "record-1", entryId: "entry-1" } }],
])("accepts supported journal return route %s", (input, expected) => {
  expect(journalReturnDestination(input)).toEqual(expected);
});

test.each([undefined, ["/journal"], "/settings", "https://example.com/journal", "//example.com/journal", "/journal/../settings", "/journal/%2e%2e", "/journal/%2Fsettings", "/journal/%", "/journal/a/unknown", "/journal#fragment", "/journal\\new"])(
  "rejects invalid journal return route %s", (input) => expect(journalReturnDestination(input)).toBeNull(),
);
