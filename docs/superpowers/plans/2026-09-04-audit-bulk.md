# Bulk audit compatibility implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task, followed by independent code review.

**Goal:** Restore dependable production dependency auditing without migrating the installation toolchain or weakening security gates.

**Architecture:** Keep Node 22.23.2 and pnpm 10.34.5 for installations and lifecycle commands. Put the pinned pnpm 11 audit CLI in a dedicated tooling workspace so its binaries do not shadow root pnpm. A small Node launcher invokes only `audit --prod --audit-level high`, disables automatic package-manager delegation, and propagates failures. Tests exercise the real CLI against a local HTTP registry with a historical v9 lockfile.

**Tech Stack:** Node 22, pnpm 10.34.5 (install), pnpm 11.25.0 (audit only), Vitest, node:http, YAML.

## Approved scope and rationale

The user approved an isolated worktree and audit-only tooling fix. pnpm's [11.0 release notes](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/11.0.md) identify the legacy audit endpoint retirement and the supported bulk endpoint. Repeated HTTP timeouts are not evidence of a clean audit. Preserve existing two GHSA exemptions, production dependency coverage, high severity exit threshold, Node version, production content review and device acceptance states.

## Task 1: Regression tests

- [ ] Run existing root tests: `pnpm test:ci-config` (all pass before changes).
- [ ] Add `tests/security-audit.test.ts` using a temporary synthetic v9 lockfile and a local HTTP server. Assert the real subprocess posts exclusively to `/-/npm/v1/security/advisories/bulk` and includes direct, transitive, workspace-linked and optional production dependencies, but not development-only packages.
- [ ] Test clean, moderate, high, critical and existing-exempted advisories; high/critical must fail, a different high advisory must not inherit an exemption. HTTP 500, invalid JSON/shape and missing lockfile must fail. Root manifest and lockfile bytes must remain unchanged after audit.
- [ ] Change the existing command contract in `tests/security-config.test.ts` to expect `node scripts/security-audit.mjs`. Run tests and confirm the current command fails the new contract before implementation.

## Task 2: Minimal implementation

- [ ] Add `tools/security-audit/package.json` with private name `@cave/security-audit-tool`, version `0.0.0`, and exact dev dependency `pnpm: 11.25.0`. Add only this path to `pnpm-workspace.yaml` and update the root lockfile using pnpm 10; existing package resolutions must not change.
- [ ] Create `scripts/security-audit.mjs`: locate the dedicated installed CLI, disable pnpm self-delegation, invoke the real audit CLI from the requested working directory, inherit normal environment/config, and return nonzero on missing prerequisites, spawn errors or nonzero/signal termination. The root entry point uses the repository root and cannot switch to a smaller audit scope via arguments.
- [ ] Set root `security:audit` to `node scripts/security-audit.mjs`; do not change the internal/release checks, audit policy or installer pin.
- [ ] Run `pnpm test:ci-config` and the real `pnpm security:audit`. Inspect the installed CLI implementation and captured HTTP request to prove bulk is used and pnpm 10 delegation is disabled.

## Review-driven hardening

The independent reviewer reproduced upstream pnpm silently dropping invalid advisory IDs/severities. Three additional real CLI tests reproduced exit 0 for invalid ID, severity and version range before the fix. `patches/pnpm@11.25.0.patch` adds input checks to the existing response validator; it does not alter valid advisory matching or exemptions. Tests now capture output and require the synthetic advisory identity as well as exit 1 for blocking findings.

## Task 3: Verification and integration

Local verification on 2026-09-04: frozen install succeeded; independent review approved the hardening; 1,689 tests passed. The complete internal gate executed all 15 checks: 14 passed, but the final official npm audit returned HTTP 503 and then timed out after retries (exit 1). This run is **failed**, not a clean audit. Evidence is in the isolated worktree's `outputs/p0-readiness/verification.json` and `.log`; it records the pre-commit revision with tracked changes. Push the verified fix to the existing PR for exact-commit CI, and do not merge until the real audit and all other checks succeed.

- [ ] Update `docs/development/verification.md` with the audit-only pin, toolchain separation, scan scope and operational failure semantics.
- [ ] Run `pnpm install --frozen-lockfile`, `pnpm verify:internal`, `git diff --check` and independent review of the isolated changes; fix any defects and rerun affected checks.
- [ ] Commit only the isolated audit change, fast-forward push `HEAD:codex/p0-device-readiness` (never force), and update PR #46 evidence.
- [ ] Wait for all checks on the latest PR head and integrated base, review unresolved comments, then merge normally with expected head SHA. Verify merged state/tree; preserve the user's other work. Pause the recurring monitor only once merge is confirmed.
