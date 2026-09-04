import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";

const repo = fileURLToPath(new URL("..", import.meta.url));
const launcher = new URL("../scripts/security-audit.mjs", import.meta.url);
const temporary: string[] = [];
const servers: Server[] = [];
const exemptGhsa = "GHSA-w3rx-r6r6-pgpr";

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((done) => {
    server.closeAllConnections();
    server.close(() => done());
  })));
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function fixture(ignoreGhsas: string[] = []) {
  const cwd = mkdtempSync(join(tmpdir(), "cave-audit-"));
  temporary.push(cwd);
  const dependency = (version: string) => ({ specifier: version, version });
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "audit-fixture", private: true, packageManager: "pnpm@10.34.5" }));
  writeFileSync(join(cwd, "pnpm-workspace.yaml"), stringify({ packages: ["packages/*"], auditConfig: { ignoreGhsas } }));
  mkdirSync(join(cwd, "packages/shared"), { recursive: true });
  writeFileSync(join(cwd, "packages/shared/package.json"), JSON.stringify({ name: "shared", version: "1.0.0", private: true }));
  const names = ["audit-prod", "audit-transitive", "@audit/optional", "audit-dev-only", "audit-linked"];
  writeFileSync(join(cwd, "pnpm-lock.yaml"), stringify({
    lockfileVersion: "9.0",
    settings: { autoInstallPeers: true, excludeLinksFromLockfile: false },
    importers: {
      ".": {
        dependencies: { "audit-prod": dependency("1.0.0"), shared: dependency("link:packages/shared") },
        optionalDependencies: { "@audit/optional": dependency("1.0.0") },
        devDependencies: { "audit-dev-only": dependency("1.0.0") },
      },
      "packages/shared": { dependencies: { "audit-linked": dependency("1.0.0") } },
    },
    packages: Object.fromEntries(names.map((name) => [`${name}@1.0.0`, { resolution: { integrity: "sha512-fixture" } }])),
    snapshots: Object.fromEntries(names.map((name) => [`${name}@1.0.0`, name === "audit-prod" ? { dependencies: { "audit-transitive": "1.0.0" } } : {}])),
  }));
  return cwd;
}

async function registry(body: unknown, status = 200) {
  const requests: { url: string; method: string; body: Record<string, string[]> }[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push({ url: request.url!, method: request.method!, body: JSON.parse(Buffer.concat(chunks).toString() || "{}") });
    if (request.method === "GET") {
      const name = decodeURIComponent(request.url!.slice(1));
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ name, "dist-tags": { latest: "2.0.0" }, versions: { "1.0.0": { name, version: "1.0.0" }, "2.0.0": { name, version: "2.0.0" } } }));
      return;
    }
    if (status === 0) return; // Simulate a registry that accepts the request but never responds.
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(typeof body === "string" ? body : JSON.stringify(body));
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server");
  return { url: `http://127.0.0.1:${address.port}/`, requests };
}

async function audit(cwd: string, url: string) {
  expect(existsSync(launcher), "audit launcher must replace the retired endpoint").toBe(true);
  const { runAudit } = await import(launcher.href);
  const log = join(cwd, "audit-output.log");
  const descriptor = openSync(log, "w");
  let code: number;
  try {
    code = await runAudit(cwd, {
    stdio: ["ignore", descriptor, descriptor],
    env: {
      ...process.env,
      CI: "true",
      pnpm_config_registry: url,
      pnpm_config_fetch_retries: "0",
      pnpm_config_fetch_timeout: "1000",
      // pnpm 10 lifecycle variables must not force the dedicated CLI back to v10.
      PNPM_PACKAGE_MANAGER_BINARY: "must-not-be-invoked",
    },
    });
  } finally { closeSync(descriptor); }
  return { code, output: readFileSync(log, "utf8") };
}

function advisory(severity: string, ghsa = "GHSA-aaaa-bbbb-cccc", id = 12345) {
  return { id, url: `https://github.com/advisories/${ghsa}`, title: "Synthetic audit finding", severity, vulnerable_versions: "<2.0.0", cwe: ["CWE-400"] };
}

describe("dedicated bulk audit CLI", () => {
  it("keeps the install toolchain and existing exemptions unchanged", () => {
    const root = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
    const workspace = parse(readFileSync(join(repo, "pnpm-workspace.yaml"), "utf8"));
    expect(root.packageManager).toBe("pnpm@10.34.5");
    expect(root.scripts["security:audit"]).toBe("node scripts/security-audit.mjs");
    expect(root.devDependencies.pnpm).toBeUndefined();
    expect(workspace.auditConfig.ignoreGhsas).toEqual([exemptGhsa, "GHSA-5p2g-fcmc-qvqq"]);
    const manifest = join(repo, "tools/security-audit/package.json");
    expect(existsSync(manifest)).toBe(true);
    expect(JSON.parse(readFileSync(manifest, "utf8")).devDependencies.pnpm).toBe("11.25.0");
  });

  it("uses bulk for v9 production direct/transitive/optional/workspace dependencies, without rewriting files", async () => {
    const cwd = fixture();
    const files = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"];
    const before = files.map((file) => readFileSync(join(cwd, file), "utf8"));
    const remote = await registry({});
    expect((await audit(cwd, remote.url)).code).toBe(0);
    expect(remote.requests).toHaveLength(1);
    expect(remote.requests[0]).toEqual({
      method: "POST", url: "/-/npm/v1/security/advisories/bulk",
      body: { "audit-prod": ["1.0.0"], "audit-transitive": ["1.0.0"], "@audit/optional": ["1.0.0"], "audit-linked": ["1.0.0"] },
    });
    expect(files.map((file) => readFileSync(join(cwd, file), "utf8"))).toEqual(before);
    expect(existsSync(join(cwd, "node_modules"))).toBe(false);
  }, 20000);

  it.each(["high", "critical"])("fails on a production %s advisory", async (severity) => {
    const remote = await registry({ "audit-transitive": [advisory(severity)] });
    const result = await audit(fixture(), remote.url);
    expect(result.code).toBe(1);
    expect(result.output).toContain("Synthetic audit finding");
    expect(result.output).toContain(severity);
    expect(remote.requests.filter((request) => request.method === "POST").map((request) => request.url)).toEqual(["/-/npm/v1/security/advisories/bulk"]);
    expect(remote.requests.filter((request) => request.method === "GET").map((request) => request.url)).toEqual(["/audit-transitive"]);
  }, 20000);

  it("preserves the high threshold, allowing moderate findings", async () => {
    const remote = await registry({ "audit-prod": [advisory("moderate")] });
    expect((await audit(fixture(), remote.url)).code).toBe(0);
  }, 20000);

  it("keeps an exact exemption without exempting a different high advisory", async () => {
    const cwd = fixture([exemptGhsa]);
    const exempted = await registry({ "audit-prod": [advisory("high", exemptGhsa)] });
    expect((await audit(cwd, exempted.url)).code).toBe(0);
    const other = await registry({ "audit-prod": [advisory("high", exemptGhsa), advisory("high", "GHSA-dddd-eeee-ffff", 12346)] });
    const result = await audit(cwd, other.url);
    expect(result.code).toBe(1);
    expect(result.output).toContain("GHSA-dddd-eeee-ffff");
  }, 20000);

  it.each([
    [500, { error: "temporary failure" }],
    [200, "invalid JSON"],
    [200, { "audit-prod": "invalid advisory shape" }],
    [200, { "audit-prod": [{ ...advisory("high"), id: "invalid-id" }] }],
    [200, { "audit-prod": [advisory("unknown-severity")] }],
    [200, { "audit-prod": [{ ...advisory("high"), vulnerable_versions: "invalid-semver" }] }],
    [0, {}],
  ])("fails closed on HTTP %s / malformed service response", async (status, body) => {
    const remote = await registry(body, status as number);
    const result = await audit(fixture(), remote.url);
    expect(result.code).not.toBe(0);
    expect(result.output).not.toContain("No known vulnerabilities found");
    expect(remote.requests.length).toBeGreaterThan(0);
  }, 20000);

  it("does not report a missing lockfile as clean", async () => {
    const cwd = fixture();
    rmSync(join(cwd, "pnpm-lock.yaml"));
    const remote = await registry({});
    expect((await audit(cwd, remote.url)).code).not.toBe(0);
    expect(remote.requests).toEqual([]);
  }, 20000);
});
