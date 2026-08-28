import { resolveFirstRunLayout } from "./first-run-layout";

test("reflows the brand for constrained viewports without changing component scale", () => {
  expect(resolveFirstRunLayout({ fontScale: 1, height: 700, width: 360 })).toEqual({
    brandLayout: "stacked",
    brandPaddingTop: 20,
    screenPaddingVertical: 32,
  });
  expect(resolveFirstRunLayout({ fontScale: 1, height: 620, width: 360 })).toEqual({
    brandLayout: "inline-brand",
    brandPaddingTop: 0,
    screenPaddingVertical: 16,
  });
  expect(resolveFirstRunLayout({ fontScale: 1, height: 500, width: 320 })).toEqual({
    brandLayout: "inline-brand",
    brandPaddingTop: 0,
    screenPaddingVertical: 0,
  });
  expect(resolveFirstRunLayout({ fontScale: 1.2, height: 700, width: 360 })).toEqual({
    brandLayout: "inline-brand",
    brandPaddingTop: 0,
    screenPaddingVertical: 0,
  });
});
