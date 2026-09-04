# CI bootstrap cache implementation plan

**Goal:** Reuse tool downloads and remove redundant installer audit latency without skipping project verification.

**Approved design:** The user approved fixed tooling and download-cache reuse on GitHub-hosted runners. Keep pnpm/action-setup v6 and the pinned pnpm 10.34.5 installer. Its upstream self-installer executes `npm ci`, inherits step environment, and removes the destination directory; cache npm's content-addressed download cache, not that rebuilt directory. Scope `npm_config_audit=false`, `npm_config_fund=false` and `npm_config_prefer_offline=true` to the bootstrap step only. The independent production audit remains mandatory and always queries the registry. Keep the existing pnpm dependency store cache, frozen installation, all 15 checks, both CI triggers, and release policy unchanged.

**Alternatives:** Caching the installed destination is ineffective because upstream deletes it. Self-hosted runners add maintenance and isolation obligations and are outside this request. Splitting jobs and changing triggers are deferred to keep this optimization narrow.

**Files:** `.github/workflows/ci.yml` owns bootstrap configuration; `tests/ci-bootstrap-cache.test.ts` verifies parsed YAML structure and safety boundaries; `docs/development/verification.md` describes cache behavior and evidence limits.

## Execution

- [ ] Add YAML-structure tests for a cache step before pnpm, a toolchain-specific key, exact content-cache path, installer-only environment, no cache-hit skip of setup/install/verification, and unchanged mandatory production audit.
- [ ] Run `pnpm exec vitest run --root tests ci-bootstrap-cache.test.ts`; confirm missing cache and bootstrap environment fail before implementation.
- [ ] Add `actions/cache@v4` for `${{ runner.temp }}/cave-npm-bootstrap/_cacache`, key `npm-bootstrap-v1-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('.github/workflows/ci.yml', '.nvmrc') }}`. Set only the pnpm step's npm cache directory to `${{ runner.temp }}/cave-npm-bootstrap` and the three flags above. Do not cache credentials, logs, node_modules, exported bundles or audit results.
- [ ] Run all root contract/regression tests under pinned Node 22 and pnpm 10, plus `git diff --check`; obtain independent review before pushing.
- [ ] Update documentation, commit only scoped files, and push to PR46 without force. Check both cold/warm cache behavior where available and collect complete CI artifacts and actual setup timings. Do not claim warm-cache improvement until a cache hit is observed.
- [ ] Re-check new head/base and all checks before the already-authorized merge; protect the original dirty workspace. Resume the monitor with the new commit and evidence.

## Evidence baseline

PR CI33853322124 attempt2: bootstrap 329 seconds, project dependency installation 10 seconds, full internal gate 212 seconds. Push CI33853318752 attempt2: bootstrap 423 seconds. The upstream bootstrap log includes a retired npm audit endpoint notice. Network time varies; no fixed performance target is promised. Bootstrap audit is not a substitute for project audit and its removal must not leak to later steps.
