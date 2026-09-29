import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const production = {
  name: "neijie-cave-gateway",
  databaseName: "neijie-cave-auth",
  databaseId: "91e935db-f104-4bcf-b6e0-964006c7b4e8",
  domain: "api.neijiecave.com"
};
const staging = {
  name: "neijie-cave-gateway-staging",
  databaseName: "neijie-cave-auth-staging",
  databaseId: "014af9e1-ebb2-4b46-aaf2-c9ce2b4de6e6",
  domain: "staging-api.neijiecave.com"
};

assert.equal(config.account_id, "3d3f8c9a0cd1392d912a00414155f7de");
assert.equal(config.name, production.name);
assert.equal(config.workers_dev, true);
assert.equal(config.vars?.MODEL_MODE, "live");
assert.equal(config.d1_databases?.length, 1);
assert.equal(config.d1_databases[0].binding, "AUTH_DB");
assert.equal(config.d1_databases[0].database_name, production.databaseName);
assert.equal(config.d1_databases[0].database_id, production.databaseId);
assert.deepEqual(config.routes, [{
  pattern: production.domain,
  zone_name: "neijiecave.com",
  custom_domain: true
}]);

const target = config.env?.staging;
assert.ok(target, "env.staging is required");
assert.equal(target.name, staging.name);
assert.equal(target.workers_dev, false);
assert.equal(target.d1_databases?.length, 1);
assert.deepEqual(target.d1_databases[0], {
  binding: "AUTH_DB",
  database_name: staging.databaseName,
  database_id: staging.databaseId,
  migrations_dir: "migrations"
});
assert.deepEqual(target.routes, [{
  pattern: staging.domain,
  zone_name: "neijiecave.com",
  custom_domain: true
}]);
assert.equal(target.vars?.MODEL_MODE, "live");
assert.equal(target.vars?.MODEL_BASE_URL, "https://api.deepseek.com");
assert.equal(target.vars?.MODEL_NAME, "deepseek-v4-flash");
assert.equal(target.vars?.PROMPT_VERSION, config.vars.PROMPT_VERSION);
assert.equal(target.vars?.POLICY_VERSION, config.vars.POLICY_VERSION);
for (const key of ["MODEL_API_KEY", "RESEND_API_KEY", "AUTH_EMAIL_LOOKUP_KEY_V1", "AUTH_OTP_KEY_V1"]) {
  assert.ok(!(key in config.vars), `${key} must not be a production plain variable`);
  assert.ok(!(key in target.vars), `${key} must not be a staging plain variable`);
}
const rateLimitNamespaces = (limits) => limits.map(({ namespace_id }) => namespace_id);
assert.equal(new Set(rateLimitNamespaces(target.ratelimits)).size, target.ratelimits.length);
for (const id of rateLimitNamespaces(target.ratelimits)) {
  assert.ok(!rateLimitNamespaces(config.ratelimits).includes(id), `staging rate limiter ${id} overlaps production`);
}
assert.deepEqual(target.triggers?.crons, config.triggers?.crons);

console.log(`Staging configuration OK: ${staging.name}, ${staging.databaseName}, ${staging.domain}`);
