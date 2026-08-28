import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json";
import contentPackageJson from "../packages/content/package.json";

function scalarRunCommand(mappingEntry: string): string | undefined {
  const command = mappingEntry.match(/^run:\s*(\S.*?)\s*$/)?.[1];
  if (command === undefined || /^[>|][0-9+-]*(?:\s+#.*)?$/.test(command)) {
    return undefined;
  }
  return command;
}

function collectStepRunCommands(workflow: string): string[] {
  const commands: string[] = [];
  let inJobs = false;
  let inJob = false;
  let inSteps = false;
  let inStep = false;

  for (const line of workflow.split(/\r?\n/)) {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const content = line.slice(indent);

    if (content === "" || content.startsWith("#")) {
      continue;
    }

    if (indent === 0) {
      inJobs = content === "jobs:";
      inJob = false;
      inSteps = false;
      inStep = false;
      continue;
    }

    if (!inJobs) {
      continue;
    }

    if (indent === 2) {
      inJob = /^[A-Za-z0-9_-]+:\s*$/.test(content);
      inSteps = false;
      inStep = false;
      continue;
    }

    if (!inJob) {
      continue;
    }

    if (indent === 4) {
      inSteps = content === "steps:";
      inStep = false;
      continue;
    }

    if (!inSteps) {
      continue;
    }

    if (indent === 6) {
      const stepItem = content.match(/^-\s+(.*)$/)?.[1];
      inStep = stepItem !== undefined;
      const command = stepItem === undefined ? undefined : scalarRunCommand(stepItem);
      if (command !== undefined) {
        commands.push(command);
      }
      continue;
    }

    if (inStep && indent === 8) {
      const command = scalarRunCommand(content);
      if (command !== undefined) {
        commands.push(command);
      }
    }
  }

  return commands;
}

describe("step run command collection", () => {
  it("ignores required-looking text outside actual step run properties", () => {
    const workflow = `name: adversarial
jobs:
  example:
    env:
      JOB_NOTE: |
        run: pnpm validate:content
    steps:
      # run: pnpm validate:content:internal
      - name: run: pnpm validate:content:internal
        description: run: pnpm validate:content:internal
        env:
          STEP_NOTE: |
            run: pnpm validate:content:internal
        run: pnpm validate:content:internal || true
`;

    expect(collectStepRunCommands(workflow)).toEqual([
      "pnpm validate:content:internal || true"
    ]);
  });
});

describe("foundation CI workflow", () => {
  it("runs the complete foundation verification sequence", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8"
    );
    const runCommands = collectStepRunCommands(workflow);
    const contentValidationCommands = runCommands.filter((command) =>
      command.startsWith("pnpm validate:content")
    );

    expect(workflow).toContain("actions/checkout@v4");
    expect(workflow).toContain("pnpm/action-setup@v4");
    expect(workflow).toContain('version: "10.34.5"');
    expect(workflow).toContain('node-version: "22"');
    expect(runCommands).toContain("pnpm install --frozen-lockfile");
    expect(runCommands).toContain("pnpm typecheck");
    expect(runCommands).toContain("pnpm lint");
    expect(runCommands).toContain("pnpm test");
    expect(runCommands).toContain("pnpm build:gateway");
    expect(contentValidationCommands).toEqual(["pnpm validate:content:internal"]);
    expect(runCommands).toContain("pnpm --filter @cave/mobile expo:doctor");
    expect(runCommands).toContain("pnpm --filter @cave/mobile export:ios");
    expect(runCommands).toContain("pnpm security:scan-bundle");
    expect(runCommands).toContain("pnpm security:audit");
  });

  it("defines the fixed root verification command", () => {
    expect(contentPackageJson.scripts["validate:content:internal"]).toBe(
      "tsx src/validate-cli.ts --mode internal"
    );
    expect(packageJson.scripts["validate:content:internal"]).toBe(
      "pnpm --filter @cave/content validate:content:internal"
    );
    expect(packageJson.scripts.verify).toContain("pnpm validate:content");
    expect(packageJson.scripts.verify).toBe(
      "pnpm typecheck && pnpm lint && pnpm test && pnpm validate:content && pnpm build:gateway"
    );
  });

  it("keeps local release verification on production", () => {
    expect(packageJson.scripts["verify:release"]).toContain("pnpm verify");
    expect(packageJson.scripts["verify:release"]).toBe(
      "pnpm verify && pnpm --filter @cave/mobile expo:doctor && pnpm --filter @cave/mobile export:ios && pnpm security:scan-bundle && pnpm security:audit"
    );
  });
});
