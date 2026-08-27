import { describe, expect, it } from "vitest";

import { loadCatalog } from "./load";
import { ContentValidationError, validateCatalog } from "./validate";

function issueCodes(run: () => unknown) {
  try {
    run();
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(ContentValidationError);
    return (error as ContentValidationError).issues.map((issue) => issue.code);
  }
}

describe("versioned content validation", () => {
  it("uses the CAVE course identity and lesson back-reference", () => {
    const catalog = loadCatalog();

    expect(catalog.courses.map((course) => course.id)).toEqual(["cave-basics"]);
    expect(catalog.lessons.map((lesson) => lesson.courseId)).toEqual([
      "cave-basics"
    ]);
  });

  it("accepts the checked-in draft catalog", () => {
    expect(() => validateCatalog(loadCatalog(), { mode: "draft" })).not.toThrow();
  });

  it("accepts all seven content-owner reviewed entries in production", () => {
    const catalog = loadCatalog();
    const reviewableEntries = [
      ...catalog.courses,
      ...catalog.lessons,
      ...catalog.scenarios,
      ...catalog.guide.categories
    ];

    expect(reviewableEntries).toHaveLength(7);
    expect(
      reviewableEntries.every(
        (entry) =>
          entry.reviewStatus === "reviewed" &&
          entry.reviewedAt === "2026-08-27"
      )
    ).toBe(true);
    expect(() =>
      validateCatalog(catalog, { mode: "production" })
    ).not.toThrow();
  });

  it("rejects draft content in production", () => {
    const catalog = loadCatalog();
    catalog.courses[0]!.reviewStatus = "draft";
    delete catalog.courses[0]!.reviewedAt;

    expect(
      issueCodes(() => validateCatalog(catalog, { mode: "production" }))
    ).toContain("DRAFT_CONTENT");
  });

  it("rejects missing lesson references", () => {
    const catalog = loadCatalog();
    catalog.scenarios[0]!.linkedLessonIds = ["lesson-missing"];

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "MISSING_LESSON"
    );
  });

  it("rejects duplicate lesson order", () => {
    const catalog = loadCatalog();
    catalog.lessons.push({
      ...structuredClone(catalog.lessons[0]!),
      id: "lesson-duplicate-order"
    });

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "DUPLICATE_ORDER"
    );
  });

  it("rejects duplicate IDs", () => {
    const catalog = loadCatalog();
    catalog.quizzes.push(structuredClone(catalog.quizzes[0]!));

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "DUPLICATE_ID"
    );
  });

  it.each([
    ["unsupported stage", { allowedStages: ["setup", "unsupported"] }],
    ["more than eight turns", { maxTurns: 9 }]
  ])("rejects %s", (_label, scenarioPatch) => {
    const catalog = loadCatalog() as unknown as {
      scenarios: Array<Record<string, unknown>>;
    };
    Object.assign(catalog.scenarios[0]!, scenarioPatch);

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "SCHEMA_INVALID"
    );
  });

  it("rejects broken lesson and scenario back references", () => {
    const catalog = loadCatalog();
    catalog.lessons[0]!.linkedScenarioIds = [];

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "MISSING_SCENARIO_BACKLINK"
    );
  });

  it("rejects empty source references", () => {
    const catalog = loadCatalog();
    catalog.courses[0]!.sourceRefs = [];

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "MISSING_SOURCE_REFS"
    );
  });
});
