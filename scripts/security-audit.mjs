import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const auditPackage = join(root, "tools/security-audit/node_modules/pnpm");

// Audit only: pnpm 11 supports npm's bulk endpoint. All installs/lifecycles
// continue using the root's pinned pnpm 10; no lockfile migration is performed.
export async function runAudit(cwd = root, { env = process.env, stdio = "inherit" } = {}) {
  try {
    if (!existsSync(join(cwd, "pnpm-lock.yaml"))) throw new Error("Audit requires pnpm-lock.yaml; refusing an empty audit.");
    const version = JSON.parse(readFileSync(join(auditPackage, "package.json"), "utf8")).version;
    if (version !== "11.25.0") throw new Error("Audit requires the pinned pnpm 11.25.0 tool; run pnpm install --frozen-lockfile.");
    const childEnv = { ...env };
    // Inherited from pnpm lifecycle commands: otherwise the audit CLI can
    // delegate back to the pnpm 10 installer and its retired audit endpoint.
    delete childEnv.PNPM_PACKAGE_MANAGER_BINARY;
    return await new Promise((done) => {
      const child = spawn(process.execPath, [
        join(auditPackage, "bin/pnpm.mjs"),
        // This controls only package-manager self-switching, not audit findings.
        "--pm-on-fail=ignore", "audit", "--prod", "--audit-level", "high",
      ], { cwd, env: childEnv, stdio, windowsHide: true });
      child.once("error", (error) => { console.error(`Audit could not start: ${error.message}`); done(1); });
      child.once("exit", (code) => done(code ?? 1));
    });
  } catch (error) {
    console.error(`Audit failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runAudit();
}
