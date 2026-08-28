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

  test("reads the adult declaration without creating a secret and clears it with all local secrets", async () => {
    const secureStore = makeSecureStore();
    const repository = createSecretRepository({
      secureStore,
      randomBytes: jest.fn((length: number) => new Uint8Array(length).fill(9))
    });

    expect("hasAdultDeclaration" in repository).toBe(true);
    await expect(repository.hasAdultDeclaration()).resolves.toBe(false);
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();

    await repository.recordAdultDeclaration();
    await expect(repository.hasAdultDeclaration()).resolves.toBe(true);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      SECRET_NAMES.adultDeclaration,
      "confirmed",
      expect.objectContaining({ keychainAccessible: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY" })
    );

    await repository.deleteAllSecrets();
    await expect(repository.hasAdultDeclaration()).resolves.toBe(false);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(SECRET_NAMES.adultDeclaration);
  });

  test("fails closed by clearing the adult marker before later secret deletion can fail", async () => {
    const secureStore = makeSecureStore();
    secureStore.values.set(SECRET_NAMES.adultDeclaration, "confirmed");
    secureStore.values.set(SECRET_NAMES.databaseKey, "database-key");
    secureStore.values.set(SECRET_NAMES.installationToken, "installation-token");
    secureStore.deleteItemAsync.mockImplementation(async (key: string) => {
      if (key === SECRET_NAMES.databaseKey) throw new Error("secure-store-delete-failed");
      secureStore.values.delete(key);
    });
    const repository = createSecretRepository({
      secureStore,
      randomBytes: (length) => new Uint8Array(length)
    });

    await expect(repository.deleteAllSecrets()).rejects.toThrow("secure-store-delete-failed");

    expect(secureStore.values.has(SECRET_NAMES.adultDeclaration)).toBe(false);
    expect(secureStore.deleteItemAsync.mock.calls).toEqual([
      [SECRET_NAMES.adultDeclaration],
      [SECRET_NAMES.databaseKey]
    ]);
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
