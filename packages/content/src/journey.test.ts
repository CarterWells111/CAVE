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

  it("passes draft validation while production reports genuine pending review", () => {
    expect(() => validateCatalog(loadCatalog(), { mode: "draft" })).not.toThrow();
    expect(productionIssueCodes()).toContain("DRAFT_CONTENT");
    expect(loadCatalog().journey.options.some(({ reviewedAt }) => reviewedAt !== undefined)).toBe(false);
  });
});
