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

  it("publishes the agreed body content in 01 while leaving 02–06 as framework previews", () => {
    const body = SAMPLE_JOURNEYS[0]!;
    expect(body.preview).toBe(false);
    expect(body.pages.map(({ kind }) => kind)).toEqual(["introduction", "content", "end"]);
    expect(body.pages.map(({ title }) => title)).toEqual([
      "外阴、阴道在哪里？",
      "每个人的样子都不同",
      "身体反应与我的选择",
    ]);
    expect(body.pages[0].showVulvaDiagram).toBe(true);
    expect(body.pages[1].article?.url).toBe("https://www.acog.org/womens-health/faqs/vulvovaginal-health");
    expect(body.pages[2].body).toContain("这些只是你身体的反应，而你心里可能是舒服、好奇、犹豫或不适");
    expect(body.pages[2].webLink?.url).toBe("https://neijiecave.com/body-response/");

    for (const journey of SAMPLE_JOURNEYS.slice(1)) {
      expect(journey.preview).toBe(true);
      expect(journey.icon).toEqual(expect.any(String));
      expect(journey.pages.map(({ kind }) => kind)).toEqual(["introduction", "content", "end"]);
      expect(journey.pages[0].body).toContain("框架预览");
      expect(journey.pages[1].body).toContain("不包含正式内容");
      expect(journey.pages[2].body).toContain("不会生成回顾记录");
    }
    expect(new Set(SAMPLE_JOURNEYS.map(({ icon }) => icon)).size).toBe(6);
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
