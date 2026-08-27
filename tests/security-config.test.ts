import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json";

describe("repository security configuration", () => {
  it("defines the fixed security scripts", () => {
    expect(packageJson.scripts["test:safety"]).toBe(
      "pnpm --filter @cave/gateway test:safety"
    );
    expect(packageJson.scripts["security:audit"]).toBe("pnpm audit --prod");
    expect(packageJson.scripts["security:scan-bundle"]).toBe(
      "node scripts/scan-bundle-secrets.mjs"
    );
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
