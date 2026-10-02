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
- Feature sessions pending dispatch from the shared component commit.
- Runtime screenshots and native device verification pending.

## Shared UI contracts
- `core/ui/page-header.tsx`: `PageHeader({ title, help?: ReactNode, actions?: ReactNode, onBack?, backLabel? })`; `PageHelp({ title, children })` for existing headers; `HelpText` for readable help copy. Help label is `${title}，帮助`; close label is `关闭${title} · 帮助`.
- `core/ui/action-row.tsx`: `ActionRow({ title, subtitle?, accessibilityLabel?, children?, onPress, disabled?, testID? })`; one navigation target, no nested controls. Keep body summaries short; accessible label must include relevant child content if needed.
- `core/ui/selection-field.tsx`: `SelectionField<T>({ label, value, options: { value, label, detail? }[], onChange, disabled? })`; selection sheet closes after choosing and cancel preserves value.
- `IconTextAction` now accepts `iconOnly?: boolean`; accessible label and touch/focus behavior are unchanged.
- Reuse existing `TextAction` for secondary operations, `BottomSheet` for tool groups, `Button` for primary actions, `StickyActionBar` only where appropriate for existing screen layout.
- No global styling rewrite and no edits to journey map geometry. Feature tests should verify semantic roles/behavior rather than preserve obsolete duplicate button labels.
