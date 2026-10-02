import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { activeVersion, pendingMigrations, uploadedVersion, validateHealth, validateStagingEvidence, validateStagingRun } from "../scripts/gateway-release.mjs";

const sha = "a".repeat(40);
const versionId = "11111111-1111-1111-1111-111111111111";
const repository = "CarterWells111/CAVE";
const run = { repository: { full_name: repository }, path: ".github/workflows/ci.yml", event: "push", head_branch: "main", status: "completed", conclusion: "success", head_sha: sha };
const jobs = [{ name: "foundation", conclusion: "success" }, { name: "deploy-staging", conclusion: "success" }];
const evidence = { environment: "staging", sha, runId: "123", repository, smokePassed: true, versionId, versionTag: sha };

describe("production promotion safety", () => {
  it("stops without a deployment credential before invoking any remote operation", () => {
    const root = fileURLToPath(new URL("../", import.meta.url));
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
    for (const environment of ["staging", "production"]) {
      const result = spawnSync(process.execPath, ["scripts/gateway-release.mjs", "deploy", environment], {
        cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main", RELEASE_SHA: head, CLOUDFLARE_API_TOKEN: "" }
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Configure the environment's CLOUDFLARE_API_TOKEN Secret");
      expect(result.stdout).toBe("");
    }
  });
  it("accepts only a successful main CI run with a successful staging deployment", () => {
    expect(validateStagingRun(run, jobs, repository)).toBe(sha);
    for (const patch of [{ event: "pull_request" }, { event: "workflow_dispatch" }, { head_branch: "feature" }, { conclusion: "failure" }, { status: "in_progress" }, { path: ".github/workflows/other.yml" }, { head_sha: "main" }, { repository: { full_name: "other/repo" } }]) {
      expect(() => validateStagingRun({ ...run, ...patch }, jobs, repository)).toThrow();
    }
    for (const conclusion of ["skipped", "failure", "cancelled"]) {
      expect(() => validateStagingRun(run, [jobs[0], { ...jobs[1], conclusion }], repository)).toThrow();
    }
    expect(() => validateStagingRun(run, [jobs[1]], repository)).toThrow();
  });
  it("rejects mismatched or incomplete evidence instead of deploying the latest main", () => {
    expect(() => validateStagingEvidence(evidence, sha, "123", repository)).not.toThrow();
    for (const patch of [{ environment: "production" }, { sha: "b".repeat(40) }, { runId: "124" }, { repository: "other/repo" }, { smokePassed: false }, { versionTag: "b".repeat(40) }, { versionId: "invalid" }]) {
      expect(() => validateStagingEvidence({ ...evidence, ...patch }, sha, "123", repository)).toThrow();
    }
  });
  it("identifies the current version and rejects traffic split across versions", () => {
    const latest = { created_on: "2026-10-02T10:00:00Z", versions: [{ version_id: versionId, percentage: 100 }] };
    expect(activeVersion([{ ...latest, created_on: "2026-10-01T10:00:00Z" }, latest])).toBe(versionId);
    expect(() => activeVersion([{ ...latest, versions: [{ version_id: versionId, percentage: 50 }] }])).toThrow();
    expect(() => activeVersion([])).toThrow();
  });
  it("selects an uploaded version by the accepted SHA rather than blindly taking the latest", () => {
    const version = { id: versionId, annotations: { "workers/tag": sha }, metadata: { created_on: "2026-10-02T10:00:00Z" } };
    const other = { ...version, annotations: { "workers/tag": "b".repeat(40) }, metadata: { created_on: "2026-10-02T11:00:00Z" } };
    expect(uploadedVersion([other, version], sha)).toBe(versionId);
    expect(() => uploadedVersion([other], sha)).toThrow();
  });
  it("detects unapplied production migrations and refuses invalid query results", () => {
    const query = [{ success: true, results: [{ name: "0001_auth.sql" }] }];
    expect(pendingMigrations(["0001_auth.sql", "0002_preferences.sql", "README.md"], query)).toEqual(["0002_preferences.sql"]);
    expect(() => pendingMigrations([], [{ success: false, results: [] }])).toThrow();
  });
  it("checks the expected model and prompt versions, not just HTTP availability", () => {
    const vars = { MODEL_NAME: "model", PROMPT_VERSION: "prompt", POLICY_VERSION: "policy" };
    const meta = { contractVersion: "1", providerMode: "live", modelName: "model", promptVersion: "prompt", policyVersion: "policy" };
    expect(() => validateHealth({ contractVersion: "1", status: "ok" }, meta, vars)).not.toThrow();
    expect(() => validateHealth({ contractVersion: "1", status: "ok" }, { ...meta, providerMode: "mock" }, vars)).toThrow();
    expect(() => validateHealth({ contractVersion: "1", status: "ok" }, { ...meta, promptVersion: "old" }, vars)).toThrow();
  });
});

describe("deployment workflow boundaries", () => {
  const ci = parse(readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"));
  const production = parse(readFileSync(new URL("../.github/workflows/deploy-production.yml", import.meta.url), "utf8"));
  it("deploys staging only after foundation passes on a main push", () => {
    const staging = ci.jobs["deploy-staging"];
    expect(staging.needs).toBe("foundation");
    expect(staging.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(staging.environment.name).toBe("staging");
    expect(staging.steps.find((step: { name?: string }) => step.name === "Publish staging").run).toBe("node scripts/gateway-release.mjs deploy staging");
    expect(ci.concurrency["cancel-in-progress"]).toContain("github.ref != 'refs/heads/main'");
  });
  it("requires a manual candidate, a passing production gate, and environment approval", () => {
    expect(Object.keys(production.on)).toEqual(["workflow_dispatch"]);
    expect(production.on.workflow_dispatch.inputs.apply_migrations.default).toBe(false);
    expect(production.jobs["validate-release"].if).toBe("github.ref == 'refs/heads/main'");
    expect(production.jobs["validate-release"].steps.some((step: { run?: string }) => step.run === "pnpm verify:release")).toBe(true);
    const deployment = production.jobs["deploy-production"];
    expect(deployment.needs).toBe("validate-release");
    expect(deployment.environment.name).toBe("production");
    expect(deployment.steps[0].with.ref).toBe("${{ needs.validate-release.outputs.sha }}");
    expect(production.concurrency["cancel-in-progress"]).toBe(false);
  });
});
