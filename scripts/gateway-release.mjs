/* global process, console, fetch, AbortSignal, TextDecoder, setTimeout */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { URL, fileURLToPath, pathToFileURL } from "node:url";

export function validateStagingRun(run, jobs, repository) {
  assert.equal(run.repository?.full_name, repository, "Unexpected repository");
  assert.equal(run.path, ".github/workflows/ci.yml", "Expected the CI workflow");
  assert.equal(run.event, "push", "PR and manual runs cannot be promoted");
  assert.equal(run.head_branch, "main", "Only main builds can be promoted");
  assert.equal(run.status, "completed");
  assert.equal(run.conclusion, "success", "CI must have succeeded");
  assert.match(run.head_sha, /^[a-f0-9]{40}$/);
  for (const name of ["foundation", "deploy-staging"]) {
    const job = jobs.find((entry) => entry.name === name);
    assert.equal(job?.conclusion, "success", `${name} must have succeeded`);
  }
  return run.head_sha;
}

export function validateStagingEvidence(evidence, sha, runId, repository) {
  assert.equal(evidence.environment, "staging");
  assert.equal(evidence.sha, sha, "Staging artifact belongs to another commit");
  assert.equal(String(evidence.runId), String(runId));
  assert.equal(evidence.repository, repository);
  assert.equal(evidence.smokePassed, true);
  assert.equal(evidence.versionTag, sha, "Deployed Worker must match the source commit");
  assert.match(evidence.versionId, /^[a-f0-9-]{36}$/);
}

export function activeVersion(deployments) {
  assert.ok(Array.isArray(deployments) && deployments.length > 0, "No deployment found");
  for (const deployment of deployments) assert.ok(Number.isFinite(Date.parse(deployment.created_on)), "Invalid deployment timestamp");
  const latest = [...deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  assert.equal(latest.versions?.length, 1, "Expected a single deployed version");
  assert.equal(latest.versions[0].percentage, 100);
  assert.match(latest.versions[0].version_id, /^[a-f0-9-]{36}$/);
  return latest.versions[0].version_id;
}

export function uploadedVersion(versions, sha) {
  assert.ok(Array.isArray(versions));
  const candidates = versions.filter((version) => version.annotations?.["workers/tag"] === sha);
  assert.ok(candidates.length > 0, "No uploaded version matches the source commit");
  for (const version of candidates) assert.ok(Number.isFinite(Date.parse(version.metadata?.created_on)));
  const latest = candidates.sort((a, b) => Date.parse(b.metadata.created_on) - Date.parse(a.metadata.created_on))[0];
  assert.match(latest.id, /^[a-f0-9-]{36}$/);
  return latest.id;
}

export function confirmedVersionUpload(result, versions, sha, accountId, workerName) {
  const uploadedId = uploadedVersion(versions, sha);
  const ansi = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");
  const stdout = (result.stdout ?? "").replace(ansi, "");
  const stderr = (result.stderr ?? "").replace(ansi, "");
  const diagnostics = stdout + "\n" + stderr;
  const reportedIds = [...stdout.matchAll(/Worker Version ID: ([a-f0-9-]{36})/g)];
  assert.equal(reportedIds.length, 1, "Upload must report exactly one completed version");
  assert.equal(reportedIds[0][1], uploadedId, "Reported upload differs from the tagged remote version");
  assert.ok(stdout.includes("Uploaded " + workerName + " "), "Upload belongs to another Worker");
  if (result.status !== 0) {
    // Wrangler 4.126 queries the optional account preview URL after uploading.
    // A restricted Worker token may reject that read despite a completed upload.
    assert.equal(result.status, 1, "Interrupted uploads cannot be promoted");
    assert.equal(result.signal, null, "Interrupted uploads cannot be promoted");
    assert.match(accountId, /^[a-f0-9]{32}$/);
    assert.equal((diagnostics.match(/\[ERROR\]/g) ?? []).length, 1, "Unexpected upload diagnostics");
    assert.ok(diagnostics.includes("(/accounts/" + accountId + "/workers/subdomain) failed."), "Upload failed outside the optional preview lookup");
    assert.match(diagnostics, /Authentication error \[code:\s*10000\]/, "Unexpected preview lookup failure");
  }
  return uploadedId;
}

export function pendingMigrations(files, query) {
  assert.ok(Array.isArray(query) && query.length === 1 && query[0].success === true);
  assert.ok(Array.isArray(query[0].results));
  const applied = new Set(query[0].results.map((row) => {
    assert.equal(typeof row.name, "string");
    return row.name;
  }));
  return files.filter((name) => name.endsWith(".sql") && !applied.has(name));
}

export function validateHealth(health, meta, vars) {
  assert.equal(health.contractVersion, "1");
  assert.equal(health.status, "ok");
  assert.equal(meta.contractVersion, "1");
  assert.equal(meta.providerMode, "live");
  assert.equal(meta.modelName, vars.MODEL_NAME);
  assert.equal(meta.promptVersion, vars.PROMPT_VERSION);
  assert.equal(meta.policyVersion, vars.POLICY_VERSION);
}

async function getPublicJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "error", cache: "no-store" });
  assert.equal(response.status, 200, `Health endpoint returned HTTP ${response.status}`);
  assert.ok(response.headers.get("cache-control")?.includes("no-store"));
  let body = "";
  let size = 0;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    assert.ok(size <= 65_536, "Health response too large");
    body += decoder.decode(chunk, { stream: true });
  }
  return JSON.parse(body + decoder.decode());
}

async function smoke(origin, vars) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const health = await getPublicJson(`${origin}/health`);
      const meta = await getPublicJson(`${origin}/v1/meta`);
      validateHealth(health, meta, vars);
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((done) => setTimeout(done, 5_000));
    }
  }
}

async function deploy(environment) {
  assert.ok(["staging", "production"].includes(environment), "Unknown environment");
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Use the protected GitHub workflow");
  assert.equal(process.env.GITHUB_REF, "refs/heads/main");
  const sha = process.env.RELEASE_SHA;
  assert.match(sha ?? "", /^[a-f0-9]{40}$/);
  const root = fileURLToPath(new URL("../", import.meta.url));
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true });
  assert.equal(head.status, 0);
  assert.equal(head.stdout.trim(), sha, "Checkout differs from the accepted commit");
  assert.ok(process.env.CLOUDFLARE_API_TOKEN, "Configure the environment's CLOUDFLARE_API_TOKEN Secret");
  // The existing checker validates both production and staging resource identities.
  await import("../apps/gateway/scripts/check-staging-config.mjs");
  const config = JSON.parse(readFileSync(new URL("../apps/gateway/wrangler.jsonc", import.meta.url), "utf8"));
  const target = environment === "staging" ? config.env.staging : config;
  const gateway = fileURLToPath(new URL("../apps/gateway/", import.meta.url));
  const wrangler = resolve(gateway, "node_modules/wrangler/bin/wrangler.js");
  const envArgs = ["--env", environment === "staging" ? "staging" : ""];
  const childEnv = { ...process.env, CLOUDFLARE_ACCOUNT_ID: config.account_id, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" };
  // Select environments using CLI arguments, without ambient Vite/Builds selectors.
  delete childEnv.CLOUDFLARE_ENV;
  delete childEnv.WRANGLER_ENV;
  function run(args, json = false) {
    const result = spawnSync(process.execPath, [wrangler, ...args, ...envArgs], {
      cwd: gateway, env: childEnv, windowsHide: true,
      ...(json ? { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 } : { stdio: "inherit" })
    });
    assert.equal(result.status, 0, `Wrangler ${args.slice(0, 2).join(" ")} failed`);
    return json ? JSON.parse(result.stdout) : undefined;
  }
  const secretNames = new Set(run(["secret", "list"], true).map((secret) => secret.name));
  const required = ["MODEL_API_KEY", "RESEND_API_KEY", "AUTH_EMAIL_LOOKUP_KEY_V1", "AUTH_OTP_KEY_V1"];
  if (target.vars.ROOMS_ENABLED === "true") required.push("ROOM_ENCRYPTION_KEY_V1");
  for (const name of required) assert.ok(secretNames.has(name), `Missing Worker Secret: ${name}`);
  run(["deploy", "--dry-run", "--outdir", "dist/release"]);
  const previousVersionId = activeVersion(run(["deployments", "list", "--json"], true));
  const bookmark = run(["d1", "time-travel", "info", "AUTH_DB", "--json"], true);
  assert.equal(typeof bookmark.bookmark, "string", "D1 recovery bookmark is required");
  const output = resolve(root, "outputs/gateway-release");
  mkdirSync(output, { recursive: true });
  const evidence = {
    environment, sha, runId: process.env.GITHUB_RUN_ID, repository: process.env.GITHUB_REPOSITORY,
    previousVersionId, databaseId: target.d1_databases[0].database_id,
    databaseBookmark: bookmark.bookmark, recordedAt: new Date().toISOString()
  };
  // Persist recovery information before changing either the database or Worker.
  writeFileSync(resolve(output, "recovery.json"), JSON.stringify(evidence, null, 2) + "\n");
  if (environment === "production" && process.env.APPLY_MIGRATIONS !== "true") {
    const applied = run(["d1", "execute", "AUTH_DB", "--remote", "--json", "--command", "SELECT name FROM d1_migrations"], true);
    const pending = pendingMigrations(readdirSync(resolve(gateway, "migrations")), applied);
    assert.equal(pending.length, 0, `Pending production migrations require explicit approval: ${pending.join(", ")}`);
  } else {
    run(["d1", "migrations", "apply", "AUTH_DB", "--remote"]);
  }
  // Version promotion preserves existing domains and cron schedules. It can use
  // per-Worker Editor access rather than permission to change zone routing.
  const upload = spawnSync(process.execPath, [wrangler, "versions", "upload", "--tag", sha, ...envArgs], {
    cwd: gateway, env: childEnv, windowsHide: true, encoding: "utf8", maxBuffer: 2 * 1024 * 1024
  });
  const uploadedId = confirmedVersionUpload(upload, run(["versions", "list", "--json"], true), sha, config.account_id, target.name);
  const candidate = run(["versions", "view", uploadedId, "--json"], true);
  assert.equal(candidate.id, uploadedId);
  assert.equal(candidate.annotations?.["workers/tag"], sha, "Uploaded Worker differs from the accepted commit");
  if (upload.status !== 0) console.warn("Completed upload verified via API; optional account preview URL lookup was denied.");
  run(["versions", "deploy", `${uploadedId}@100%`, "--yes"]);
  const versionId = activeVersion(run(["deployments", "list", "--json"], true));
  assert.equal(versionId, uploadedId);
  const version = run(["versions", "view", versionId, "--json"], true);
  assert.equal(version.id, versionId);
  assert.equal(version.annotations?.["workers/tag"], sha, "Active Worker does not match the accepted commit");
  await smoke(`https://${target.routes[0].pattern}`, target.vars);
  writeFileSync(resolve(output, "release.json"), JSON.stringify({
    ...evidence, versionId, versionTag: sha, smokePassed: true, finishedAt: new Date().toISOString()
  }, null, 2) + "\n");
  console.log(`${environment} deployed and checked: ${sha}; version ${versionId}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv[2], "deploy");
  deploy(process.argv[3]).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
