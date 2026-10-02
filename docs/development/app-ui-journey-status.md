# Journey UI clarity

## Goal and boundaries
- Implement the accepted mobile UI clarity plan from shared foundation e82192a on codex/ui-journey.
- Preserve map geometry, all destinations, flow logic, consent, drafts, persistence and domain semantics.
- No shared core, design-token, dependency or lockfile changes; no merge/push.

## Implemented
- Map guidance in right-top help; practice/AI/topic links grouped under Journey tools after the unchanged map.
- Practice hub uses whole-row scenario navigation and help; carried phrase remains a primary action.
- Journey shell and preface share accessible help; first-run welcome retains all original brand/disclosure copy in shared PageHelp.
- Long practice need/aftercare choices use SelectionField; secondary actions use TextAction with async lock/error handling where needed.
- Standalone practice back action is part of its header; preview help leaves educational bodies and optional diagrams intact.

## Verification
- Node 22.23.2, frozen pnpm 10.34.5 install; no dependency or lockfile changes.
- Final related UI/route run: 38 suites, 347 tests passed. Covers original flow/return/navigation/consent tests plus help open/close, unchanged map tools destinations, single-choice cancellation, preview page preservation and compact async error/lock behavior.
- Final localized accessibility/prompt update: PresetPracticePage and PrefacePage, 2 suites / 25 tests passed.
- JourneyRuntimeProvider recovery/deletion regression: 1 suite / 25 tests passed from apps/mobile cwd. Earlier root/config invocation failed; correct cwd invocation passed without any business-logic changes. No unresolved failing test remains in the executed final checks.
- Mobile route generation and final TypeScript tsc --noEmit passed.
- Final full-mobile ESLint passed using the direct Node22 CLI. Expo lint wrapper attempt selected system Node20 in its child process and failed sandbox EPERM; direct ESLint using the repository config succeeded.
- Diff reviewed: only assigned UI/routes and related tests plus this status file. journey-map.tsx, core/ui, design tokens, all APIs/domain/persistence/auth and pnpm-lock.yaml are unchanged.

## Commands
Run in apps/mobile using the explicit Node22 executable:
- node_modules/jest/bin/jest.js --runInBand --testPathPattern 'journey/ui|explore|HomeScreen|PracticeHubScreen|home-map-route|home-route|journey-production|canonical-routes|eight-page|seven-screen-routes'
- node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/features/journey/runtime/JourneyRuntimeProvider.test.tsx
- ../../node_modules/eslint/bin/eslint.js .
Run at the workspace root using Node22:
- scripts/generate-mobile-routes.mjs
- node_modules/typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json

## Integration and remaining limitations
- Ready to integrate from codex/ui-journey. No merge, push or publish performed.
- No shared component changes required. HealthScreen is a static diagnostic brand/version display with no instructions/actions and was left unchanged.
- Native phone and screenshot verification is NOT completed. No phone is connected and the repository has no react-native-web/react-dom dependencies; no dependencies were added. Actual small/large text, light/dark, keyboard, safe-area layout and screen-reader behavior still need device verification during integration.
