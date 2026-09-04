/* eslint-disable @typescript-eslint/no-require-imports -- Every native import below is intentionally deferred until the explicit development gate passes. */
import Constants from 'expo-constants';
import { createAcceptanceHarness, isAcceptanceToolsEnabled, type AcceptanceHarness } from './acceptance-harness';

let singleton: AcceptanceHarness | undefined;
export function getNativeAcceptanceHarness(): AcceptanceHarness | null {
  const enabled = () => isAcceptanceToolsEnabled(__DEV__, Constants.expoConfig?.extra);
  if (!enabled()) return null;
  if (singleton) return singleton;
  // Native modules and production adapters are loaded only inside the explicit dev gate.
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');
  const { createExpoJourneyAdapters } = require('../journey/infrastructure/expo-journey-adapters') as typeof import('../journey/infrastructure/expo-journey-adapters');
  const { createExpoSecureStoreAdapter } = require('../../core/storage/key-store') as typeof import('../../core/storage/key-store');
  const adapters = createExpoJourneyAdapters({
    sqlite: {
      defaultDatabaseDirectory: SQLite.defaultDatabaseDirectory,
      openDatabaseAsync: (name) => SQLite.openDatabaseAsync(name, { useNewConnection: true }),
    },
  });
  const profile = () => new FileSystem.File(FileSystem.Paths.document, 'cave.acceptance.profile.json');
  singleton = createAcceptanceHarness({
    enabled,
    native: adapters.native, files: adapters.files,
    secureStore: createExpoSecureStoreAdapter(SecureStore as unknown as Parameters<typeof createExpoSecureStoreAdapter>[0]),
    randomBytes: Crypto.getRandomBytes,
    profiles: {
      async exists() { return profile().exists; },
      async seed() {
        const file = profile();
        if (file.exists) throw new Error('Acceptance profile already exists');
        file.create({ overwrite: false }); file.write('{"id":"acceptance-synthetic","synthetic":true}');
      },
      async clearAll() { const file = profile(); if (file.exists) file.delete(); },
    },
  });
  return singleton;
}

export async function startNativeAcceptanceTools(): Promise<void> {
  await getNativeAcceptanceHarness()?.startup();
}
