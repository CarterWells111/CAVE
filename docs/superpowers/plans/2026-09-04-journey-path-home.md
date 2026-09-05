# Journey path home implementation plan

**Goal:** Replace the long-term home with six freely selectable, three-page journey samples and a separate optional first-overnight scenario, preserving CAVE styling and existing private data.

**Local-only:** Work on `codex/journey-path-home`, based on freshly fetched `origin/main` (`4f88767`). Do not push, open a PR, deploy, or change the original checkout.

## Approved experience

- Preserve welcome, adult declaration, address preference, and preface. Their default destination becomes the map, not the first formal journey page.
- Six circular icons labelled 旅程 01–06 and 样板 form a vertically scrolling S-shaped path. All are accessible without unlocking or scoring.
- A warm rounded-square moon badge beside nodes 2–3 opens 第一次过夜, labelled 情景演绎 · 可选体验. This is the entire existing five-page journey, not just its overnight page.
- Home keeps a compact brand/account header and existing bottom navigation. Existing cards/history remain under 我的; journal/practice retain their tabs. Do not read private cards or journal metadata on the map.
- Each sample has introduction, content-placeholder, and end pages, using existing fonts, colors, progress and navigation patterns. Every entry starts at page one. No answers, completion records, persisted progress, or private-data writes.
- The review hub's full-review action becomes 选择旅程 and opens the map without replacing an active draft.
- The scenario resumes an active draft; only a deliberate scenario entry initializes a new experience when there is none. Existing saved records and restart confirmation remain unchanged.
- Existing completed users can access the map with no active draft. Existing onboarding-complete drafts need not complete the scenario to access the map. Adult revocation hides mounted protected sample content.

## Implementation sequence

1. Create isolated worktree; install locked dependencies; run mobile test baseline.
2. TDD the entry catalog, responsive map and independent three-page sample UI. Reuse existing Expo/React Native components and dependencies. Add `/explore/[journeyId]` routing with a guarded layout; unknown IDs show a safe map-return action.
3. TDD home/onboarding/review integration. Keep explicit map-versus-scenario navigation intent through onboarding. Update legacy tests whose expected destination intentionally changes; preserve safety/data checks.
4. Independently review specification compliance, then code quality; address findings with regression tests.
5. Run full mobile tests, typecheck, lint, iOS export, source policy and diff checks. Record actual results and remaining device-only checks. Keep changes local.

## Acceptance checks

- Exactly six samples plus one scenario; all seven work without prerequisite lesson completion.
- Samples display matching IDs and 1/3–3/3 progress, support next/back/exit and hardware back, reset between entries, and never mutate scenario state.
- New onboarding lands on the map; old incomplete/complete journeys remain accessible without redirect loops or silent resets.
- Selecting a journey from reviews is read-only. Existing scenario continuation, saving, history and restart work.
- Invalid URLs, declaration revocation, async failures and rapid repeated taps fail safely.
- Small widths, large font scale, light/dark themes and reduced motion keep nodes, badge and navigation legible and nonoverlapping. Touch targets are at least 44 points; icons have accessible labels.

## Boundaries

No backend API, database migration, cloud sync, formal lesson content, generated illustrations, dependency upgrades, website changes, or production deployment.

## Verification log

- Environment: Node 24.15.0, pnpm 10.34.5; locked install, no dependency or lockfile changes.
- Baseline on fetched main: 156 suites / 1,261 mobile tests passed.
- TDD: catalog/map/pager tests failed before implementation and passed afterward; explicit-login intent, scenario restart intent, and retained-home blur regressions each observed failing before the corresponding fix.
- Final mobile full regression after all review fixes: 161 suites / 1,318 tests passed (100.997 seconds).
- Mobile typecheck (including typed route generation): passed.
- Mobile lint: passed.
- iOS export: passed; Metro bundled 1,362 modules and produced the local Hermes bundle in ignored `apps/mobile/dist`. No upload or deployment.
- Mobile source policy: passed (205 files). Tracked diff whitespace check passed.
- Independent specification review: passed for the complete change; focused 8 suites / 76 tests passed. Initial component quality review found no blocking issues; its measured-container-width coverage note was addressed.
- Final whole-change quality review: passed; independent focused 6 suites / 67 tests passed. The only minor finding (compact account keyboard-focus feedback) was fixed after a failing regression, then independently verified (5/5 HomeScreen tests). No outstanding review findings.
- Original checkout remains on `codex/p0-device-readiness` at `bbaf203`, including its pre-existing untracked artifacts. New branch/worktree and the uncommitted implementation are preserved locally, with no commit, push, PR, merge, or deployment.

## Device checks still required

Automated tests cover 320/390-point windows, large font scales, measured narrow containers, both themes, reduced motion, hardware-back callbacks and real-router lifecycle. They are not a native visual or assistive-technology acceptance test. On a device, verify the S path and optional badge spacing, safe areas and bottom navigation, VoiceOver/TalkBack order, font scaling and repeated entry/back behavior. No physical-device or simulator visual check was available in this Windows session.

## Filling in the six journeys later

The six stable IDs, labels, icons and three-page sample texts are centralized in `apps/mobile/src/features/explore/catalog.ts`. The pager is local-only and separate from the existing five-page scenario; replacing sample content later does not require changing the old draft schema.
