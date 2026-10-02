# Rooms UI clarity

## Scope and decisions
- Base: shared UI foundation `e82192a`; independent branch `codex/ui-rooms`.
- Ownership: rooms UI and related tests. Routes retain existing auth, age gate, deep-link return and handoff behavior.
- General guidance moves into PageHeader help sheets; cloud-save, report, export, draft and end-room consent remains adjacent to the relevant action.
- Scenario cards are single ActionRows. New room uses a SelectionField followed by one explicit cloud-save/create action.
- Detail prioritizes answers, waiting, report generation or report reading using existing room state. Invite/end/refresh tools are labeled; report tools use an adjacent bottom sheet. Completed original answers can be expanded by their owner.
- The existing local checkbox state, explicit completion action and server report eligibility remain unchanged.

## Delivery and verification
- UI implementation complete; ready for parent integration, with no merge/push/publish performed.
- Frozen dependencies installed; no dependency or lockfile changes.
- Final rooms tests: 9 suites / 32 tests passed with Node 22.23.2 (`apps/mobile/node_modules/jest/bin/jest.js --runInBand --testPathPattern rooms`, from mobile directory).
- Final mobile typecheck: route generation followed by Node 22 `node_modules/typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json` passed.
- Final mobile lint: Node 22 `apps/mobile/node_modules/expo/bin/cli lint`, from mobile directory, passed. Sandbox runtime-path restrictions required escalation for the Expo child process.
- `git diff --check` passed; changed areas reviewed against ownership and existing behavior.
- Tests cover help/navigation, scenario selection/cancel, cloud consent, token validation, explicit per-question saving, skips, report eligibility, waiting refresh, insufficient-answer supplement, owner answer visibility, invite issuance/copy, end confirmation and explicit AI/journal handoff tools.
- No shared core, design tokens, journey geometry, business APIs, domain models or persistence changes.

## Verification limitations
- No connected phone/device available. Native screenshots, small/large type, light/dark, keyboard and safe-area runtime checks remain for parent/device acceptance.
- Native report image capture/album saving and screen-reader focus behavior require device acceptance; existing export infrastructure and shared bottom-sheet contracts are reused.
- No react-native-web/react-dom added for screenshot work.
