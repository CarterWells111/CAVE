import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import "./check-staging-config.mjs";

const commands = {
  deploy: ["deploy", "--env", "staging"],
  "dry-run": ["deploy", "--env", "staging", "--dry-run", "--outdir", "dist/staging"],
  migrate: ["d1", "migrations", "apply", "AUTH_DB", "--env", "staging", "--remote"],
  list: ["d1", "migrations", "list", "AUTH_DB", "--env", "staging", "--remote"],
  secrets: ["secret", "list", "--env", "staging"]
};
const action = process.argv[2];
if (!Object.hasOwn(commands, action)) {
  console.error("Expected staging action: deploy, dry-run, migrate, list or secrets");
  process.exitCode = 2;
} else {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
  const result = spawnSync(process.execPath, [wrangler, ...commands[action]], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: config.account_id },
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
