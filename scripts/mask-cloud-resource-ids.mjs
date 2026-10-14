/* global process */
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { collectResourceIdentifiers, githubMaskCommands } from "./cloud-resource-redaction.mjs";

// These commands are consumed and hidden by the Actions runner, never a local log.
if (process.env.GITHUB_ACTIONS !== "true") throw new Error("Resource masking must run inside GitHub Actions");
const config = JSON.parse(readFileSync(new URL("../apps/gateway/wrangler.jsonc", import.meta.url), "utf8"));
process.stdout.write(githubMaskCommands(collectResourceIdentifiers(config)));
