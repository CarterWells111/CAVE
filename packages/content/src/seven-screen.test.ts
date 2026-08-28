import { describe, expect, it } from "vitest";

import { loadCatalog } from "./load";
import { JOURNEY_SOURCE_REGISTRY } from "./source-registry";
import { ContentValidationError, validateCatalog } from "./validate";

function issuesFor(input: unknown, mode: "draft" | "production" = "draft") {
  try {
    validateCatalog(input, { mode });
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(ContentValidationError);
    return (error as ContentValidationError).issues;
  }
}

describe("seven-screen content and source model", () => {
  it("registers SRC-001 through SRC-014 with authoritative metadata and no placeholder URLs", () => {
    const sources = loadCatalog().journey.sources;

    expect(sources).toEqual(JOURNEY_SOURCE_REGISTRY);
    expect(sources.map(({ id }) => id)).toEqual(
      Array.from({ length: 14 }, (_, index) => `SRC-${String(index + 1).padStart(3, "0")}`)
    );
    expect(sources.every(({ verificationStatus }) => verificationStatus === "source_verified")).toBe(true);
    expect(sources.every(({ organization, appliesTo, accessedAt }) => (
      organization.length > 0
      && appliesTo.length > 0
      && /^\d{4}-\d{2}-\d{2}$/u.test(accessedAt)
    ))).toBe(true);
    expect(JSON.stringify(sources)).not.toContain("example.invalid");
  });

  it("keeps source verification separate from expert copy review", () => {
    const { journey } = loadCatalog();
    const sourceIds = new Set(journey.sources.map(({ id }) => id));
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

    expect(reviewables.every(({ page }) => Number.isInteger(page) && page >= 1 && page <= 7)).toBe(true);
    expect(reviewables.every(({ contentType }) => ["MED", "EDU", "UX", "REVIEW"].includes(contentType))).toBe(true);
    expect(reviewables.filter(({ reviewStatus }) => reviewStatus === "reviewed")).toHaveLength(56);
    expect(
      reviewables.filter(({ reviewStatus }) => reviewStatus === "internal_test_approved")
    ).toHaveLength(36);
    expect(
      reviewables.every(({ reviewedAt }) => reviewedAt === "2026-08-28T09:56:30Z")
    ).toBe(true);

    for (const item of reviewables) {
      expect(item.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
      if (item.contentType === "MED" || item.contentType === "EDU" || item.contentType === "REVIEW") {
        expect(item.sourceIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("contains every approved finite collection without ranking the six attitudes", () => {
    const { journey } = loadCatalog();

    expect(journey.uiCopy.behaviorMapPoints.map(({ id }) => id)).toEqual([
      "behavior-map-hug",
      "behavior-map-kissing",
      "behavior-map-same-bed",
      "behavior-map-my-nudity",
      "behavior-map-partner-nudity",
      "behavior-map-over-clothes-touch",
      "behavior-map-direct-touch",
      "behavior-map-more",
      "behavior-map-custom"
    ]);
    expect(journey.uiCopy.attitudes.map(({ value }) => value)).toEqual([
      "expecting",
      "familiar-enjoyed",
      "decide-in-moment",
      "unsure",
      "not-this-time",
      "skip"
    ]);
    expect(JSON.stringify(journey.uiCopy.attitudes)).not.toMatch(/"(?:rank|level|score|weight)"/u);
    expect(journey.practice.phrases.map(({ intent }) => intent)).toEqual([
      "slow-down",
      "adjust-touch",
      "pause-and-decide",
      "stop-current-action",
      "choose-another-closeness",
      "pause-to-feel"
    ]);
    expect(journey.practice.partnerResponses).toHaveLength(6);
    expect(journey.practice.safetyBranches.some(({ safeTerminal }) => safeTerminal)).toBe(true);
    expect(
      journey.practice.safetyBranches.find(({ branch }) => branch === "disappointed-but-stops")
        ?.userTexts
    ).toEqual([
      "刚才愿意，不代表我现在也愿意。我想先停下来。",
      "我知道你可能失望，但我现在不想继续。",
      "我现在不想解释，请先给我一点空间。"
    ]);
    expect(journey.practice.supportResources.map(({ number }) => number)).toEqual([
      "110",
      "120",
      "12338",
      "12348"
    ]);
    expect(journey.uiCopy.communicationSections.map(({ id }) => id)).toEqual([
      "communication-night-expectations",
      "communication-possible-closeness",
      "communication-decide-in-moment",
      "communication-not-this-time",
      "communication-comfort",
      "communication-changed-feelings",
      "communication-mutual-boundaries"
    ]);
  });

  it("requires complete real evidence before any copy can be marked reviewed", () => {
    const catalog = loadCatalog();
    const copy = catalog.journey.knowledge[0]! as Record<string, unknown>;
    copy.reviewStatus = "reviewed";
    delete copy.reviewer;
    delete copy.reviewerRole;
    delete copy.reviewedAt;
    delete copy.reviewedVersion;
    delete copy.reviewConclusion;

    expect(issuesFor(catalog).map(({ code }) => code)).toContain("REVIEW_EVIDENCE_REQUIRED");

    copy.reviewer = "Content reviewer";
    copy.reviewerRole = "medical reviewer";
    copy.reviewedAt = "2026-08-27T12:00:00Z";
    copy.reviewedVersion = "seven-screen-v1";
    copy.reviewConclusion = "approved";

    expect(issuesFor(catalog).filter(({ path }) => path.includes(String(copy.id)))).toEqual([]);
  });

  it("passes draft validation while production blocks all internal-only approvals", () => {
    const catalog = loadCatalog();

    expect(() => validateCatalog(catalog, { mode: "draft" })).not.toThrow();
    const productionIssues = issuesFor(catalog, "production");
    expect(productionIssues).toHaveLength(36);
    expect(new Set(productionIssues.map(({ code }) => code))).toEqual(
      new Set(["INTERNAL_TEST_APPROVAL_ONLY"])
    );
    expect(productionIssues.some(({ path }) => path.startsWith("journey.sources"))).toBe(false);
  });
});
