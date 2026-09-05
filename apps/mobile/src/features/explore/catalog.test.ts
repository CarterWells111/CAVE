import { FIRST_OVERNIGHT, getSampleJourney, SAMPLE_JOURNEYS } from "./catalog";

describe("explore catalog", () => {
  it("offers exactly six distinct, ordered sample journeys", () => {
    expect(SAMPLE_JOURNEYS.map(({ id, title }) => ({ id, title }))).toEqual(
      Array.from({ length: 6 }, (_, index) => ({
        id: `journey-0${index + 1}`,
        title: `旅程 0${index + 1}`,
      })),
    );
    expect(new Set(SAMPLE_JOURNEYS.map(({ id }) => id)).size).toBe(6);
  });

  it("gives every sample its own icon and an explicit three-page framework preview", () => {
    for (const journey of SAMPLE_JOURNEYS) {
      expect(journey.icon).toEqual(expect.any(String));
      expect(journey.pages.map(({ kind }) => kind)).toEqual(["introduction", "content", "end"]);
      expect(journey.pages[0].body).toContain("框架预览");
      expect(journey.pages[1].body).toContain("不包含正式内容");
      expect(journey.pages[2].body).toContain("不会生成回顾记录");
    }
  });

  it("looks up each known sample without conflating it with the optional scenario", () => {
    for (const journey of SAMPLE_JOURNEYS) expect(getSampleJourney(journey.id)).toBe(journey);
    expect(FIRST_OVERNIGHT).toEqual({ id: "first-overnight", title: "第一次过夜" });
    expect(getSampleJourney(FIRST_OVERNIGHT.id)).toBeUndefined();
  });

  it.each([undefined, null, 1, {}, [], ["journey-01"], "", "journey-00", "journey-07", "JOURNEY-01", " journey-01", "toString", "__proto__"])(
    "rejects an unknown or malformed identifier (%j)", (id) => {
      expect(getSampleJourney(id)).toBeUndefined();
    },
  );
});
