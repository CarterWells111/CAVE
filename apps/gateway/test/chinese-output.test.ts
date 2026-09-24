import { expect, it } from "vitest";
import { isChineseProse } from "../src/services/chinese-output";

it("accepts Chinese with short abbreviations and rejects English prose", () => {
  expect(isChineseProse("可以先记下感受，再决定是否使用 AI。")).toBe(true);
  expect(isChineseProse("Let's look at your record.")).toBe(false);
  expect(isChineseProse("Here is your answer，朋友。")).toBe(false);
  expect(isChineseProse("OK")).toBe(false);
});
