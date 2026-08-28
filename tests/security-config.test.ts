import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import packageJson from "../package.json";
import mobilePackageJson from "../apps/mobile/package.json";

function expectAuditedAllowBuilds(workspace: string) {
  const parsed = parse(workspace) as { allowBuilds?: unknown };
  expect(parsed.allowBuilds).toEqual({
    esbuild: true,
    "unrs-resolver": true,
    workerd: true,
  });
}

describe("repository security configuration", () => {
  it("defines the fixed security scripts", () => {
    expect(packageJson.scripts["test:safety"]).toBe(
      "pnpm --filter @cave/gateway test:safety"
    );
    expect(packageJson.scripts["security:audit"]).toBe(
      "pnpm audit --prod --audit-level high"
    );
    expect(packageJson.scripts["security:scan-bundle"]).toBe(
      "node scripts/scan-bundle-secrets.mjs"
    );
  });

  it("declares the Expo font peer dependency directly", () => {
    expect(mobilePackageJson.dependencies["expo-font"]).toBe("~14.0.12");
  });

  it("pins patched build dependencies and narrowly allowlists patched advisories", () => {
    const workspace = readFileSync(
      new URL("../pnpm-workspace.yaml", import.meta.url),
      "utf8"
    );
    const imageSizePatch = readFileSync(
      new URL("../patches/image-size@1.2.1.patch", import.meta.url),
      "utf8"
    );

    expect(workspace).toContain('postcss: "8.5.26"');
    expect(workspace).toContain('image-size@1.2.1: "patches/image-size@1.2.1.patch"');
    expect(workspace).toContain("GHSA-w3rx-r6r6-pgpr");
    expect(workspace).toContain("GHSA-5p2g-fcmc-qvqq");
    expect(workspace).not.toContain("ignoreUnfixable");
    expect(imageSizePatch).toContain("box.size <= 0");
    expect(imageSizePatch).toContain("imageHeader[1] <= 0");
  });

  it("allows only the three audited native postinstall packages with exact booleans", () => {
    const workspace = readFileSync(
      new URL("../pnpm-workspace.yaml", import.meta.url),
      "utf8"
    );

    expectAuditedAllowBuilds(workspace);
  });

  it("rejects a fourth postinstall allowlist entry", () => {
    const workspace = readFileSync(
      new URL("../pnpm-workspace.yaml", import.meta.url),
      "utf8"
    );
    const withExtraEntry = workspace.replace("  workerd: true", "  workerd: true\n  unexpected-package: true");
    expect(() => expectAuditedAllowBuilds(withExtraEntry)).toThrow();
  });

  it("runs JavaScript and TypeScript CodeQL analysis", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/codeql.yml", import.meta.url),
      "utf8"
    );

    expect(workflow).toContain("github/codeql-action/init@v4");
    expect(workflow).toContain("languages: javascript-typescript");
    expect(workflow).toContain("github/codeql-action/analyze@v4");
    expect(workflow).toContain("actions: read");
  });

  it("checks npm and GitHub Actions dependencies weekly", () => {
    const dependabot = readFileSync(
      new URL("../.github/dependabot.yml", import.meta.url),
      "utf8"
    );

    expect(dependabot).toContain('package-ecosystem: "npm"');
    expect(dependabot).toContain('package-ecosystem: "github-actions"');
    expect(dependabot.match(/interval: "weekly"/gu)).toHaveLength(2);
    expect(dependabot.match(/open-pull-requests-limit: 5/gu)).toHaveLength(2);
  });

  it("tracks generated Worker binding types for both rate limiters", () => {
    const generated = readFileSync(
      new URL(
        "../apps/gateway/src/worker-configuration.d.ts",
        import.meta.url
      ),
      "utf8"
    );

    expect(generated).toContain("TURN_RATE_LIMITER: RateLimit");
    expect(generated).toContain("DEBRIEF_RATE_LIMITER: RateLimit");
  });
});
