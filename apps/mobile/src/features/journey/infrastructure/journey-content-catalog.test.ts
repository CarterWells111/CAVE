import { loadJourneyContentCatalog } from "./journey-content-catalog";

test("loads the source-free mobile journey catalog without third-party URLs", () => {
  const catalog = loadJourneyContentCatalog();

  expect(catalog.knowledge).toHaveLength(3);
  expect(catalog.uiCopy.bodyKnowledgeDefinition.examples).toHaveLength(4);
  expect(catalog.practice.scripted).toBe(true);
  expect(catalog).not.toHaveProperty("sources");
  expect(JSON.stringify(catalog)).not.toMatch(/https?:\/\//u);
});
