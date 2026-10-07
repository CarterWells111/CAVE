/* global process, console */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobile = resolve(root, "apps/mobile");
const evidence = resolve(root, "outputs/local-storage-checks");
const suites = [
  "src/features/acceptance/acceptance-harness.test.ts",
  "src/features/acceptance/acceptance-harness.integration.test.ts",
  "src/features/acceptance/acceptance-process-recovery.integration.test.ts",
  "src/features/acceptance/native-acceptance.test.ts",
  "src/core/storage/database.test.ts",
  "src/core/storage/database.integration.test.ts",
  "src/core/storage/key-store.test.ts",
  "src/core/privacy/delete-all-data.test.ts",
  "src/core/privacy/delete-all-data.integration.test.ts",
];

async function main() {
  if (process.versions.node.split(".")[0] !== "22") {
    throw new Error("Use the repository Node 22 runtime (.nvmrc) for this local gate.");
  }
  const startedAt = new Date().toISOString();
  const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  const revision = git(["rev-parse", "HEAD"]).stdout?.trim() || null;
  const localChanges = Boolean(git(["status", "--porcelain"]).stdout?.trim());
  const require = createRequire(resolve(mobile, "package.json"));
  const jest = require.resolve("jest/bin/jest");
  process.stdout.write("Running local synthetic-storage checks; no cloud or phone automation.\n");
  const result = await new Promise((fulfill) => {
    const child = spawn(process.execPath, [jest, "--runInBand", "--json", "--runTestsByPath", ...suites], {
      cwd: mobile, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
      env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
    });
    let stdout = "";
    // Keep raw Jest details in memory only: reports retain counts, never SQL or key values.
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.resume();
    child.once("error", () => fulfill({ code: 1, stdout, error: "TEST_PROCESS_START_FAILED" }));
    child.once("close", (code) => fulfill({ code: code ?? 1, stdout }));
  });
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { /* Infrastructure failure remains failed. */ }
  const results = suites.map((suite) => {
    const found = parsed?.testResults?.find((item) => resolve(item.name) === resolve(mobile, suite));
    const cases = found?.assertionResults ?? [];
    return {
      suite,
      reported: Boolean(found),
      passed: cases.filter((item) => item.status === "passed").length,
      failed: cases.filter((item) => item.status === "failed").length,
      skipped: cases.filter((item) => item.status !== "passed" && item.status !== "failed").length,
      status: found?.status ?? "not-reported",
    };
  });
  const passed = result.code === 0 && parsed?.success === true
    && results.every((item) => item.reported && item.status === "passed" && item.passed > 0 && item.failed === 0 && item.skipped === 0);
  const report = {
    status: passed ? "passed" : "failed", revision, localChanges, node: process.version,
    platform: process.platform, startedAt, finishedAt: new Date().toISOString(),
    testExitCode: result.code, infrastructureError: parsed ? null : result.error ?? "JEST_JSON_RESULT_MISSING",
    totals: { passed: parsed?.numPassedTests ?? 0, failed: parsed?.numFailedTests ?? 0, skipped: parsed?.numPendingTests ?? 0 },
    results,
    evidenceScope: {
      sqlcipherProbe: "Control-flow regression with capability/connection substitutes; not real encryption evidence",
      processRecovery: "Actual Node process termination and fresh-process restart against real SQLite files and synthetic file-backed secrets",
      nativeSqlcipherVerified: false, iosKeychainVerified: false, iosForceQuitRecoveryVerified: false,
    },
    remoteOperations: "none",
  };
  mkdirSync(evidence, { recursive: true });
  const output = resolve(evidence, "checks.json");
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  for (const item of results) process.stdout.write(`${item.status}: ${item.suite} (${item.passed} passed, ${item.failed} failed, ${item.skipped} skipped)\n`);
  process.stdout.write(`Local storage gate ${report.status}: ${report.totals.passed} passed; summary: ${output}\n`);
  process.exitCode = passed ? 0 : 1;
}

main().catch(() => {
  console.error("Local storage verification could not start. Check Node 22 and installed workspace dependencies.");
  process.exitCode = 1;
});
