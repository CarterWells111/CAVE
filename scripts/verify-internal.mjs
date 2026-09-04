import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const INTERNAL_CHECKS = [
  ["test:ci-config"], ["typecheck"], ["lint"], ["test"],
  ["verify:mobile-policy"], ["validate:content:internal"],
  ["build:gateway"], ["build:web"],
  ["--filter", "@cave/mobile", "expo:doctor"],
  ["--filter", "@cave/mobile", "export:ios"],
  ["--filter", "@cave/mobile", "export:acceptance"],
  ["exec", "node", "scripts/scan-bundle-secrets.mjs", "apps/mobile/dist-acceptance"],
  ["security:scan-bundle"], ["verify:acceptance-isolation"], ["security:audit"],
];

export async function runChecks(run, checks = INTERNAL_CHECKS) {
  const results = [];
  for (const args of checks) {
    const start = Date.now();
    let exitCode;
    try { exitCode = await run(args); } catch { exitCode = 1; }
    results.push({ command: `pnpm ${args.join(" ")}`, exitCode, durationMs: Date.now() - start });
  }
  return { status: results.every((item) => item.exitCode === 0) ? "passed" : "failed", results };
}

async function main() {
  if (process.versions.node.split(".")[0] !== "22") throw new Error("Internal verification requires Node 22; see .nvmrc");
  const pnpm = process.env.npm_execpath;
  if (!pnpm) throw new Error("Run this gate using pnpm verify:internal");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const startedAt = new Date().toISOString();
  const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  const revision = git(["rev-parse", "HEAD"]).stdout?.trim() || null;
  const trackedDirty = git(["diff", "--quiet", "HEAD"]).status !== 0;
  const evidenceDir = resolve(root, "outputs/p0-readiness");
  mkdirSync(evidenceDir, { recursive: true });
  const log = resolve(evidenceDir, "verification.log");
  writeFileSync(log, `Node ${process.version}; revision ${revision}; trackedDirty=${trackedDirty}\n`);
  const report = await runChecks((args) => new Promise((fulfill) => {
    const heading = `\nRunning: pnpm ${args.join(" ")}\n`;
    process.stdout.write(heading);
    appendFileSync(log, heading);
    const child = spawn(process.execPath, [pnpm, ...args], { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { process.stdout.write(chunk); appendFileSync(log, chunk); });
    child.once("error", () => fulfill(1));
    child.once("exit", (code) => fulfill(code ?? 1));
  }));
  const output = resolve(root, "outputs/p0-readiness/verification.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ revision, trackedDirty, node: process.version, pnpmExecutable: pnpm, startedAt, finishedAt: new Date().toISOString(), ...report }, null, 2) + "\n");
  process.stdout.write(`\nInternal gate ${report.status}. Evidence: ${output}\n`);
  process.exitCode = report.status === "passed" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
