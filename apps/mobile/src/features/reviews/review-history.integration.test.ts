declare const __dirname: string;

const { readFileSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
const { resolve } = jest.requireActual<typeof import("node:path")>("node:path");

const source = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

test("keeps review payloads out of list queries and raw SQL out of routes", () => {
  const repository = source("infrastructure/sql-review-history-repository.ts");
  const listQuery = "SELECT id, root_id, parent_version_id, title, review_date, status, created_at FROM journey_review_versions ORDER BY review_date DESC, created_at DESC";
  expect(repository).toContain(listQuery);
  expect(listQuery).not.toContain("payload");

  const routes = ["../../../app/(tabs)/reviews.tsx", "../../../app/reviews/[id].tsx"]
    .map(source).join("\n");
  expect(routes).not.toMatch(/SELECT\s|INSERT\s|UPDATE\s|DELETE\s+FROM|fetch\(|axios|openai|anthropic/iu);
});

test("wires history detail, branching, deletion, and one active replacement", () => {
  const hub = source("../../../app/(tabs)/reviews.tsx");
  const detail = source("../../../app/reviews/[id].tsx");
  expect(hub).toContain("reviewHistory.listMetadata()");
  expect(hub).toContain("replaceActiveReview()");
  expect(detail).toContain("reviewHistory.loadDetail(id)");
  expect(detail).toContain("reviewHistory.loadBranchSeed(detail.id)");
  expect(detail).toContain("reviewHistory.deleteVersion(reviewId)");
});
