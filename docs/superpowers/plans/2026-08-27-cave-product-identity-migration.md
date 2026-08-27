# 内界 CAVE Product Identity Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pre-release `Body Voice` identity with the approved “内界 CAVE” brand and technical identifiers, then create and verify the new `carter_wells/cave` EAS project and iOS Development Build without adding Android scope.

**Architecture:** Treat product identity as a small set of separately testable boundaries: Expo app config, user-facing copy, workspace package graph, Worker config, and content identifiers. Update the master contract before consumers, use precise RED → GREEN tests for every code/config capability, regenerate the lockfile through pnpm, and defer all cloud/device mutations until the local branch and remote CI are clean.

**Tech Stack:** TypeScript, Expo SDK 54, Expo config, Jest, Vitest, pnpm 10, Wrangler, EAS CLI, GitHub Actions, iOS internal distribution

---

## Approved identity

| Field | Approved value |
|---|---|
| Brand | `内界 CAVE` |
| Slogan | `听见身体，确认边界。` |
| Description | `面向年轻女性的身体认知与亲密关系成长应用。` |
| Production display name | `内界 CAVE` |
| Development display name | `内界 CAVE Dev` |
| Preview display name | `内界 CAVE Preview` |
| Expo owner/project | new `carter_wells/cave` project |
| Expo slug / URL scheme | `cave` / `cave` |
| iOS Bundle ID | `com.neijie.cave` |
| Android package | absent; Android is out of scope |
| App version | `0.1.0` |
| Root workspace name | `neijie-cave` |
| Package scope | `@cave/*` |
| Worker name | `neijie-cave-gateway` |
| Course ID | `cave-basics` |

## File responsibility map

- `docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md`: normative cross-plan identity, root commands, change request, and acceptance evidence; historical command evidence remains unchanged.
- `docs/superpowers/plans/2026-08-26-{01,02,03,05,06}-*.md`: current and future consumers of the identity contract.
- `docs/superpowers/specs/2026-08-27-cave-product-identity-design.md`: approved design status and immutable migration rationale.
- `apps/mobile/app.config.ts`: environment display names, Expo owner/slug/scheme/version, iOS identifier, and runtime metadata.
- `apps/mobile/app/index.tsx`: runtime version fallback passed to the shell.
- `apps/mobile/src/config/app-identity.test.ts`: executable app identity contract.
- `apps/mobile/src/features/health/health-screen.{tsx,test.tsx}`: visible brand, slogan, version, build, and environment.
- `package.json`, `apps/*/package.json`, `packages/*/package.json`: workspace names, filters, and dependency graph.
- `apps/**/src/**/*.ts`, `packages/**/src/**/*.ts`: public imports and entry-point labels under `@cave/*`.
- `tests/workspace-identity.test.ts`: tracked-file guard for workspace names and legacy scope.
- `pnpm-lock.yaml`: generated workspace dependency keys; never hand-edit.
- `apps/gateway/wrangler.jsonc`: Cloudflare Worker identity.
- `packages/content/data/{courses,lessons}.json`: course ID and lesson back-reference.
- `packages/contracts/src/content.test.ts`, `packages/content/src/validate.test.ts`: contract fixture and exact catalog identity assertion.
- `apps/mobile/eas.json`: approved iOS build profiles; EAS linking must not add Android configuration.

### Task 1: Update the normative identity contract

**Files:**
- Modify: `docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md`
- Modify: `docs/superpowers/plans/2026-08-26-01-repository-infrastructure-ios-build.md`
- Modify: `docs/superpowers/plans/2026-08-26-02-contracts-content-domain.md`
- Modify: `docs/superpowers/plans/2026-08-26-03-ai-gateway-prompt-spec.md`
- Modify: `docs/superpowers/plans/2026-08-26-05-mobile-mvp-integration.md`
- Modify: `docs/superpowers/plans/2026-08-26-06-product-completion-ux.md`
- Modify: `docs/superpowers/specs/2026-08-27-cave-product-identity-design.md`

- [ ] **Step 1: Run the normative RED scan**

Run:

```powershell
rg -n "@hackathon/|body-voice|bodyvoice|com\.shenicest\.bodyvoice|Body Voice" docs/superpowers/plans/2026-08-26-01-repository-infrastructure-ios-build.md docs/superpowers/plans/2026-08-26-02-contracts-content-domain.md docs/superpowers/plans/2026-08-26-03-ai-gateway-prompt-spec.md docs/superpowers/plans/2026-08-26-05-mobile-mvp-integration.md docs/superpowers/plans/2026-08-26-06-product-completion-ux.md
```

Expected: exit 0 with current normative references in Plans 01, 02, 03, and 05.

- [ ] **Step 2: Replace the master fixed decisions and root filters**

Make the fixed-decision table contain these exact current values:

```markdown
| 产品品牌 | `内界 CAVE` |
| Expo owner/project | `carter_wells/cave` |
| Expo slug | `cave` |
| URL scheme | `cave` |
| Package scope | `@cave/*` |
| iOS Bundle ID | `com.neijie.cave` |
| Android package | 本轮不配置；启用 Android 前另走固定决策变更 |
| Worker name | `neijie-cave-gateway` |
```

Change every normative root command from `@hackathon/*` to the corresponding `@cave/*`. Do not modify the prior Gate evidence command lines that record commands already executed on 2026-08-26.

Immediately below the cross-plan change process heading, add this approved change record:

```markdown
### CR-2026-08-27：发布前产品标识迁移

- 原因：仓库初始 `Body Voice` 标识与批准的“内界 CAVE”产品定义不符，且尚未创建 EAS 项目或发行记录。
- 决策：采用 `carter_wells/cave`、`com.neijie.cave`、`@cave/*`、`neijie-cave-gateway` 与 `cave-basics`；本轮删除 Android package。
- 影响：Plan 01 App/EAS/Worker Gate、Plan 02 内容主 ID，以及 Plans 03/05/06 的消费者名称。
- 验收：本地 identity tests、完整 Plan 01—02 技术验证、feature-branch CI、EAS 项目差异审查和真实 iPhone Development Build。
```

- [ ] **Step 3: Update every normative consumer plan**

Apply these exact rules:

```text
Plan 01: @cave/*; slug cave; scheme cave; owner carter_wells; iOS com.neijie.cave;
         no android.package; version 0.1.0; Worker neijie-cave-gateway.
Plan 02: @cave/contracts, @cave/content, @cave/scenario-engine; course ID cave-basics.
Plan 03: @cave/contracts, @cave/scenario-engine, @cave/test-fixtures, @cave/gateway.
Plan 05: @cave/content, @cave/scenario-engine, @cave/mobile.
Plan 06: brand.ts must fix slug="cave", displayName="内界 CAVE",
         slogan="听见身体，确认边界。" and the approved one-sentence description.
```

Set the design specification status to `已批准，等待实施`. Retain the old-value column in its migration table because that is historical rationale. Retain Plan 08's `shenicest-fission` topic because it is a challenge tag, not a product identifier.

- [ ] **Step 4: Run the normative GREEN scan**

Run the same scan against the five explicit Plan 01/02/03/05/06 paths.

Expected: exit 1 with no old identity matches. Then run:

```powershell
git diff --check
```

Expected: exit 0.

- [ ] **Step 5: Commit the contract change**

```powershell
git add docs/superpowers/plans docs/superpowers/specs/2026-08-27-cave-product-identity-design.md
git commit -m "docs: update cave identity contract"
```

### Task 2: Adopt the Expo and iOS application identity

**Files:**
- Create: `apps/mobile/src/config/app-identity.test.ts`
- Modify: `apps/mobile/app.config.ts`
- Modify: `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Write the failing App config contract test**

Create `apps/mobile/src/config/app-identity.test.ts`:

```ts
import type { ConfigContext } from "expo/config";

import appConfig from "../../app.config";

const originalProfile = process.env.EAS_BUILD_PROFILE;

function resolveConfig(profile: "development" | "preview" | "production") {
  process.env.EAS_BUILD_PROFILE = profile;
  return appConfig({ config: {} } as ConfigContext);
}

afterEach(() => {
  if (originalProfile === undefined) {
    delete process.env.EAS_BUILD_PROFILE;
  } else {
    process.env.EAS_BUILD_PROFILE = originalProfile;
  }
});

describe("CAVE application identity", () => {
  it.each([
    ["development", "内界 CAVE Dev"],
    ["preview", "内界 CAVE Preview"],
    ["production", "内界 CAVE"]
  ] as const)("uses the %s display name", (profile, displayName) => {
    expect(resolveConfig(profile).name).toBe(displayName);
  });

  it("uses the approved Expo and iOS identifiers", () => {
    const config = resolveConfig("development");

    expect(config).toMatchObject({
      owner: "carter_wells",
      slug: "cave",
      version: "0.1.0",
      scheme: "cave",
      ios: {
        bundleIdentifier: "com.neijie.cave",
        supportsTablet: false
      }
    });
    expect(config.android).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to prove RED**

Run:

```powershell
corepack pnpm --filter @hackathon/mobile test -- app-identity.test.ts
```

Expected: FAIL because the current display names, slug, scheme, version, Bundle ID, and Android configuration do not match.

- [ ] **Step 3: Implement the minimal App identity**

Replace `apps/mobile/app.config.ts` with:

```ts
import type { ConfigContext, ExpoConfig } from "expo/config";

function getEnvironment() {
  return process.env.EAS_BUILD_PROFILE ?? "development";
}

function getDisplayName(environment: string) {
  if (environment === "production") {
    return "内界 CAVE";
  }

  if (environment === "preview") {
    return "内界 CAVE Preview";
  }

  return "内界 CAVE Dev";
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment = getEnvironment();

  return {
    ...config,
    owner: "carter_wells",
    name: getDisplayName(environment),
    slug: "cave",
    version: "0.1.0",
    scheme: "cave",
    orientation: "portrait",
    plugins: ["expo-router"],
    experiments: {
      typedRoutes: true
    },
    ios: {
      bundleIdentifier: "com.neijie.cave",
      supportsTablet: false
    },
    extra: {
      build: process.env.EAS_BUILD_ID ?? "local",
      environment
    }
  };
};
```

Set `apps/mobile/package.json` version to `0.1.0`. In `apps/mobile/app/index.tsx`, change the version fallback to:

```tsx
version={Constants.expoConfig?.version ?? "0.1.0"}
```

- [ ] **Step 4: Run GREEN verification**

```powershell
corepack pnpm --filter @hackathon/mobile test -- app-identity.test.ts
corepack pnpm --filter @hackathon/mobile exec expo config --type public
corepack pnpm --filter @hackathon/mobile expo:doctor
```

Expected: test PASS; public config shows `carter_wells`, `内界 CAVE Dev`, `cave`, `0.1.0`, and `com.neijie.cave`; Expo Doctor passes all checks; no Android package appears.

- [ ] **Step 5: Commit**

```powershell
git add apps/mobile/app.config.ts apps/mobile/app/index.tsx apps/mobile/package.json apps/mobile/src/config/app-identity.test.ts
git commit -m "feat: adopt cave app identity"
```

### Task 3: Adopt the approved user-facing brand copy

**Files:**
- Modify: `apps/mobile/src/features/health/health-screen.test.tsx`
- Modify: `apps/mobile/src/features/health/health-screen.tsx`
- Modify: `README.md`

- [ ] **Step 1: Strengthen the shell test and prove RED**

Replace the existing test case body with:

```tsx
it("displays the approved brand and build identity", () => {
  render(
    <HealthScreen
      build="local"
      environment="development"
      version="0.1.0"
    />
  );

  expect(screen.getByText("内界 CAVE")).toBeOnTheScreen();
  expect(screen.getByText("听见身体，确认边界。")).toBeOnTheScreen();
  expect(screen.getByText("version 0.1.0")).toBeOnTheScreen();
  expect(screen.getByText("build local")).toBeOnTheScreen();
  expect(screen.getByText("development")).toBeOnTheScreen();
});
```

Run:

```powershell
corepack pnpm --filter @hackathon/mobile test -- health-screen.test.tsx
```

Expected: FAIL because the old title remains and the slogan is absent.

- [ ] **Step 2: Implement the minimal copy change**

In `HealthScreen`, render this brand block before the version line:

```tsx
<Text style={styles.title}>内界 CAVE</Text>
<Text style={styles.tagline}>听见身体，确认边界。</Text>
```

Add this style:

```ts
tagline: {
  fontSize: 16,
  textAlign: "center"
}
```

Replace the README heading and introduction with:

```markdown
# 内界 CAVE

**听见身体，确认边界。**

内界 CAVE 是一款面向年轻女性的身体认知与亲密关系成长应用。
```

Keep the existing plan links and fixed technical decisions below that introduction.

- [ ] **Step 3: Run GREEN verification**

```powershell
corepack pnpm --filter @hackathon/mobile test -- health-screen.test.tsx
```

Expected: 1 test PASS with all five approved identity assertions.

- [ ] **Step 4: Commit**

```powershell
git add README.md apps/mobile/src/features/health/health-screen.tsx apps/mobile/src/features/health/health-screen.test.tsx
git commit -m "feat: adopt cave brand copy"
```

### Task 4: Rename the workspace package graph

**Files:**
- Create: `tests/workspace-identity.test.ts`
- Modify: `package.json`
- Modify: `apps/mobile/package.json`
- Modify: `apps/gateway/package.json`
- Modify: `packages/contracts/package.json`
- Modify: `packages/content/package.json`
- Modify: `packages/scenario-engine/package.json`
- Modify: `packages/test-fixtures/package.json`
- Modify: `apps/mobile/src/contracts-consumer.typecheck.ts`
- Modify: `apps/gateway/src/contracts-consumer.typecheck.ts`
- Modify: `packages/contracts/src/{index.test,public-surface.test}.ts`
- Modify: `packages/content/src/{catalog,index.test,load,validate}.ts`
- Modify: `packages/scenario-engine/src/{index.test,machine,machine.test,reducer}.ts`
- Modify: `packages/test-fixtures/src/{domain-flow.test,golden,index.test,practice}.ts`
- Regenerate: `pnpm-lock.yaml`

- [ ] **Step 1: Write the failing workspace identity test**

Create `tests/workspace-identity.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

const expectedPackageNames = new Map([
  ["package.json", "neijie-cave"],
  ["apps/mobile/package.json", "@cave/mobile"],
  ["apps/gateway/package.json", "@cave/gateway"],
  ["packages/contracts/package.json", "@cave/contracts"],
  ["packages/content/package.json", "@cave/content"],
  ["packages/scenario-engine/package.json", "@cave/scenario-engine"],
  ["packages/test-fixtures/package.json", "@cave/test-fixtures"]
]);

function trackedWorkspaceFiles() {
  return execFileSync(
    "git",
    ["ls-files", "package.json", "pnpm-lock.yaml", "apps", "packages"],
    { cwd: workspaceRoot, encoding: "utf8" }
  )
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
}

describe("CAVE workspace identity", () => {
  it("uses the approved package names", () => {
    for (const [path, expectedName] of expectedPackageNames) {
      const manifest = JSON.parse(
        readFileSync(resolve(workspaceRoot, path), "utf8")
      ) as { name: string };
      expect(manifest.name).toBe(expectedName);
    }
  });

  it("contains no active legacy package scope", () => {
    for (const path of trackedWorkspaceFiles()) {
      expect(readFileSync(resolve(workspaceRoot, path), "utf8")).not.toContain(
        "@hackathon/"
      );
    }
  });
});
```

- [ ] **Step 2: Run the test to prove RED**

```powershell
corepack pnpm exec vitest run tests/workspace-identity.test.ts
```

Expected: FAIL on `body-voice-hackathon`, all six `@hackathon/*` manifests, and legacy imports.

- [ ] **Step 3: Apply the exact package mapping**

Use this complete literal mapping in root scripts, all seven manifests, and every listed source/test import:

```text
body-voice-hackathon       -> neijie-cave
@hackathon/mobile          -> @cave/mobile
@hackathon/gateway         -> @cave/gateway
@hackathon/contracts       -> @cave/contracts
@hackathon/content         -> @cave/content
@hackathon/scenario-engine -> @cave/scenario-engine
@hackathon/test-fixtures   -> @cave/test-fixtures
```

Change the root test script so both root-level contract tests run:

```json
"test:ci-config": "vitest run tests"
```

Do not hand-edit `pnpm-lock.yaml`. Regenerate workspace links and lockfile:

```powershell
corepack pnpm install
```

- [ ] **Step 4: Run GREEN verification**

```powershell
corepack pnpm exec vitest run tests/workspace-identity.test.ts
corepack pnpm test:ci-config
corepack pnpm -r list --depth -1
corepack pnpm typecheck
corepack pnpm test
```

Expected: identity tests PASS; root tests PASS; seven workspaces list under the new names; typecheck and all workspace tests pass.

- [ ] **Step 5: Commit**

```powershell
git add package.json apps packages tests/workspace-identity.test.ts pnpm-lock.yaml
git commit -m "refactor: rename cave workspace packages"
```

### Task 5: Rename the Cloudflare Worker

**Files:**
- Modify: `tests/workspace-identity.test.ts`
- Modify: `apps/gateway/wrangler.jsonc`

- [ ] **Step 1: Add the failing Worker identity assertion**

Append inside the existing `describe` block:

```ts
it("uses the approved Worker name", () => {
  const wrangler = readFileSync(
    resolve(workspaceRoot, "apps/gateway/wrangler.jsonc"),
    "utf8"
  );

  expect(wrangler).toContain('"name": "neijie-cave-gateway"');
  expect(wrangler).not.toContain("body-voice-gateway");
});
```

- [ ] **Step 2: Run the test to prove RED**

```powershell
corepack pnpm exec vitest run tests/workspace-identity.test.ts
```

Expected: FAIL because Wrangler still declares `body-voice-gateway`.

- [ ] **Step 3: Implement and verify**

Set the Wrangler field to:

```jsonc
"name": "neijie-cave-gateway"
```

Run:

```powershell
corepack pnpm exec vitest run tests/workspace-identity.test.ts
corepack pnpm --filter @cave/gateway test
corepack pnpm --filter @cave/gateway build
```

Expected: identity test PASS, gateway 1/1 PASS, and Wrangler dry-run reports `neijie-cave-gateway`.

- [ ] **Step 4: Commit**

```powershell
git add tests/workspace-identity.test.ts apps/gateway/wrangler.jsonc
git commit -m "refactor: rename cave gateway"
```

### Task 6: Rename the content course identity

**Files:**
- Modify: `packages/content/src/validate.test.ts`
- Modify: `packages/content/data/courses.json`
- Modify: `packages/content/data/lessons.json`
- Modify: `packages/contracts/src/content.test.ts`

- [ ] **Step 1: Add the exact failing catalog assertion**

Add to `packages/content/src/validate.test.ts`:

```ts
it("uses the CAVE course identity and lesson back-reference", () => {
  const catalog = loadCatalog();

  expect(catalog.courses.map((course) => course.id)).toEqual(["cave-basics"]);
  expect(catalog.lessons.map((lesson) => lesson.courseId)).toEqual([
    "cave-basics"
  ]);
});
```

- [ ] **Step 2: Run the test to prove RED**

```powershell
corepack pnpm test:content
```

Expected: FAIL because the checked-in course and lesson still use `body-voice-basics`.

- [ ] **Step 3: Implement the complete ID replacement**

Apply these exact changes:

```text
packages/content/data/courses.json: courses[0].id = "cave-basics"
packages/content/data/lessons.json: lessons[0].courseId = "cave-basics"
packages/contracts/src/content.test.ts: course.id = "cave-basics"
```

Do not change course content, review status, source references, lesson IDs, scenario IDs, or Golden outcomes.

- [ ] **Step 4: Run GREEN verification**

```powershell
corepack pnpm test:contracts
corepack pnpm test:content
corepack pnpm validate:content:draft
corepack pnpm --filter @cave/test-fixtures test
```

Expected: contracts 19/19 PASS; content now has 11/11 PASS; draft validation PASS; fixture/domain 11/11 PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/content packages/contracts/src/content.test.ts
git commit -m "refactor: rename cave course identity"
```

### Task 7: Run the complete local and remote identity gate

**Files:**
- Modify: `docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md`

- [ ] **Step 1: Prove active legacy identifiers are absent**

Run:

```powershell
rg -n "@hackathon/|body-voice|bodyvoice|com\.shenicest\.bodyvoice|Body Voice" package.json pnpm-lock.yaml README.md apps packages
```

Expected: exit 1 with no matches. This scan intentionally excludes the approved migration design and historical Gate evidence.

- [ ] **Step 2: Run fresh Plan 01—02 technical verification**

Run every command separately and record its real exit code and test count:

```powershell
corepack pnpm -r list --depth -1
corepack pnpm test:ci-config
corepack pnpm verify:foundation
corepack pnpm --filter @cave/mobile expo:doctor
corepack pnpm --filter @cave/gateway test
corepack pnpm --filter @cave/gateway build
corepack pnpm test:contracts
corepack pnpm test:content
corepack pnpm --filter @cave/scenario-engine test
corepack pnpm --filter @cave/test-fixtures test
corepack pnpm validate:content:draft
git diff --check
git status --short
```

Expected: all exit 0. `git status --short` is empty.

- [ ] **Step 3: Reconfirm the honest production content blocker**

```powershell
corepack pnpm validate:content
```

Expected: exit 1 only for the seven unsigned draft entries, now including course `cave-basics`; keep Gate 02B as `content_review_pending`.

- [ ] **Step 4: Push the feature branch and verify CI**

```powershell
git push
$runId = gh run list --branch codex/plan-01-02-implementation --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $runId --exit-status
```

Expected: the latest feature-branch `foundation` job passes. Do not merge `main`.

- [ ] **Step 5: Record the exact migration evidence**

Append a dated identity-migration evidence block to the master roadmap containing the commits from Tasks 1—6, command exit codes/test counts, and the exact CI URL returned by GitHub. State that Gate 01A remains pass, Gate 01B still awaits EAS/iPhone, Gate 02A remains pass, and Gate 02B remains `content_review_pending`.

```powershell
git add docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md
git commit -m "docs: record cave identity evidence"
git push
```

Wait for the evidence commit's CI run and require it to pass before EAS initialization.

### Task 8: Create and link the new EAS project

**Files:**
- Modify: `apps/mobile/src/config/app-identity.test.ts`
- Modify: `apps/mobile/app.config.ts` (only the EAS-generated project link is allowed)
- Inspect: `apps/mobile/eas.json`

- [ ] **Step 1: Add the failing EAS-link assertion**

Add to `apps/mobile/src/config/app-identity.test.ts`:

```ts
it("is linked to one EAS project", () => {
  const projectId = resolveConfig("development").extra?.eas?.projectId;

  expect(projectId).toEqual(
    expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    )
  );
});
```

Run:

```powershell
corepack pnpm --filter @cave/mobile test -- app-identity.test.ts
```

Expected: FAIL because no EAS `projectId` exists yet.

- [ ] **Step 2: Confirm the account and create the project interactively**

From `apps/mobile`, run:

```powershell
corepack pnpm dlx eas-cli@latest whoami
corepack pnpm dlx eas-cli@latest init
```

Expected: `whoami` is `carter_wells`; the user explicitly confirms creating a new project named `cave` under owner `carter_wells`. If `cave` is occupied, stop without selecting a fallback.

- [ ] **Step 3: Configure only iOS and review the generated diff**

```powershell
corepack pnpm dlx eas-cli@latest project:info
corepack pnpm dlx eas-cli@latest build:configure --platform ios
git diff -- apps/mobile/app.config.ts apps/mobile/eas.json
```

Expected: project info reports owner `carter_wells` and slug `cave`; the diff adds one UUID `extra.eas.projectId` and preserves every approved identity. Reject any restored old slug/Bundle ID, any Android package, or unrelated profile changes.

- [ ] **Step 4: Run GREEN verification and commit**

```powershell
corepack pnpm --filter @cave/mobile test -- app-identity.test.ts
corepack pnpm --filter @cave/mobile exec expo config --type public
corepack pnpm --filter @cave/mobile expo:doctor
git diff --check
```

Expected: tests PASS, the EAS UUID assertion passes, approved identity remains intact, and Expo Doctor passes.

```powershell
git add apps/mobile/app.config.ts apps/mobile/eas.json apps/mobile/src/config/app-identity.test.ts
git commit -m "build: link cave eas project"
git push
```

Require the new feature-branch CI run to pass.

### Task 9: Register the iPhone, build, install, and record evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md`

- [ ] **Step 0: Run supplemental Expo Go acceptance while Apple Developer membership is pending**

This is an interim real-device check of the JavaScript bundle only. It does not replace the signed iOS Development Build, installation, or Metro-disconnected launch requirements below, and Gate 01B remains `external_pending` until those requirements are observed.

For SDK 54 on a physical iPhone, install or update Expo Go from the Apple App Store and use that SDK 54-compatible client for this supplemental check. Do not use the prior `sign.expo.dev` SDK 57 sideloading path. Expo Go does not satisfy the signed Development Build gate: it cannot replace the planned signed iOS Development Build, installation, or Metro-disconnected launch evidence, so Gate 01B remains `external_pending`.

From `apps/mobile`, run the Expo CLI shim explicitly so the existing `start --dev-client` package script remains unchanged:

```powershell
.\node_modules\.bin\expo.CMD start --go
```

After installing the SDK 54-compatible Apple App Store Expo Go build, open the QR code on the intended iPhone. Record the device model and iOS version from Settings, the compatible Expo Go installation outcome, whether the bundle opens without a red error, and the exact displayed product name, slogan, version, build, and environment. Expo Go may verify the current JavaScript shell and copy, but it cannot prove the configured bundle identifier, the app's Apple Team/signing, the app's device provisioning profile, EAS Development Build inclusion, installed standalone app behavior, or launch behavior after Metro stops.

If LAN discovery fails, stop this Metro process and retry the same check once with `--tunnel`; record which transport was actually used. Do not run `device:create` or an EAS build until the Apple Developer membership is active.

- [ ] **Step 1: Register the real iPhone interactively after membership becomes active**

From `apps/mobile`, run:

```powershell
corepack pnpm dlx eas-cli@latest device:create
```

The user enters Apple credentials only in the official prompt, selects the correct Apple Team, chooses website registration, opens the generated URL on the target iPhone, and installs the registration profile. Do not copy credentials into chat or logs.

- [ ] **Step 2: Verify the registered device without inventing evidence**

```powershell
corepack pnpm dlx eas-cli@latest device:list
```

Expected: the intended device appears. Record its displayed model and the iOS version read directly from Settings on that device. Device registration in Expo alone does not prove inclusion in an Apple provisioning profile; the subsequent build must include it.

- [ ] **Step 3: Create the iOS Development Build**

```powershell
corepack pnpm dlx eas-cli@latest build --platform ios --profile development
```

The user confirms the correct Apple Team and signing choices. Record the exact EAS build URL immediately. Wait for a successful build; a successful cloud build does not complete the device gate.

- [ ] **Step 4: Install and exercise the real device**

Install from the EAS build page using its Install/QR flow. Confirm iOS Developer Mode if required. Then:

```powershell
corepack pnpm --filter @cave/mobile start
```

Open the installed app, connect once to Metro, and verify `内界 CAVE`, the slogan, version `0.1.0`, build, and environment. Stop Metro, then launch the app twice from the Home Screen. Record exactly what is displayed on each launch. If the shell does not open without Metro, keep Gate 01B `external_pending`; do not convert the cloud-build result into a device pass.

- [ ] **Step 5: Record the final external evidence**

Update the roadmap with the EAS project URL, build URL, build commit, Apple Team choice (non-secret identifier only), device model, iOS version, install outcome, and both Metro-disconnected launch outcomes. Set Gate 01B to `pass` only if every planned real-device condition is observed; otherwise list the precise remaining condition.

```powershell
git add docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md
git commit -m "docs: record cave ios build evidence"
git push
$runId = gh run list --branch codex/plan-01-02-implementation --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $runId --exit-status
git diff --check
git status --short --branch
```

Expected: roadmap evidence is truthful, latest CI passes, and the feature branch is clean and tracks its remote. Do not merge `main`.

## Final acceptance matrix

- Local identity/config/workspace/Worker/content tests: must pass.
- Plan 01 technical Gate 01A: must remain `pass`.
- GitHub feature-branch CI: must pass at the final HEAD.
- EAS project: must be the new `carter_wells/cave` project.
- iOS Development Build: must have a real build URL and include the registered device.
- Real iPhone installation and two Metro-disconnected launches: must be reported from observation, never inferred.
- Android: must remain unconfigured and unbuilt in this migration.
- Gate 02A: must remain `pass` after `cave-basics` migration.
- Gate 02B: remains `content_review_pending` until a content owner signs the seven draft entries and Golden outcomes.

## Official EAS references

- EAS CLI project/device commands: `https://docs.expo.dev/eas/cli/`
- iOS physical-device development build: `https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/`
- iOS internal distribution and provisioning behavior: `https://docs.expo.dev/build/internal-distribution/`
