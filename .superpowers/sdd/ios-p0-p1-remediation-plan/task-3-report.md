# Task 3 report — journey state and iOS accessibility

## Implementation

- Replaced fragmented overnight writes with one `save-overnight-progress` command. It atomically carries `stage`, expectation IDs, concern IDs, note, and `completed`; completion adds the idempotent overnight progress key in the same reduced/persisted snapshot.
- The overnight UI now writes an atomic snapshot before opening a stage and after every selection. A failed write keeps navigation/stage advancement blocked, exposes an announced retry, and retains the local selection for retry/final save.
- Corrected the stale canonical-route assertion to accept the intentional reflection behavior-answer/edit wiring.
- Displayed every catalog attitude's feedback under all six attitude choices. It remains visible if a behavior save fails.
- Added the root `MotionPreferencesProvider` and `useReducedMotion`, backed by `AccessibilityInfo.isReduceMotionEnabled()` and `reduceMotionChanged`, with a static false fallback and subscription cleanup. Core buttons/chips/actions, sheets, background, behavior cards, reflection cards, and journey overlays honor it internally.
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

## Concerns

`pnpm --filter @cave/mobile test` and `expo lint` attempted a pnpm install against the shared worktree junction and aborted in non-interactive mode. I therefore ran the same installed Jest/TypeScript/ESLint executables directly, with successful results above. Focused Vitest needed an unsandboxed worker spawn; it passed after approval.
