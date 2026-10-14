import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  collectResourceIdentifiers, createRedactedLineWriter, githubMaskCommands, redactResourceIdentifiers,
} from "../scripts/cloud-resource-redaction.mjs";

describe("cloud resource evidence redaction", () => {
  it("collects unique identifiers across production and staging without hiding ordinary diagnostics", () => {
    const identifiers = collectResourceIdentifiers({
      account_id: "sample-account", name: "worker-name",
      d1_databases: [{ database_id: "sample-db", binding: "AUTH_DB" }],
      kv_namespaces: [{ id: "sample-kv" }],
      env: { staging: { d1_databases: [{ database_id: "sample-db" }], ratelimits: [{ namespace_id: "sample-rate" }],
        vars: { CREATOR_ACCOUNT_IDS: "sample-user-a,sample-user-b", OTHER_ACCOUNT_IDS: "*" } } },
    });
    expect(new Set(identifiers)).toEqual(new Set(["sample-account", "sample-db", "sample-kv", "sample-rate", "sample-user-a", "sample-user-b"]));
    expect(redactResourceIdentifiers("AUTH_DB sample-db failed: missing binding in worker-name", identifiers))
      .toBe("AUTH_DB [redacted-resource-id] failed: missing binding in worker-name");
  });

  it("redacts literal identifiers and overlapping identifiers without regex interpretation", () => {
    const identifiers = collectResourceIdentifiers({ account_id: "test.account+long", namespace_id: "test.account" });
    expect(redactResourceIdentifiers("test.account+long / test.account / other", identifiers))
      .toBe("[redacted-resource-id] / [redacted-resource-id] / other");
  });

  it("holds a resource ID split across chunks and preserves UTF-8 and final unterminated diagnostics", () => {
    const emitted: string[] = [];
    const writer = createRedactedLineWriter((text: string) => emitted.push(text), ["example-resource"]);
    const bytes = Buffer.from("失败 example-resource\nretry example-resource", "utf8");
    for (const byte of bytes) writer.write(Buffer.from([byte]));
    expect(emitted).toEqual(["失败 [redacted-resource-id]\n"]);
    writer.end();
    writer.end();
    expect(emitted.join("")).toBe("失败 [redacted-resource-id]\nretry [redacted-resource-id]");
  });

  it("emits escaped GitHub mask commands before any foundation check", () => {
    expect(githubMaskCommands(["sample-resource", "value%\r\n"])).toBe("::add-mask::sample-resource\n::add-mask::value%25%0D%0A\n");
    const workflow = parse(readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"));
    expect(workflow.jobs.foundation.env.WRANGLER_WRITE_LOGS).toBe("false");
    const steps: { run?: string; if?: string; "continue-on-error"?: boolean }[] = workflow.jobs.foundation.steps;
    const mask = steps.findIndex(step => step.run === "node scripts/mask-cloud-resource-ids.mjs");
    expect(mask).toBeGreaterThan(-1);
    expect(mask).toBeLessThan(steps.findIndex(step => step.run === "pnpm verify:internal"));
    expect(mask).toBeLessThan(steps.findIndex(step => step.run === "pnpm --filter @cave/gateway build:staging"));
    expect(steps[mask]!.if).toBeUndefined();
    expect(steps[mask]!["continue-on-error"]).toBeUndefined();
  });
});
