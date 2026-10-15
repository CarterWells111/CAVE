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

  it("publishes all six journeys with the agreed content for 02", () => {
    const body = SAMPLE_JOURNEYS[0]!;
    expect(body.preview).toBe(false);
    expect(body.pages.map(({ kind }) => kind)).toEqual(["introduction", "content", "end"]);
    expect(body.pages.map(({ title }) => title)).toEqual([
      "外阴、阴道在哪里？",
      "每个人的样子都不同",
      "身体反应与我的选择",
    ]);
    expect(body.pages[0].showVulvaDiagram).toBe(true);
    expect(body.pages[1].article?.url).toBe("https://neijiecave.com/vulvovaginal-health/");
    expect(body.pages[2].body).toContain("这些只是你身体的反应，而你心里可能是舒服、好奇、犹豫或不适");
    expect(body.pages[2].webLink?.url).toBe("https://neijiecave.com/body-response/");

    const second = SAMPLE_JOURNEYS[1]!;
    expect(second.preview).toBe(false);
    expect(second.subtitle).toBe("认识愉悦的方式");
    expect(second.pages.map(({ title }) => title)).toEqual([
      "亲密没有固定顺序", "认识不同的亲密方式", "选择可以留给自己",
    ]);
    expect(second.pages[1].cards?.map(({ title }) => title)).toEqual([
      "亲吻与身体触碰", "乳房刺激", "手指触碰外阴", "口交", "阴道纳入", "独自探索", "肛门纳入",
    ]);
    expect(second.pages[1].cards?.[5]?.tag).toBe("可选");
    expect(second.pages[1].cards?.[6]?.tag).toBe("展开补充");
    expect(second.pages[1].footer).toContain("任何时候、出于任何原因");
    for (const journey of SAMPLE_JOURNEYS.slice(2)) {
      expect(journey.preview).toBe(false);
      expect(journey.icon).toEqual(expect.any(String));
      expect(journey.pages.map(({ kind }) => kind)).toEqual(["introduction", "content", "end"]);
      expect(journey.pages.every(({ body }) => body.length > 0)).toBe(true);
    }
    expect(SAMPLE_JOURNEYS[3]!.pages[2].preferenceCard).toBe(true);
    expect(SAMPLE_JOURNEYS[4]!.pages[1].cards?.map(({ title }) => title)).toEqual(["舒适与清洁", "保护出现意外", "检测与求助"]);
    expect(SAMPLE_JOURNEYS[5]!.pages[2].preferenceCard).toBe(true);
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
