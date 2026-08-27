import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const explicitTargets = process.argv.slice(2).map((target) => resolve(target));
const defaultTargets = [
  resolve(workspaceRoot, "apps/mobile/dist"),
  resolve(workspaceRoot, "dist/mobile"),
  resolve(workspaceRoot, "build/mobile")
];
const targets = explicitTargets.length > 0 ? explicitTargets : defaultTargets;

const forbiddenPatterns = [
  { label: "MODEL_API_KEY identifier", expression: /MODEL_API_KEY/gu },
  {
    label: "Bearer credential",
    expression: /\bBearer\s+(?:sk-|[A-Za-z0-9_-]{16,})/gu
  },
  {
    label: "standalone provider credential",
    expression: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/gu
  },
  {
    label: "seeded bundle canary",
    expression: /CAVE_BUNDLE_SECRET_CANARY_7f4b2d/gu
  }
];

function listFiles(path) {
  if (!existsSync(path)) {
    return [];
  }

  const details = statSync(path);
  if (details.isFile()) {
    return [path];
  }
  if (!details.isDirectory()) {
    return [];
  }

  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) {
      return listFiles(child);
    }
    return entry.isFile() ? [child] : [];
  });
}

const files = targets.flatMap(listFiles);
const findings = [];

if (files.length === 0) {
  console.error("bundle secret scan failed: no exported bundle files found");
  process.exitCode = 1;
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    pattern.expression.lastIndex = 0;
    if (pattern.expression.test(source)) {
      findings.push({ file: relative(workspaceRoot, file), label: pattern.label });
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`bundle secret finding: ${finding.label} in ${finding.file}`);
  }
  process.exitCode = 1;
} else if (files.length > 0) {
  console.log(`bundle secret scan passed (${files.length} file(s))`);
}
