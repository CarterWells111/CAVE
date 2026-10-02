# AI and account UI clarity

## Goal and scope
- Independent branch: `codex/ui-ai-account`, based on shared foundation `e82192a`.
- Assistant UI, account preferences, auth UI, profile, settings, saved-card detail/edit, review hub and replacement confirmation.
- Preserve request payloads, consent, authentication, persistence and domain behavior; no dependencies or design-token changes.

## Implemented
- Top-right help sheets for AI chat/panel, profile, settings, auth, card detail/edit and review hub.
- Fixed AI composer, usage meter, simulation labels and explicit privacy/send controls retained; starter suggestions disappear after chatting starts.
- Metadata cards are single navigation rows with date/status in accessible labels; journal and review entry rows have no nested controls.
- Secondary actions use TextAction; appearance uses a selection sheet; address choices stay accessible radio controls.
- Local privacy, upload/send boundaries, deletion consequences and replacement consent remain at the decision.

## Verification completed
- Frozen dependency installation completed; package files and lockfile unchanged.
- Mobile route generation and Node 22 TypeScript check passed.
- Expo lint and direct Node 22 ESLint passed.
- Assistant/account/auth/shell regression: 52 suites / 354 tests in the broad run, 51 suites passed with one obsolete inline appearance assertion in settings-route. Corrected the route test to open the sheet and verify all three choices; targeted rerun passed 4 suites / 47 tests including two new appearance cancel/disabled checks. All 52 suites and 356 unique tests have passed across the broad run and targeted reruns.
- Final AssistantPanel consent/payload regression passed 5 tests after setting its interactive card accessible=false so child controls remain reachable.
- Final Node 22 TypeScript and ESLint checks passed after the last UI change. Expo lint also passed; its pnpm child emitted the system Node 20 engine warning, so lint was independently repeated directly with Node 22.
- Diff check passed. No business logic, API/client/domain/runtime/storage, core/ui, tokens, dependency or lockfile changes.
- Assistant tests emit an Expo icon asynchronous act warning; assertions pass. No suppressed warnings or skipped checks.

## Integration and limitations
- ReviewHistoryScreen and ReviewDetailScreen are owned by the integration session.
- ShellFrame now accepts optional help; existing consumers retain their header title. MetadataCard uses one ActionRow and includes metadata in accessible labels; no shared core changes needed.
- No phone connected and no react-native-web/react-dom in this project. Native screenshots, keyboard/safe-area rendering and small/large type in light/dark remain unverified; no dependencies added for previews.
- Do not merge, push or publish from this session.
