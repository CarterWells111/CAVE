import { loadJourneyContentCatalog } from "./journey-content-catalog";

test("loads versioned draft catalogs locally with resolvable source ids", () => {
  const catalog = loadJourneyContentCatalog();
  const sourceIds = new Set(catalog.sources.map(({ id }) => id));

  expect(catalog.knowledge).toHaveLength(3);
  expect(catalog.uiCopy.bodyKnowledgeDefinition.examples).toHaveLength(4);
  expect(catalog.uiCopy.bodyKnowledgeDefinition.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
  expect(catalog.practice.scripted).toBe(true);
  expect(catalog.knowledge.every((entry) => entry.sourceIds.every((id) => sourceIds.has(id)))).toBe(true);
});
