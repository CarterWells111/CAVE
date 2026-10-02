# App UI clarity

## Goal and accepted decisions
- Optimize every mobile user page while preserving the CAVE palette and tone.
- Keep all five tabs and the existing journey map, nodes and connectors.
- Move general page instructions into a top-right help button and bottom sheet.
- Keep input prompts, errors, upload/sharing consent and deletion confirmation at the action.
- No backend, persistence, authorization or content-review changes.

## Delivery
- Integration branch: codex/app-ui-clarity, based on origin/main 57a292b.
- Shared components are owned by the integration task.
- Four independent sessions: journey; rooms; journal; assistant/account/profile/settings.
- Each session owns its feature UI, routes and related tests; no shared component edits.
- Verify feature tests, mobile typecheck/lint and complete mobile tests after integration.
- Compare runtime screens in small/large type, light/dark, keyboard and safe-area states where available.

## Current state
- Remote main fetched; isolated worktree and integration branch created.
- Original checkout changes preserved.
- Locked dependency installation completed without lockfile changes.
- Shared components implemented; 4 suites / 13 tests passed, mobile typecheck and lint passed.
- Four feature sessions dispatched from e82192a and actively implementing.
- Navigation now grows naturally with text size; 3 suites / 10 navigation tests passed.
- Full baseline: 177 suites / 1440 tests passed in 152.38 s. Command exit 1 only because outputs/ did not yet exist when Jest wrote JSON; no baseline JSON artifact. Create output directory before final run.
- Runtime screenshots and native device verification pending.

## Implementation sessions
| Area | Thread | Worktree | Branch |
| --- | --- | --- | --- |
| Journey/map | 01a0fcce-c34d-7271-bfef-4a014be26447 | .codex/worktrees/6850/内界 CAVE | codex/ui-journey |
| Rooms | 01a0fccf-0eca-7272-a3c8-da8c39babe6a | .codex/worktrees/f1bf/内界 CAVE | codex/ui-rooms |
| Journal | 01a0fccf-5b60-7473-8980-2fb5c37c844b | .codex/worktrees/9d69/内界 CAVE | codex/ui-journal |
| AI/account | 01a0fccf-b574-74b3-aa54-341b1ce12a9b | .codex/worktrees/d03f/内界 CAVE | codex/ui-ai-account |

No connected mobile device or react-native-web/react-dom preview dependencies are available. Native layout, keyboard and VoiceOver checks remain unverified until device acceptance; automated checks do not substitute for screenshots.

## Shared UI contracts
- `core/ui/page-header.tsx`: `PageHeader({ title, help?: ReactNode, actions?: ReactNode, onBack?, backLabel? })`; `PageHelp({ title, children })` for existing headers; `HelpText` for readable help copy. Help label is `${title}，帮助`; close label is `关闭${title} · 帮助`.
- `core/ui/action-row.tsx`: `ActionRow({ title, subtitle?, accessibilityLabel?, children?, onPress, disabled?, testID? })`; one navigation target, no nested controls. Keep body summaries short; accessible label must include relevant child content if needed.
- `core/ui/selection-field.tsx`: `SelectionField<T>({ label, value, options: { value, label, detail? }[], onChange, disabled? })`; selection sheet closes after choosing and cancel preserves value.
- `IconTextAction` now accepts `iconOnly?: boolean`; accessible label and touch/focus behavior are unchanged.
- Reuse existing `TextAction` for secondary operations, `BottomSheet` for tool groups, `Button` for primary actions, `StickyActionBar` only where appropriate for existing screen layout.
- No global styling rewrite and no edits to journey map geometry. Feature tests should verify semantic roles/behavior rather than preserve obsolete duplicate button labels.
