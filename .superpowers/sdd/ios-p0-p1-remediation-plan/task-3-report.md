# Task 3 report — journey state and iOS accessibility

## Implementation

- Replaced fragmented overnight writes with one `save-overnight-progress` command. It atomically carries `stage`, expectation IDs, concern IDs, note, and `completed`; completion adds the idempotent overnight progress key in the same reduced/persisted snapshot.
- The overnight UI now writes an atomic snapshot before opening a stage and after every selection. A failed write keeps navigation/stage advancement blocked, exposes an announced retry, and retains the local selection for retry/final save.
- Corrected the stale canonical-route assertion to accept the intentional reflection behavior-answer/edit wiring.
- Displayed every catalog attitude's feedback under all six attitude choices. It remains visible if a behavior save fails.
- Added the root `MotionPreferencesProvider` and `useReducedMotion`, backed by `AccessibilityInfo.isReduceMotionEnabled()` and `reduceMotionChanged`, with a static **true** (no-motion) fallback and subscription cleanup. Core buttons/chips/actions, sheets, background, behavior cards, reflection cards, and journey overlays honor it internally.
- Restored VoiceOver focus to the behavior-card trigger after save/return. Added labeled, pannable 100–200% anatomy image viewport plus image load status, error state, and retry.
- Added the exact pnpm `allowBuilds` booleans for `esbuild`, `unrs-resolver`, and `workerd`, with security coverage that rejects wildcard/placeholder allowlists.

## Locked postinstall inspection

Inspected installed packages before setting `allowBuilds`:

- `esbuild@0.28.1`: `node install.js`
- `unrs-resolver@1.12.2`: `node postinstall.js`
- `workerd@1.20260825.1`: `node install.js`

Only those exact package names are enabled, each with literal `true`.

## TDD record

### Overnight atomic command

RED:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/features/journey/domain/reducer.test.ts src/features/journey/application/page-controllers.test.ts src/features/journey/canonical-routes.integration.test.ts
```

Expected RED observed: reducer returned `undefined` for the new command and controller assertions received the old two-command `save-overnight` plus `record-point-event` sequence.

GREEN:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/features/journey/ui/pages/OvernightPage.test.tsx src/features/journey/application/journey-application-service.test.ts src/features/journey/domain/reducer.test.ts src/features/journey/application/page-controllers.test.ts src/features/journey/canonical-routes.integration.test.ts
```

Observed: 5 suites passed, 64 tests passed.

### Reduced-motion preferences

RED:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/core/design/motion-preferences.test.tsx
```

Expected RED observed: `Cannot find module './motion-preferences'`.

GREEN: same command after implementation.

Observed: 1 suite passed, 2 tests passed.

### Catalog attitude feedback

RED:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/features/journey/ui/pages/behavior-map-page.test.tsx
```

Expected RED observed: the six catalog feedback strings were absent.

GREEN:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/features/journey/ui/pages/behavior-map-page.test.tsx
```

Observed: 11 tests passed, including failed-save feedback retention and trigger-focus restoration.

### Anatomy image viewport/error retry

RED:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/features/journey/ui/pages/BodyKnowledgePage.test.tsx
```

Expected RED observed: no `body-diagram-viewport` existed.

GREEN: same command after implementation.

Observed: 10 tests passed.

### Build-script allowlist

RED:

```powershell
& '.\node_modules\.bin\vitest.cmd' run --root tests security-config.test.ts
```

Expected RED observed: missing `allowBuilds:`.

GREEN: same command after implementation.

Observed: 1 file passed, 7 tests passed.

## Final verification

```powershell
& '..\..\node_modules\.bin\tsc.cmd' --noEmit -p tsconfig.json
& '..\..\node_modules\.bin\eslint.cmd' .
```

Both exited 0.

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand --silent
```

Observed: 105 suites passed, 779 tests passed, 0 snapshots, exit 0.

## Self-review

- Verified no Android configuration/code was added. The existing iOS-only app identity remains untouched.
- Did not add a root icon or `assets/icon.png`; did not change the clean `expo-env.d.ts`.
- Kept Task 4 final-page/export work out of scope.
- Checked the full mobile suite after the focused red/green cycles. Reflection tests now wait for their actual async UI settlements; the prior React `act(...)` warnings are absent.

## Reviewer remediation amendment

- Motion now fails safe to reduced motion, preserves live preference changes/cleanup, and never conditionally calls `useReducedMotion` when merging overrides.
- Failed overnight snapshots lock stage changes and Continue until the exact snapshot retry succeeds; a failed requested expansion resumes only after retry success.
- `BottomSheet` and `SourceDrawer` now accept `returnFocusRef` alongside legacy callbacks. Production callers connect body consent/source, communication editing, reflection storage/clear, welcome help, journey options, and overnight source actions.
- Communication edit/delete/restore accessibility labels include each section title. Editor close/save returns focus to its trigger.
- The diagram is an accessibility image and uses native iOS `ScrollView.zoomScale` with native panning; no image scale transform remains.
- Static behavior/reflection paths directly change content, avoiding both flip timing calls and `rotateY`; `JourneyChoice` suppresses its pressed scale in static mode. Reflection and behavior galleries restore initiating-card focus.
- Security coverage parses the YAML allowlist, requires the exact three literal-true keys, and rejects a fourth key.

### Amendment TDD evidence

RED before the amendment:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/core/design/motion-preferences.test.tsx src/core/ui/overlays.test.tsx src/features/journey/ui/pages/BodyKnowledgePage.test.tsx src/features/journey/ui/pages/OvernightPage.test.tsx src/features/shell/ui/SavedCardEditScreen.test.tsx
```

Observed: 5 suites failed, 12 assertions failed (fail-safe motion, focus-return contract, native image zoom/role, overnight lock/retry, and titled draft actions).

GREEN:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/core/design/motion-preferences.test.tsx src/core/ui/overlays.test.tsx src/core/ui/echo-background.test.tsx src/features/journey/ui/components/JourneyChoice.test.tsx src/features/journey/ui/pages/WelcomePage.test.tsx src/features/journey/ui/pages/BodyKnowledgePage.test.tsx src/features/journey/ui/pages/OvernightPage.test.tsx src/features/journey/ui/pages/reflection-page.test.tsx src/features/journey/ui/pages/behavior-map-page.test.tsx src/features/journey/ui/JourneyRouteScreen.test.tsx src/features/shell/ui/SavedCardEditScreen.test.tsx
```

Observed: 11 suites passed, 88 tests passed.

```powershell
& '..\..\node_modules\.bin\tsc.cmd' --noEmit -p tsconfig.json
& '..\..\node_modules\.bin\eslint.cmd' .
& '.\node_modules\.bin\vitest.cmd' run --root tests security-config.test.ts
```

Observed: TypeScript and ESLint exited 0; focused security Vitest passed 1 file / 8 tests. The first sandboxed Vitest attempt was blocked with `spawn EPERM`; the approved rerun completed normally.

## Concerns

`pnpm --filter @cave/mobile test` and `expo lint` attempted a pnpm install against the shared worktree junction and aborted in non-interactive mode. I therefore ran the same installed Jest/TypeScript/ESLint executables directly, with successful results above. Focused Vitest needed an unsandboxed worker spawn; it passed after approval.

This amendment validates iOS-facing props and focus calls in React Native tests; it does not claim physical-device VoiceOver, pinch, or pan verification.

## Batch 4 addendum — final preparation and private export

This addendum follows the later approved batch-4 scope and preserves the Task 1–3 work above.

### Implementation

- Restored the active sixth journey screen with the private-preparation checklist, seven pending sharing decisions, warm-paper preview, local save, deliberate copy/image actions, and a handwriting alternative.
- Communication fields start and return to `pending`; editing an already-included field also returns it to `pending`. The export selector remains `included && !needsReview`.
- Preview, clipboard, and PNG save consume one frozen `CommunicationCardExportModel`. A local content change discards that snapshot and requires a fresh preview/confirmation before export.
- Clipboard writes are behind an explicit warning and a second confirmation. Photo saving likewise warns about Photos/iCloud before the user confirms.
- Old saved cards remain non-exportable until their current sharing-policy re-confirmation is persisted. The saved-card detail then exposes local copy/image controls.
- The iOS-only Media Library adapter requests add-only permission only when saving, accepts `limited` add-only permission, uses `saveToLibraryAsync`, and never reads the photo library. Permanent denial offers Settings only as a later user action.
- Added the Expo Media Library iOS permission strings and updated the threat model plus data classification.
- Incorporated the batch-3 focus timing fix: `BottomSheet` restores focus from native `Modal.onDismiss`; `SourceDrawer` remains mounted until that callback; BodyKnowledge preserves distinct source-trigger refs.

### TDD evidence

Initial final-page RED:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/features/journey/ui/pages/FinalPreparationPage.test.tsx
```

Observed: the new test could not find `只给自己看的准备` (the prior sixth screen had no restored private-preparation/export UI).

Initial legacy-card RED:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/features/shell/ui/CardDetailScreen.test.tsx
```

Observed: the new test could not find the required legacy re-confirmation text/control.

Image-adapter RED after changing the behavioral expectation:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/features/journey/infrastructure/expo-card-image-adapter.test.ts
```

Observed: two failures: the adapter still called `createAssetAsync`, and a `limited` add-only permission was rejected.

GREEN before the dependency-link failure:

```powershell
& '.\node_modules\.bin\jest.cmd' --runInBand src/features/journey/infrastructure/expo-card-image-adapter.test.ts src/features/journey/ui/pages/FinalPreparationPage.test.tsx src/features/shell/ui/CardDetailScreen.test.tsx src/features/journey/canonical-routes.integration.test.ts src/features/journey/journey-production-flow.integration.test.tsx
```

Observed: 5 suites passed, 36 tests passed. This included tests for limited/denied/permanent denial behavior, pre-clipboard confirmation, pending restoration after delete, legacy re-confirmation, and the active route wiring. The later added frozen-snapshot reuse and pending-after-edit assertions are present in the test file but require the coordinator's dependency restore before their first green rerun.

### Verification concern

After that green run, a `pnpm --filter @cave/mobile typecheck` invocation attempted to recreate the shared root `node_modules` and aborted in its noninteractive supply-chain policy check. A follow-up install was stopped at the coordinator's instruction. The dependency links are therefore unavailable in this worktree at handoff, so the final focused Jest rerun, mobile TypeScript, and ESLint remain for the main session to rerun after it restores dependencies. `git diff --check` exits cleanly. No physical-device Photos/iCloud/VoiceOver claim is made.

### Batch 4 review correction

- Saved-card reading remains complete and local, but its paper is no longer a PNG capture target. Copy and PNG consume the same frozen confirmed-export model, which contains only `included && !needsReview` sections; a mixed private canary capture test exercises this boundary.
- A text edit now changes an included journey or saved-card section to `pending` in the persisted domain result, not merely in local UI state. Domain and saved-card tests cover the transition.
- Final-page image export waits for queued writes and refuses export after a failed queued write. “Save for myself” now follows the same coordinator and retry/error state. Permanent denial exposes Settings only as a user-pressed recovery control.
- `granularPermissions` was removed from the iOS Media Library plugin configuration. Focused Jest (7 suites/58 tests), mobile TypeScript, and ESLint all passed for this correction.
