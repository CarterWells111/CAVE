import type { SecretRepository } from "./types";

export const SECRET_NAMES = {
  databaseKey: "db.key.v1",
  installationToken: "installation.token.v1",
  adultDeclaration: "adult.declaration.v1"
} as const;

const ADULT_DECLARATION_VALUE = "confirmed";

const DEVICE_ONLY_OPTIONS = {
  keychainAccessible: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY"
} as const;

export interface SecureStoreAdapter {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options: typeof DEVICE_ONLY_OPTIONS
  ): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface DatabaseSecretRepository extends SecretRepository {
  getDatabaseKey(): Promise<string | null>;
  deleteDatabaseKey(): Promise<void>;
  hasAdultDeclaration(): Promise<boolean>;
  recordAdultDeclaration(): Promise<void>;
  deleteAdultDeclaration(): Promise<void>;
}

type SecretRepositoryDependencies = {
  secureStore: SecureStoreAdapter;
  randomBytes(length: number): Uint8Array | Promise<Uint8Array>;
};

type ExpoSecureStoreModule = {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: unknown;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string, options: { keychainAccessible: unknown }): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const bits = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    encoded += BASE64_ALPHABET[(bits >>> 18) & 63];
    encoded += BASE64_ALPHABET[(bits >>> 12) & 63];
    encoded += second === undefined ? "=" : BASE64_ALPHABET[(bits >>> 6) & 63];
    encoded += third === undefined ? "=" : BASE64_ALPHABET[bits & 63];
  }
  return encoded;
}

export function createExpoSecureStoreAdapter(module: ExpoSecureStoreModule): SecureStoreAdapter {
  return {
    getItemAsync: (key) => module.getItemAsync(key),
    setItemAsync: (key, value) => module.setItemAsync(key, value, {
      keychainAccessible: module.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
    }),
    deleteItemAsync: (key) => module.deleteItemAsync(key)
  };
}

export function systemRandomBytes(length: number): Uint8Array {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("A cryptographically secure random source is required");
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

export function createSecretRepository({
  secureStore,
  randomBytes
}: SecretRepositoryDependencies): DatabaseSecretRepository {
  async function getOrCreate(name: string): Promise<string> {
    const existing = await secureStore.getItemAsync(name);
    if (existing !== null) return existing;

    const bytes = await randomBytes(32);
    if (bytes.byteLength !== 32) {
      throw new Error("Secret entropy source must return exactly 32 bytes");
    }
    const value = encodeBase64(bytes);
    await secureStore.setItemAsync(name, value, DEVICE_ONLY_OPTIONS);
    return value;
  }

  return {
    getDatabaseKey: () => secureStore.getItemAsync(SECRET_NAMES.databaseKey),
    getOrCreateDatabaseKey: () => getOrCreate(SECRET_NAMES.databaseKey),
    getOrCreateInstallationToken: () => getOrCreate(SECRET_NAMES.installationToken),
    deleteDatabaseKey: () => secureStore.deleteItemAsync(SECRET_NAMES.databaseKey),
    async hasAdultDeclaration() {
      return await secureStore.getItemAsync(SECRET_NAMES.adultDeclaration)
        === ADULT_DECLARATION_VALUE;
    },
    recordAdultDeclaration: () => secureStore.setItemAsync(
      SECRET_NAMES.adultDeclaration,
      ADULT_DECLARATION_VALUE,
      DEVICE_ONLY_OPTIONS
    ),
    deleteAdultDeclaration: () => secureStore.deleteItemAsync(SECRET_NAMES.adultDeclaration),
    async deleteAllSecrets() {
      await secureStore.deleteItemAsync(SECRET_NAMES.databaseKey);
      await secureStore.deleteItemAsync(SECRET_NAMES.installationToken);
      await secureStore.deleteItemAsync(SECRET_NAMES.adultDeclaration);
    }
  };
}
