import {
  createExpoSecureStoreAdapter,
  createSecretRepository,
  SECRET_NAMES
} from "./key-store";

function makeSecureStore() {
  const values = new Map<string, string>();
  return {
    values,
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { values.delete(key); })
  };
}

describe("SecretRepository", () => {
  test("creates one 32-byte database key and returns it stably", async () => {
    const secureStore = makeSecureStore();
    const randomBytes = jest.fn(() => Uint8Array.from({ length: 32 }, (_, index) => index));
    const repository = createSecretRepository({ secureStore, randomBytes });

    const first = await repository.getOrCreateDatabaseKey();
    const second = await repository.getOrCreateDatabaseKey();

    expect(first).toBe(second);
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      SECRET_NAMES.databaseKey,
      first,
      expect.objectContaining({ keychainAccessible: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY" })
    );
    expect(first).toBe("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=");
  });

  test("creates a separate stable installation token", async () => {
    const secureStore = makeSecureStore();
    let seed = 1;
    const repository = createSecretRepository({
      secureStore,
      randomBytes: (length) => new Uint8Array(length).fill(seed++)
    });

    const token = await repository.getOrCreateInstallationToken();
    expect(await repository.getOrCreateInstallationToken()).toBe(token);
    expect(secureStore.values.get(SECRET_NAMES.installationToken)).toBe(token);
    expect(token).not.toBe(await repository.getOrCreateDatabaseKey());
  });

  test("explicit deletion removes key and installation token", async () => {
    const secureStore = makeSecureStore();
    const repository = createSecretRepository({
      secureStore,
      randomBytes: (length) => new Uint8Array(length).fill(7)
    });
    await repository.getOrCreateDatabaseKey();
    await repository.getOrCreateInstallationToken();

    await repository.deleteAllSecrets();

    expect(secureStore.values.size).toBe(0);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(SECRET_NAMES.databaseKey);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(SECRET_NAMES.installationToken);
  });

  test("maps device-only accessibility to the native SecureStore constant", async () => {
    const module = {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 123,
      getItemAsync: jest.fn(async () => null),
      setItemAsync: jest.fn(async () => undefined),
      deleteItemAsync: jest.fn(async () => undefined)
    };
    const adapter = createExpoSecureStoreAdapter(module);
    await adapter.setItemAsync("key", "value", {
      keychainAccessible: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY"
    });
    expect(module.setItemAsync).toHaveBeenCalledWith("key", "value", {
      keychainAccessible: 123
    });
  });
});
