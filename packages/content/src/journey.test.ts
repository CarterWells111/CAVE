import { describe, expect, it } from "vitest";

import { loadCatalog } from "./load";
import { ContentValidationError, validateCatalog } from "./validate";

function productionIssueCodes() {
  try {
    validateCatalog(loadCatalog(), { mode: "production" });
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(ContentValidationError);
    return (error as ContentValidationError).issues.map(({ code }) => code);
  }
}

describe("draft seven-screen journey catalogs", () => {
  it("records the approved review evidence for every journey reviewable", () => {
    const { journey } = loadCatalog();
    const reviewables = [
      ...journey.options,
      ...journey.knowledge,
      ...journey.practice.phrases,
      ...journey.practice.responses,
      ...journey.practice.partnerResponses,
      ...journey.practice.safetyBranches,
      ...journey.practice.supportResources,
      ...journey.uiCopy.behaviorMapPoints,
      ...journey.uiCopy.attitudes,
      ...journey.uiCopy.communicationSections
    ];
    const reviewed = reviewables.filter(({ reviewStatus }) => reviewStatus === "reviewed");
    const internalTestApproved = reviewables.filter(
      ({ reviewStatus }) => reviewStatus === "internal_test_approved"
    );
    const internalOnlyContentTypes = new Set(["MED", "EDU", "REVIEW"]);
    const internalOnlyUxIds = new Set([
      "behavior-oral-genital-contact",
      "draft-penetrative-sex"
    ]);

    expect(reviewables).toHaveLength(90);
    expect(reviewed).toHaveLength(56);
    expect(internalTestApproved).toHaveLength(34);
    for (const entry of reviewables) {
      const requiresInternalApproval =
        internalOnlyContentTypes.has(entry.contentType) || internalOnlyUxIds.has(entry.id);
      expect(entry, entry.id).toMatchObject(
        requiresInternalApproval
          ? {
              reviewStatus: "internal_test_approved",
              reviewer: "annie",
              reviewerRole: "内部测试审核人",
              reviewedAt: "2026-08-28T09:56:30Z",
              reviewedVersion: "2026-08-28-review-1",
              reviewConclusion: "仅内测通过；发布前仍需合格专家完成医疗、安全或性教育审核"
            }
          : {
              reviewStatus: "reviewed",
              reviewer: "annie",
              reviewerRole: "产品与编辑审核人",
              reviewedAt: "2026-08-28T09:56:30Z",
              reviewedVersion: "2026-08-28-review-1",
              reviewConclusion: "产品与编辑审核通过"
            }
      );
    }
  });

  it("loads all four versioned local catalogs with explicit unique ordering", () => {
    const { journey } = loadCatalog();

    expect(journey.options.length).toBeGreaterThan(0);
    expect(journey.knowledge.length).toBe(3);
    expect(journey.practice.scripted).toBe(true);
    expect(journey.sources.length).toBeGreaterThan(0);
    for (const items of [journey.options, journey.knowledge, journey.practice.phrases]) {
      expect(new Set(items.map(({ id }) => id)).size).toBe(items.length);
      expect(new Set(items.map(({ order }) => order)).size).toBe(items.length);
    }
  });

  it("resolves every source id and keeps sourced knowledge plus health options", () => {
    const { journey } = loadCatalog();
    const sourceIds = new Set(journey.sources.map(({ id }) => id));
    const sourcedEntries = [
      ...journey.knowledge,
      ...journey.options.filter(({ group }) => group === "health")
    ];

    expect(sourcedEntries.length).toBeGreaterThan(0);
    for (const entry of sourcedEntries) {
      expect(entry.sourceIds.length).toBeGreaterThan(0);
      expect(entry.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
    }
  });

  it("contains no behavior ranking fields and marks every practice response as scripted", () => {
    const { journey } = loadCatalog();
    const behaviors = journey.options.filter(({ group }) => group === "behavior");

    expect(JSON.stringify(behaviors)).not.toMatch(/"(?:level|rank|progress)"/u);
    expect(journey.practice.responses.every(({ scripted }) => scripted)).toBe(true);
  });

  it("passes internal validation while production keeps internal-only approvals blocked", () => {
    expect(() => validateCatalog(loadCatalog(), { mode: "draft" })).not.toThrow();
    expect(() => validateCatalog(loadCatalog(), { mode: "internal" })).not.toThrow();

    const issueCodes = productionIssueCodes();
    expect(issueCodes).toHaveLength(34);
    expect(issueCodes.every((code) => code === "INTERNAL_TEST_APPROVAL_ONLY")).toBe(true);
    expect(issueCodes).not.toContain("DRAFT_CONTENT");
    expect(issueCodes).not.toContain("EXPERT_REVIEW_PENDING");
  });
});
