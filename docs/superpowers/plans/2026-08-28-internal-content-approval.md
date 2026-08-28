# Internal Content Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record ordinary copy as editor-reviewed by `annie`, distinguish expert content approved only for internal testing, disclose AI assistance inside Help, and let PR CI pass without weakening the production release gate.

**Architecture:** Extend the journey review state machine with `internal_test_approved` and add an `internal` validation mode. PR CI uses the internal mode, while `validate:content`, `verify`, and `verify:release` retain production semantics and reject internal-only expert approvals. The app disclosure remains presentation-only in the existing Welcome Help sheet.

**Tech Stack:** TypeScript, Zod, Vitest, Jest/React Native Testing Library, JSON content catalogs, pnpm, GitHub Actions.

---

## File map

- `packages/content/src/catalog.ts`: review-status TypeScript union.
- `packages/content/src/load.ts`: Zod schema for checked-in journey content.
- `packages/content/src/validate.ts`: draft/internal/production review semantics.
- `packages/content/src/validate-cli.ts`: exact CLI mode parsing.
- `packages/content/src/validate.test.ts`: validator regression tests.
- `packages/content/src/journey.test.ts`: checked-in review evidence assertions.
- `packages/content/data/journey-options.json`: 37 ordinary and 7 expert entries.
- `packages/content/data/journey-knowledge.json`: 3 expert entries.
- `packages/content/data/journey-practice.json`: 22 expert entries.
- `packages/content/data/journey-ui-copy.json`: 19 ordinary and 2 expert entries.
- `apps/mobile/src/features/journey/ui/pages/WelcomePage.tsx`: Help-only disclosure.
- `apps/mobile/src/features/journey/ui/pages/WelcomePage.test.tsx`: visibility regression test.
- `packages/content/package.json`, `package.json`: internal validation scripts; production release command remains unchanged.
- `.github/workflows/ci.yml`, `tests/ci-workflow.test.ts`: PR internal gate and release-gate assertions.

### Task 1: Model internal approval without weakening production validation

**Files:**
- Modify: `packages/content/src/catalog.ts`
- Modify: `packages/content/src/load.ts`
- Modify: `packages/content/src/validate.ts`
- Modify: `packages/content/src/validate-cli.ts`
- Test: `packages/content/src/validate.test.ts`

- [ ] **Step 1: Write failing validator tests**

Add tests that mutate one expert item and provide complete evidence:

```ts
function journeyReviewablesForTest(
  catalog: ReturnType<typeof loadCatalog>
): JourneyCopyMetadata[] {
  return [
    ...catalog.journey.options,
    ...catalog.journey.knowledge,
    ...catalog.journey.practice.phrases,
    ...catalog.journey.practice.responses,
    ...catalog.journey.practice.partnerResponses,
    ...catalog.journey.practice.safetyBranches,
    ...catalog.journey.practice.supportResources,
    ...catalog.journey.uiCopy.behaviorMapPoints,
    ...catalog.journey.uiCopy.attitudes,
    ...catalog.journey.uiCopy.communicationSections
  ];
}

function approveForInternalTest(item: JourneyCopyMetadata) {
  item.reviewStatus = "internal_test_approved";
  item.reviewer = "annie";
  item.reviewerRole = "内部测试审核人";
  item.reviewedAt = "2026-08-28T09:00:00+01:00";
  item.reviewedVersion = "2026-08-28-review-1";
  item.reviewConclusion = "仅内测通过；发布前仍需合格专家完成医疗、安全或性教育审核";
}

it("accepts complete internal approval in internal mode but rejects it in production", () => {
  const catalog = loadCatalog();
  for (const item of journeyReviewablesForTest(catalog)) {
    if (item.reviewStatus === "draft") {
      Object.assign(item, {
        reviewStatus: "reviewed",
        reviewer: "annie",
        reviewerRole: "产品与编辑审核人",
        reviewedAt: "2026-08-28T09:00:00+01:00",
        reviewedVersion: "2026-08-28-review-1",
        reviewConclusion: "产品与编辑审核通过"
      });
    } else if (item.reviewStatus === "expert_review_pending") {
      approveForInternalTest(item);
    }
  }

  expect(() => validateCatalog(catalog, { mode: "internal" })).not.toThrow();
  expect(issueCodes(() => validateCatalog(catalog, { mode: "production" })))
    .toContain("INTERNAL_TEST_APPROVAL_ONLY");
});

it("requires complete evidence for internal approval", () => {
  const catalog = loadCatalog();
  const item = catalog.journey.knowledge[0]!;
  item.reviewStatus = "internal_test_approved";
  expect(issueCodes(() => validateCatalog(catalog, { mode: "draft" })))
    .toContain("REVIEW_EVIDENCE_REQUIRED");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `corepack pnpm --filter @cave/content exec vitest run src/validate.test.ts`

Expected: TypeScript/test failure because `internal_test_approved` and mode `internal` are not accepted.

- [ ] **Step 3: Implement the minimal state and mode changes**

Use these exact unions:

```ts
export type JourneyReviewStatus =
  | "draft"
  | "expert_review_pending"
  | "internal_test_approved"
  | "reviewed"
  | "revision_required";

export type ContentValidationMode = "draft" | "internal" | "production";
```

Extend the Zod enums with `internal_test_approved`. Treat `reviewed` and `internal_test_approved` as evidence-bearing states. In `internal` mode reject `draft`, `expert_review_pending`, and `revision_required`. In `production` mode return `INTERNAL_TEST_APPROVAL_ONLY` for `internal_test_approved` and continue returning the existing codes for other non-production states. Parse only the exact CLI values `draft`, `internal`, and `production`; reject unknown modes instead of silently choosing production.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `corepack pnpm --filter @cave/content exec vitest run src/validate.test.ts`

Expected: all tests in `validate.test.ts` pass.

- [ ] **Step 5: Commit the validator change**

```bash
git add packages/content/src/catalog.ts packages/content/src/load.ts packages/content/src/validate.ts packages/content/src/validate-cli.ts packages/content/src/validate.test.ts
git commit -m "feat(content): distinguish internal expert approval"
```

### Task 2: Record the 90 approved content entries

**Files:**
- Modify: `packages/content/data/journey-options.json`
- Modify: `packages/content/data/journey-knowledge.json`
- Modify: `packages/content/data/journey-practice.json`
- Modify: `packages/content/data/journey-ui-copy.json`
- Test: `packages/content/src/journey.test.ts`

- [ ] **Step 1: Write a failing checked-in evidence test**

Add a test that flattens the four journey collections and asserts:

```ts
const catalog = loadCatalog();
const entries = [
  ...catalog.journey.options,
  ...catalog.journey.knowledge,
  ...catalog.journey.practice.phrases,
  ...catalog.journey.practice.responses,
  ...catalog.journey.practice.partnerResponses,
  ...catalog.journey.practice.safetyBranches,
  ...catalog.journey.practice.supportResources,
  ...catalog.journey.uiCopy.behaviorMapPoints,
  ...catalog.journey.uiCopy.attitudes,
  ...catalog.journey.uiCopy.communicationSections
];
const ordinaryEntries = entries.filter(({ reviewStatus }) => reviewStatus === "reviewed");
const expertEntries = entries.filter(
  ({ reviewStatus }) => reviewStatus === "internal_test_approved"
);

expect(ordinaryEntries).toHaveLength(56);
expect(expertEntries).toHaveLength(34);
expect(ordinaryEntries.every((item) =>
  item.reviewStatus === "reviewed"
  && item.reviewer === "annie"
  && item.reviewerRole === "产品与编辑审核人"
  && item.reviewedAt.startsWith("2026-08-28T")
  && item.reviewedVersion === "2026-08-28-review-1"
  && item.reviewConclusion === "产品与编辑审核通过"
)).toBe(true);
expect(expertEntries.every((item) =>
  item.reviewStatus === "internal_test_approved"
  && item.reviewer === "annie"
  && item.reviewerRole === "内部测试审核人"
  && item.reviewedAt.startsWith("2026-08-28T")
  && item.reviewedVersion === "2026-08-28-review-1"
  && item.reviewConclusion === "仅内测通过；发布前仍需合格专家完成医疗、安全或性教育审核"
)).toBe(true);
```

Classify ordinary versus expert entries from their original content requirements: all `MED`, `EDU`, and `REVIEW` entries and the two expert behavior options remain in the expert set; the remaining `UX` entries are ordinary.

- [ ] **Step 2: Run the catalog test and verify RED**

Run: `corepack pnpm --filter @cave/content exec vitest run src/journey.test.ts`

Expected: the new assertions report 56 draft and 34 expert-pending entries rather than approved records.

- [ ] **Step 3: Apply the review records mechanically**

Use the captured implementation timestamp `2026-08-28T09:56:30Z` for every `reviewedAt`, and update the four JSON files without changing ids, copy, source ids, order, or grouping. Ordinary fields use:

```json
{
  "reviewStatus": "reviewed",
  "reviewer": "annie",
  "reviewerRole": "产品与编辑审核人",
  "reviewedAt": "2026-08-28T09:56:30Z",
  "reviewedVersion": "2026-08-28-review-1",
  "reviewConclusion": "产品与编辑审核通过"
}
```

Expert internal-test fields use:

```json
{
  "reviewStatus": "internal_test_approved",
  "reviewer": "annie",
  "reviewerRole": "内部测试审核人",
  "reviewedAt": "2026-08-28T09:56:30Z",
  "reviewedVersion": "2026-08-28-review-1",
  "reviewConclusion": "仅内测通过；发布前仍需合格专家完成医疗、安全或性教育审核"
}
```

- [ ] **Step 4: Verify internal success and production refusal**

Run:

```bash
corepack pnpm --filter @cave/content exec vitest run src/journey.test.ts src/validate.test.ts
corepack pnpm --filter @cave/content exec tsx src/validate-cli.ts --mode internal
corepack pnpm --filter @cave/content exec tsx src/validate-cli.ts --mode production
```

Expected: tests and internal validation pass; production validation exits 1 with exactly 34 `INTERNAL_TEST_APPROVAL_ONLY` issues and no draft or expert-pending issues.

- [ ] **Step 5: Commit the review records**

```bash
git add packages/content/data/journey-options.json packages/content/data/journey-knowledge.json packages/content/data/journey-practice.json packages/content/data/journey-ui-copy.json packages/content/src/journey.test.ts
git commit -m "content: record internal catalog approval"
```

### Task 3: Add the Help-only AI disclosure

**Files:**
- Modify: `apps/mobile/src/features/journey/ui/pages/WelcomePage.tsx`
- Test: `apps/mobile/src/features/journey/ui/pages/WelcomePage.test.tsx`

- [ ] **Step 1: Write the failing visibility test**

```ts
test("shows AI editorial disclosure only inside Help", () => {
  render(<WelcomePage onStart={jest.fn()} resumeAvailable={false} />);
  expect(screen.queryByText(/部分页面内容由 AI 辅助生成/u)).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "帮助" }));

  expect(screen.getByText(/部分页面内容由 AI 辅助生成.*团队编辑审核/u)).toBeTruthy();
  expect(screen.getByText(/免责声明都不能代替.*专业审核/u)).toBeTruthy();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/ui/pages/WelcomePage.test.tsx`

Expected: failure because the Help sheet does not contain the AI disclosure.

- [ ] **Step 3: Add the exact Help text**

Append this selectable paragraph inside the existing `BottomSheet`, after the non-diagnosis paragraph and before local-first privacy:

```tsx
<Text selectable style={styles.body}>
  部分页面内容由 AI 辅助生成，并经团队编辑审核。AI 辅助、团队编辑审核和免责声明都不能代替医疗、安全及紧急支持内容所需的专业审核。
</Text>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/ui/pages/WelcomePage.test.tsx`

Expected: all WelcomePage tests pass and the closed Help sheet does not expose the disclosure in the landing-page query.

- [ ] **Step 5: Commit the disclosure**

```bash
git add apps/mobile/src/features/journey/ui/pages/WelcomePage.tsx apps/mobile/src/features/journey/ui/pages/WelcomePage.test.tsx
git commit -m "feat(mobile): disclose AI assistance in help"
```

### Task 4: Split PR internal validation from the release gate

**Files:**
- Modify: `packages/content/package.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/ci-workflow.test.ts`

- [ ] **Step 1: Write failing script and workflow assertions**

Assert these exact values:

```ts
expect(packageJson.scripts["validate:content:internal"]).toBe(
  "pnpm --filter @cave/content validate:content:internal"
);
expect(workflow).toContain("pnpm validate:content:internal");
expect(workflow).not.toContain("run: pnpm validate:content\n");
expect(packageJson.scripts.verify).toContain("pnpm validate:content");
expect(packageJson.scripts["verify:release"]).toContain("pnpm verify");
```

- [ ] **Step 2: Run the CI test and verify RED**

Run: `corepack pnpm exec vitest run --root tests ci-workflow.test.ts`

Expected: failure because the internal script and workflow command do not exist.

- [ ] **Step 3: Add internal scripts and update the PR workflow**

Add `"validate:content:internal": "tsx src/validate-cli.ts --mode internal"` to the content package and `"validate:content:internal": "pnpm --filter @cave/content validate:content:internal"` to the root. Rename the workflow step to `Validate internal-test content` and run `pnpm validate:content:internal`. Leave root `verify` and `verify:release` unchanged so both still traverse production validation.

- [ ] **Step 4: Run the focused CI and content checks**

Run:

```bash
corepack pnpm exec vitest run --root tests ci-workflow.test.ts
corepack pnpm validate:content:internal
corepack pnpm validate:content
```

Expected: CI test and internal validation pass; production validation exits 1 only for the 34 internal-test expert approvals.

- [ ] **Step 5: Commit the gate split**

```bash
git add packages/content/package.json package.json .github/workflows/ci.yml tests/ci-workflow.test.ts
git commit -m "ci: separate internal and release content gates"
```

### Task 5: Full verification, PR update, and conditional merge

**Files:**
- Verify all modified files from Tasks 1–4.

- [ ] **Step 1: Run fresh engineering verification**

Run:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm test:ci-config
corepack pnpm validate:content:internal
corepack pnpm build:gateway
corepack pnpm --filter @cave/mobile expo:doctor
corepack pnpm --filter @cave/mobile export:ios
corepack pnpm security:scan-bundle
corepack pnpm security:audit
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Reconfirm the production release block**

Run: `corepack pnpm validate:content`

Expected: exit 1 with exactly 34 `INTERNAL_TEST_APPROVAL_ONLY` issues. This failure is required until qualified expert review is recorded.

- [ ] **Step 3: Push the PR branch**

Run: `git push origin codex/non-account-p0-p1-fixes`

Expected: PR #20 updates to the new head.

- [ ] **Step 4: Inspect GitHub checks and failed logs**

Run: `gh pr checks 20 --watch --interval 10`

Expected: all PR checks pass. If any check fails, obtain and inspect the failed run ids with:

```powershell
$caveFailedRunIds = gh run list --branch codex/non-account-p0-p1-fixes --status failure --limit 2 --json databaseId --jq '.[].databaseId'
$caveFailedRunIds | ForEach-Object { gh run view $_ --log-failed }
```

Fix the root cause and repeat verification before pushing.

- [ ] **Step 5: Merge only after the green head is confirmed**

Run: `gh pr merge 20 --squash --delete-branch`

Expected: GitHub reports PR #20 merged. Do not use admin bypass or merge with pending/failed checks.
