# Expo SDK 57 Upgrade Design

## Goal

Upgrade the mobile application from Expo SDK 54 to the latest stable Expo SDK 57 patch release so the team can use the current Expo Go application while preserving the existing development-client workflow.

## Scope and constraints

- Apply the upgrade in the existing `codex/journey-path-home` worktree.
- Keep all changes local and uncommitted; do not push, merge, deploy, or submit a build.
- Preserve all current journey-map feature changes already present in the worktree.
- Preserve EAS development, preview, acceptance, and production profiles.
- Do not generate `ios/` or `android/` directories because the project uses Continuous Native Generation.

## Dependency strategy

Use Expo CLI's supported upgrade path rather than editing only the Expo version:

1. Install the latest stable Expo SDK 57 release.
2. Run Expo dependency alignment so React, React Native, Expo Router, Expo modules, Jest integration, and other SDK-coupled packages use compatible versions.
3. Update the repository's SDK baseline test to assert the resolved SDK 57 matrix.
4. Keep `expo-dev-client` installed and aligned with SDK 57 so custom development builds remain available.

The upgrade will not replace `@expo/vector-icons` or migrate unrelated APIs. Those changes are outside the compatibility work required for SDK 57.

## Expo Go development workflow

Change the default mobile start script from `expo start --go --offline` to `expo start --go`. Current iOS Expo Go requires the CLI and phone application to be logged in to the same Expo account, so the team default must allow the authenticated network flow.

Keep `start:dev-client` unchanged for custom development-client use.

## Compatibility review

- Confirm the codebase has no direct `@react-navigation/*` imports that conflict with Expo Router 57.
- Run Expo Doctor to catch incompatible or duplicate native packages.
- Address only concrete SDK 57 type, lint, test, configuration, or export regressions.
- Keep the existing SQLCipher configuration. Expo Go can exercise the JavaScript flow with its bundled SQLite implementation, while an EAS development build remains the path for validating SQLCipher-native behavior.

## Verification

The upgrade is complete only when all of the following succeed from the SDK 57 worktree:

- Expo dependency validation and Expo Doctor
- Mobile SDK baseline test
- Repository type checking
- Repository linting
- Full repository test suite
- Mobile source-policy verification
- iOS JavaScript bundle export

The final report will include the resolved dependency matrix, commands and results, any remaining device-only checks, and the local files changed.

## Failure handling

If dependency alignment or verification exposes a breaking change, isolate the failing package or API, compare it with the SDK 57 release documentation, and make the smallest compatibility change. Do not delete user work or reset the worktree.
