import { describe, expect, it } from "vitest";

import { loadCatalog } from "./load";
import { validateCatalog } from "./validate";

describe("reviewed seven-screen journey catalogs", () => {
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
      journey.uiCopy.bodyKnowledgeDefinition,
      ...journey.uiCopy.behaviorMapPoints,
      ...journey.uiCopy.attitudes,
      ...journey.uiCopy.communicationSections
    ];
    const reviewed = reviewables.filter(({ reviewStatus }) => reviewStatus === "reviewed");
    const internalTestApproved = reviewables.filter(
      ({ reviewStatus }) => reviewStatus === "internal_test_approved"
    );
    const formallyReviewedContentTypes = new Set(["MED", "EDU", "REVIEW"]);
    const formallyReviewedUxIds = new Set([
      "behavior-oral-genital-contact",
      "draft-penetrative-sex"
    ]);

    expect(reviewables).toHaveLength(92);
    expect(reviewed).toHaveLength(92);
    expect(internalTestApproved).toHaveLength(0);
    for (const entry of reviewables) {
      const completedFormalReview =
        formallyReviewedContentTypes.has(entry.contentType) || formallyReviewedUxIds.has(entry.id);
      expect(entry, entry.id).toMatchObject(
        completedFormalReview
          ? {
              reviewStatus: "reviewed",
              reviewer: "annie",
              reviewerRole: "正式内容审核人（用户确认）",
              reviewedAt: "2026-10-04T21:15:10Z",
              reviewedVersion: "main-3130fbc",
              reviewConclusion: "正式内容审核通过；用户确认审核人及内容与原记录一致"
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

  it.each(["draft", "internal", "production"] as const)("passes %s validation with completed formal reviews", (mode) => {
    expect(() => validateCatalog(loadCatalog(), { mode })).not.toThrow();
  });
});
