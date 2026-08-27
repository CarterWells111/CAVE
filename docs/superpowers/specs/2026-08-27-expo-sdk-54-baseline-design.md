# CAVE Expo SDK 54 Baseline Design

**Date:** 2026-08-27
**Status:** Approved for implementation
**Scope:** Replace the repository's Expo SDK 57 baseline with Expo SDK 54 on the current `codex/plan-01-02-implementation` branch.

## Context

CAVE was initialized on Expo SDK 57. The physical iPhone successfully reached the Metro server at `exp://172.20.10.3:8082`, but the Apple App Store Expo Go client rejected the project because that client supports SDK 54. The user has now explicitly replaced the SDK 57 fixed decision: the repository, implementation constraints, README, and forward-looking plans must use Expo SDK 54.

This is a real baseline change, not a disposable local workaround or a second temporary branch. Existing Git history and truthful evidence from the SDK 57 attempt remain immutable; current documentation will mark that attempt as superseded.

## Architecture Decision

The mobile app will use the Expo-managed SDK 54 dependency matrix. Expo, React Native, React, Expo Router, Expo modules, Jest Expo, React Test Renderer, TypeScript React types, and Expo ESLint dependencies will be aligned together by the official Expo installer and verified by Expo Doctor. The committed lockfile will be regenerated from that aligned package manifest.

The following product and infrastructure identities do not change:

- app name `内界 CAVE`, slug and scheme `cave`;
- iOS bundle identifier `com.neijie.cave`;
- EAS owner `carter_wells` and project ID `1ddc0761-af43-491c-b969-ec2f6c415013`;
- workspace/package names under `@cave/*`;
- Worker name `neijie-cave-gateway`;
- app version `0.1.0`;
- shared v1 contracts, reviewed content, scenario engine, fixtures, and Gate 02 results.

Cloudflare Workers, Hono, Zod, pnpm, Node, SQLCipher, SecureStore, and other non-Expo technologies do not have an SDK 57/54 coupling and will not be mechanically downgraded. Their existing versions and ownership remain unchanged unless Expo Doctor or TypeScript verification proves a concrete compatibility issue.

## Repository Changes

1. Add a mobile configuration regression test that locks the supported baseline to Expo SDK 54, React Native 0.81, and React 19.1. Run it before dependency changes and require an expected RED failure against SDK 57.
2. Stop Metro and remove only the Expo-generated runtime artifacts created during the current session (`apps/mobile/.gitignore` and the generated change to `expo-env.d.ts`).
3. Use the Expo CLI installer to target `expo@~54.0.0` and align all Expo-managed dependencies with `expo install --fix`; retain pnpm and commit the resulting `pnpm-lock.yaml`.
4. Do not run `expo prebuild`: the app uses Continuous Native Generation and has neither `apps/mobile/ios` nor `apps/mobile/android`. Android remains unconfigured and out of scope.
5. Update all active SDK constraints and operating instructions in `README.md`, the master roadmap, Plan 01, Plan 05, and the CAVE identity migration plan. Preserve the SDK 57 attempt as historical evidence and add the superseding SDK 54 decision.
6. Keep the existing EAS profiles and app identity configuration unless a failing compatibility test proves a required SDK 54 adjustment.

## Validation and Error Handling

The dependency change is accepted only when all of the following are newly observed:

- the SDK baseline test changes from RED to GREEN;
- `corepack pnpm install --frozen-lockfile` exits 0;
- Expo Doctor exits 0 with every reported check passing;
- mobile Jest tests, workspace typecheck, workspace lint, workspace tests, and Gateway dry-run all exit 0;
- `expo config --json` reports SDK 54-compatible configuration while preserving the approved CAVE identity and EAS project ID;
- an iOS Expo Go manifest and JavaScript bundle both return HTTP 200;
- the Apple App Store Expo Go client opens the current CAVE shell on the real iPhone without the SDK mismatch screen;
- `git diff --check` exits 0 and the final working tree contains no Metro-generated artifacts.

If Expo's automatic alignment fails, perform at most two root-cause-based repair rounds. Do not weaken TypeScript, remove assertions, skip tests, create native directories, change the product identity, or downgrade unrelated backend/domain packages. A remaining incompatibility is recorded with the exact command and exit code rather than hidden.

## Documentation and Gate Semantics

The top-level technical stack and fixed decisions will say Expo SDK 54. Plan 01 and Plan 05 will use SDK 54 in their forward-looking instructions. The existing SDK 57 Expo Go failure remains recorded as an observed historical attempt, followed by the user-authorized SDK 54 supersession.

Gate 01A must be re-verified after the dependency migration. Expo Go real-device success is supplemental evidence only. Gate 01B remains `external_pending` until the planned signed iOS Development Build, installation, and two Metro-disconnected launches are observed after Apple Developer membership becomes active. Gate 02A and Gate 02B must remain `pass`.

## Commit Boundaries

Implementation will use separate English commits:

1. `chore: align mobile with expo sdk 54` — the regression test after its observed RED failure, followed by the dependency and lockfile GREEN implementation.
2. `docs: adopt expo sdk 54 baseline` — the documentation regression test after its observed RED failure, followed by README, plans, decision, and verification evidence.

No merge to `main`, force push, production deployment, EAS app build, or Android build is included.
