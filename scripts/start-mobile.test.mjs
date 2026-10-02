import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./start-mobile.mjs", import.meta.url));
function inspect(mode, localGatewayUrl) {
  return spawnSync(process.execPath, [script, mode, "--print-env"], {
    encoding: "utf8",
    env: { ...process.env, CAVE_LOCAL_GATEWAY_URL: localGatewayUrl },
  });
}

test("Expo Go and local development client use an explicit LAN Gateway", () => {
  for (const mode of ["go-local", "go-local-preview", "dev-local"]) {
    const result = inspect(mode, "http://192.168.1.23:8787");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).gatewayUrl, "http://192.168.1.23:8787");
  }
});

test("journal preview keeps its mock AI mode", () => {
  const result = inspect("go-local-preview", "http://192.168.1.23:8787");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).assistantMode, "mock");
});

test("development and acceptance Metro use staging unless local is selected", () => {
  for (const mode of ["dev-staging", "acceptance-staging"]) {
    const result = inspect(mode, "http://192.168.1.23:8787");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).gatewayUrl, "https://staging-api.neijiecave.com");
  }
  assert.equal(JSON.parse(inspect("acceptance-staging").stdout).acceptanceTools, true);
  assert.equal(JSON.parse(inspect("dev-staging").stdout).acceptanceTools, false);
});

test("local targets fail before Metro when absent, loopback or public HTTP", () => {
  for (const value of [undefined, "http://localhost:8787", "http://127.0.0.1:8787", "http://8.8.8.8:8787"]) {
    assert.notEqual(inspect("go-local", value).status, 0);
  }
});
