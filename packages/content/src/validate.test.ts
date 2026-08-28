import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadCatalog } from "./load";
import { ContentValidationError, validateCatalog } from "./validate";

function validationIssues(run: () => unknown) {
  try {
    run();
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(ContentValidationError);
    return (error as ContentValidationError).issues;
  }
}

function issueCodes(run: () => unknown) {
  return validationIssues(run).map((issue) => issue.code);
}

const validateCliPath = fileURLToPath(new URL("./validate-cli.ts", import.meta.url));
const tsxCliPath = createRequire(import.meta.url).resolve("tsx/cli");

function runValidateCli(args: string[]) {
  return spawnSync(process.execPath, [tsxCliPath, validateCliPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" }
  });
}

function allJourneyReviewables(catalog: ReturnType<typeof loadCatalog>) {
  return [
    ...catalog.journey.options,
    ...catalog.journey.knowledge,
    ...catalog.journey.practice.phrases,
    ...catalog.journey.practice.responses,
    ...catalog.journey.practice.partnerResponses,
    ...catalog.journey.practice.safetyBranches,
    ...catalog.journey.practice.supportResources,
    ...catalog.journey.uiCopy.behaviorMapPoints,
    ...catalog.journey.uiCopy.attitudes,
    ...catalog.journey.uiCopy.communicationSections
  ];
}

function completeInternalReviewForTest(catalog: ReturnType<typeof loadCatalog>) {
  for (const item of allJourneyReviewables(catalog)) {
    if (item.reviewStatus === "draft") {
      Object.assign(item, {
        reviewStatus: "reviewed",
        reviewer: "annie",
        reviewerRole: "产品与编辑审核人",
        reviewedAt: "2026-08-28T09:56:30Z",
        reviewedVersion: "2026-08-28-review-1",
        reviewConclusion: "产品与编辑审核通过"
      });
    } else if (item.reviewStatus === "expert_review_pending") {
      Object.assign(item, {
        reviewStatus: "internal_test_approved",
        reviewer: "annie",
        reviewerRole: "内部测试审核人",
        reviewedAt: "2026-08-28T09:56:30Z",
        reviewedVersion: "2026-08-28-review-1",
        reviewConclusion: "仅内测通过；发布前仍需合格专家完成医疗、安全或性教育审核"
      });
    }
  }
}

describe("versioned content validation", () => {
  it.each([
    ["missing", []],
    ["unsupported", ["--mode", "staging"]]
  ] as const)("rejects a %s CLI validation mode", (_label, args) => {
    const result = runValidateCli([...args]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "--mode must be exactly one of: draft, internal, production"
    );
  });

  it("accepts an exact CLI validation mode", () => {
    const result = runValidateCli(["--mode", "draft"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("content validation passed (draft)");
  });

  it("uses the CAVE course identity and lesson back-reference", () => {
    const catalog = loadCatalog();

    expect(catalog.courses.map((course) => course.id)).toEqual(["cave-basics"]);
    expect(catalog.lessons.map((lesson) => lesson.courseId)).toEqual([
      "cave-basics"
    ]);
  });

  it("accepts the checked-in catalog in draft mode", () => {
    expect(() => validateCatalog(loadCatalog(), { mode: "draft" })).not.toThrow();
  });

  it("accepts complete internal approval internally but rejects it in production", () => {
    const catalog = loadCatalog();
    completeInternalReviewForTest(catalog);
    const approvalStatuses = allJourneyReviewables(catalog).map(
      ({ reviewStatus }) => reviewStatus
    );
    completeInternalReviewForTest(catalog);

    expect(allJourneyReviewables(catalog).map(({ reviewStatus }) => reviewStatus)).toEqual(
      approvalStatuses
    );
    expect(() => validateCatalog(catalog, { mode: "internal" })).not.toThrow();
    expect(new Set(issueCodes(() => validateCatalog(catalog, { mode: "production" })))).toEqual(
      new Set(["INTERNAL_TEST_APPROVAL_ONLY"])
    );
  });

  it.each([
    ["reviewed", "产品与编辑审核人"],
    ["internal_test_approved", "内部测试审核人"]
  ] as const)("requires complete evidence for %s status even in draft mode", (reviewStatus, reviewerRole) => {
    const catalog = loadCatalog();
    Object.assign(catalog.journey.knowledge[0]!, {
      reviewStatus,
      reviewer: "annie",
      reviewerRole,
      reviewedAt: "2026-08-28T09:56:30Z",
      reviewedVersion: "2026-08-28-review-1"
    });
    delete catalog.journey.knowledge[0]!.reviewConclusion;

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "REVIEW_EVIDENCE_REQUIRED"
    );
  });

  it.each([
    ["draft", "DRAFT_CONTENT"],
    ["expert_review_pending", "EXPERT_REVIEW_PENDING"],
    ["revision_required", "REVISION_REQUIRED"]
  ] as const)("rejects %s journey content in internal mode", (reviewStatus, expectedCode) => {
    const catalog = loadCatalog();
    Object.assign(catalog.journey.knowledge[0]!, { reviewStatus });

    expect(issueCodes(() => validateCatalog(catalog, { mode: "internal" }))).toContain(
      expectedCode
    );
  });

  it("rejects legacy draft content in internal mode", () => {
    const catalog = loadCatalog();
    catalog.courses[0]!.reviewStatus = "draft";
    delete catalog.courses[0]!.reviewedAt;

    expect(issueCodes(() => validateCatalog(catalog, { mode: "internal" }))).toContain(
      "DRAFT_CONTENT"
    );
  });

  it("keeps seven legacy reviewed entries while rejecting seven-screen pending copy in production", () => {
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
          entry.reviewedAt === "2026-08-27T05:51:49Z"
      )
    ).toBe(true);
    const productionIssues = validationIssues(() =>
      validateCatalog(catalog, { mode: "production" })
    );

    expect(productionIssues.length).toBeGreaterThan(0);
    expect(new Set(productionIssues.map(({ code }) => code))).toEqual(
      new Set(["DRAFT_CONTENT", "EXPERT_REVIEW_PENDING"])
    );
    expect(productionIssues.every(({ path }) => path.startsWith("journey."))).toBe(
      true
    );
    expect(productionIssues.some(({ path }) => path.startsWith("journey.sources"))).toBe(false);
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

  it("rejects an unresolved source on any journey option", () => {
    const catalog = loadCatalog();
    const concern = catalog.journey.options.find(({ group }) => group === "concern")!;
    concern.sourceIds = ["missing-source"];

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "MISSING_SOURCE"
    );
  });

  it.each([
    ["practice copy assigned to the wrong page", (catalog: ReturnType<typeof loadCatalog>) => {
      catalog.journey.practice.phrases[0]!.page = 5;
    }, "INVALID_PAGE_OWNERSHIP"],
    ["duplicate attitude values", (catalog: ReturnType<typeof loadCatalog>) => {
      catalog.journey.uiCopy.attitudes[1]!.value = "expecting";
    }, "INCOMPLETE_SEVEN_SCREEN_CATALOG"],
    ["duplicate support numbers", (catalog: ReturnType<typeof loadCatalog>) => {
      catalog.journey.practice.supportResources[1]!.number = "110";
    }, "INCOMPLETE_SEVEN_SCREEN_CATALOG"]
  ] as const)("rejects %s", (_label, mutate, expectedCode) => {
    const catalog = loadCatalog();
    mutate(catalog);

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      expectedCode
    );
  });

  it("rejects review evidence on copy that is not reviewed", () => {
    const catalog = loadCatalog();
    catalog.journey.knowledge[0]!.reviewer = "Unapproved reviewer";

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "UNEXPECTED_REVIEW_EVIDENCE"
    );
  });

  it("keeps source verification independent from copy approval", () => {
    const catalog = loadCatalog();
    catalog.journey.sources[0]!.verificationStatus = "revision_required";

    const draftCodes = issueCodes(() => validateCatalog(catalog, { mode: "draft" }));
    const productionCodes = issueCodes(() => validateCatalog(catalog, { mode: "production" }));
    expect(draftCodes).not.toContain("SOURCE_REVISION_REQUIRED");
    expect(productionCodes).toContain("SOURCE_REVISION_REQUIRED");
  });

  it.each([
    ["id", "SRC-099"],
    ["sourceType", "SAFE"],
    ["title", "Changed title"],
    ["organization", "Changed organization"],
    ["url", "https://www.who.int/changed"],
    ["appliesTo", "Changed applicability"],
    ["publicationOrReviewDate", "Changed date"],
    ["accessedAt", "2026-08-26"],
    ["verificationStatus", "revision_required"]
  ] as const)("rejects source-registry drift in %s", (field, value) => {
    const catalog = loadCatalog();
    Object.assign(catalog.journey.sources[0]!, { [field]: value });

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "INVALID_SOURCE_REGISTRY"
    );
  });

  it("requires all three approved disappointed-response options in order", () => {
    const catalog = loadCatalog();
    const branch = catalog.journey.practice.safetyBranches.find(
      ({ branch }) => branch === "disappointed-but-stops"
    )!;
    branch.userTexts = branch.userTexts.slice(0, 2);

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "INVALID_PRACTICE_CATALOG"
    );
  });

  it.each([
    ["duplicate response branch", (catalog: ReturnType<typeof loadCatalog>) => {
      catalog.journey.practice.responses[1]!.branch = catalog.journey.practice.responses[0]!.branch;
    }],
    ["unsafe terminal response", (catalog: ReturnType<typeof loadCatalog>) => {
      catalog.journey.practice.responses.find(({ branch }) => branch === "ignores-pause")!.safeTerminal = false;
    }]
  ])("rejects %s in the preset practice catalog", (_label, mutate) => {
    const catalog = loadCatalog();
    mutate(catalog);

    expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" }))).toContain(
      "INVALID_PRACTICE_CATALOG"
    );
  });
});
