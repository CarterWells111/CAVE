# GitHub Actions Node 24 Runtime Upgrade

## Goal

Remove GitHub's Node.js 20 action-runtime deprecation warning without changing the Node.js or pnpm versions used to build the application.

## Scope

- Upgrade `actions/checkout` from `v4` to `v7` in the CI and CodeQL workflows.
- Upgrade `actions/setup-node` from `v4` to `v7` in the CI workflow.
- Upgrade `pnpm/action-setup` from `v4` to `v6` in the CI workflow.
- Keep the application toolchain pinned to Node.js `22` and pnpm `10.34.5`.
- Extend the existing workflow configuration tests so future changes cannot reintroduce the deprecated action majors.

## Rationale

The warning is emitted by the JavaScript runtime bundled with the actions, not by the repository's configured Node.js version. The selected action majors are the current stable releases and use the supported Node.js 24 action runtime. Updating CodeQL's checkout step at the same time prevents the same warning from remaining in the security workflow.

## Compatibility and Risk

The workflows use only standard checkout and package-manager setup inputs, so they do not depend on removed legacy inputs. The repository remains on GitHub-hosted `ubuntu-latest` runners, which satisfy the minimum runner requirements for these action versions. The change does not modify permissions, triggers, concurrency, build commands, caching intent, application dependencies, or deployment behavior.

## Verification

1. Update the existing configuration tests first and confirm they fail against the old action majors.
2. Upgrade the workflow action majors and confirm the focused configuration tests pass.
3. Run YAML/static checks, `git diff --check`, and the workspace CI verification appropriate to the change.
4. Push a PR and confirm the GitHub Actions run completes without the Node.js 20 deprecation annotation.
