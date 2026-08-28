# GitHub Actions Node 24 Runtime Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the GitHub Actions Node.js 20 runtime warning while preserving the repository's Node.js 22 and pnpm 10.34.5 application toolchain.

**Architecture:** Treat action-runtime versions as tested workflow configuration. First make the repository tests require the supported action majors, then update the CI and CodeQL YAML files with the smallest matching change.

**Tech Stack:** GitHub Actions YAML, Vitest, pnpm 10.34.5, Node.js 22

---

### Task 1: Add regression coverage for supported action runtimes

**Files:**
- Modify: `tests/ci-workflow.test.ts`
- Modify: `tests/security-config.test.ts`

- [ ] **Step 1: Update the CI workflow expectations**

Replace the old action-major assertions in `tests/ci-workflow.test.ts` with:

```ts
expect(workflow).toMatch(
  /^\s*(?:-\s+)?uses:\s+actions\/checkout@v7(?:\s+#.*)?$/mu
);
expect(workflow).toMatch(
  /^\s*(?:-\s+)?uses:\s+pnpm\/action-setup@v6(?:\s+#.*)?$/mu
);
expect(workflow).toMatch(
  /^\s*(?:-\s+)?uses:\s+actions\/setup-node@v7(?:\s+#.*)?$/mu
);
expect(workflow).not.toMatch(
  /^\s*(?:-\s+)?uses:\s+(?:actions\/checkout|actions\/setup-node|pnpm\/action-setup)@v4(?:\.\d+)*(?:\s+#.*)?$/mu
);
```

- [ ] **Step 2: Add the CodeQL checkout assertion**

Inside `runs JavaScript and TypeScript CodeQL analysis` in `tests/security-config.test.ts`, add:

```ts
expect(workflow).toMatch(
  /^\s*(?:-\s+)?uses:\s+actions\/checkout@v7(?:\s+#.*)?$/mu
);
expect(workflow).not.toMatch(
  /^\s*(?:-\s+)?uses:\s+actions\/checkout@v4(?:\.\d+)*(?:\s+#.*)?$/mu
);
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
pnpm exec vitest run --root tests tests/ci-workflow.test.ts tests/security-config.test.ts
```

Expected: FAIL because `.github/workflows/ci.yml` and `.github/workflows/codeql.yml` still reference the old `v4` action majors.

- [ ] **Step 4: Commit the failing regression tests**

```bash
git add tests/ci-workflow.test.ts tests/security-config.test.ts
git commit -m "test(ci): require Node 24 action runtimes"
```

### Task 2: Upgrade the workflow actions

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/codeql.yml`
- Test: `tests/ci-workflow.test.ts`
- Test: `tests/security-config.test.ts`

- [ ] **Step 1: Upgrade CI action majors**

In `.github/workflows/ci.yml`, use exactly:

```yaml
- name: Check out repository
  uses: actions/checkout@v7

- name: Set up pnpm
  uses: pnpm/action-setup@v6
  with:
    version: "10.34.5"

- name: Set up Node.js
  uses: actions/setup-node@v7
  with:
    node-version: "22"
    cache: pnpm
```

- [ ] **Step 2: Upgrade CodeQL checkout**

In `.github/workflows/codeql.yml`, change only the checkout step to:

```yaml
- uses: actions/checkout@v7
```

Keep both `github/codeql-action/*@v4` references unchanged; CodeQL v4 is already the supported action major and is not part of the Node.js 20 warning.

- [ ] **Step 3: Run the focused tests and verify GREEN**

Run:

```bash
pnpm exec vitest run --root tests tests/ci-workflow.test.ts tests/security-config.test.ts
```

Expected: both test files pass.

- [ ] **Step 4: Search for remaining deprecated references**

Run:

```bash
rg -n "actions/checkout@v4|actions/setup-node@v4|pnpm/action-setup@v4" .github tests
```

Expected: no matches and exit code 1 from `rg` because the deprecated references are absent.

- [ ] **Step 5: Commit the workflow upgrade**

```bash
git add .github/workflows/ci.yml .github/workflows/codeql.yml
git commit -m "ci: upgrade actions to Node 24 runtimes"
```

### Task 3: Verify the branch

**Files:**
- Verify: `.github/workflows/ci.yml`
- Verify: `.github/workflows/codeql.yml`
- Verify: `tests/ci-workflow.test.ts`
- Verify: `tests/security-config.test.ts`

- [ ] **Step 1: Run all repository configuration tests**

```bash
pnpm test:ci-config
```

Expected: 8 test files and 83 tests pass.

- [ ] **Step 2: Run formatting and whitespace checks**

```bash
git diff origin/main --check
```

Expected: no output and exit code 0.

- [ ] **Step 3: Inspect the final diff and branch status**

```bash
git diff --stat origin/main
git diff origin/main -- .github/workflows/ci.yml .github/workflows/codeql.yml tests/ci-workflow.test.ts tests/security-config.test.ts
git status --short --branch
```

Expected: only the design, plan, two workflow files, and two workflow test files differ from `origin/main`; the working tree is clean after commits.

- [ ] **Step 4: Push and validate GitHub-hosted execution**

```bash
git push -u origin codex/github-actions-node24
```

Create a PR, wait for CI and CodeQL, and verify the completed job has no annotation stating that Node.js 20 is deprecated for `actions/checkout`, `actions/setup-node`, or `pnpm/action-setup`.
