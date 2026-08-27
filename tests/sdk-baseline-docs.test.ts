import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

const activeDocuments = [
  "README.md",
  "docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md",
  "docs/superpowers/plans/2026-08-26-01-repository-infrastructure-ios-build.md",
  "docs/superpowers/plans/2026-08-26-05-mobile-mvp-integration.md",
  "docs/superpowers/plans/2026-08-27-cave-product-identity-migration.md"
] as const;

function readDocument(path: string) {
  return readFileSync(resolve(workspaceRoot, path), "utf8");
}

describe("Expo SDK documentation baseline", () => {
  it.each(activeDocuments)("uses SDK 54 in the active header of %s", (path) => {
    const activeHeader = readDocument(path)
      .split(/\r?\n/u)
      .slice(0, 30)
      .join("\n");

    expect(activeHeader).toContain("Expo SDK 54");
    expect(activeHeader).not.toContain("Expo SDK 57");
  });

  it("records that the SDK 54 decision superseded the SDK 57 baseline", () => {
    const masterRoadmap = readDocument(
      "docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md"
    );

    expect(masterRoadmap).toContain(
      "SDK 57 baseline was superseded by the user-authorized Expo SDK 54 decision"
    );
  });

  it("keeps Gate 02B aligned with the completed content-owner review", () => {
    const identityMigrationPlan = readDocument(
      "docs/superpowers/plans/2026-08-27-cave-product-identity-migration.md"
    );

    expect(identityMigrationPlan).not.toContain("content_review_pending");
    expect(identityMigrationPlan).toContain(
      "Gate 02B: is `pass` after the 2026-08-27 content-owner review"
    );
  });
});
