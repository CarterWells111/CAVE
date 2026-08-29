import { createAuthSessionStore } from "./auth-session-store";

test("stores only the refresh credential with device-only accessibility", async () => {
  const values = new Map<string, string>();
  const secureStore = {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { values.delete(key); }),
  };
  const store = createAuthSessionStore(secureStore);
  await store.save({
    accountId: "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
    refreshToken: `cave_rt_${"r".repeat(43)}`,
    refreshExpiresAt: "2026-09-27T17:00:00.000Z",
  });

  expect(secureStore.setItemAsync).toHaveBeenCalledWith(
    "auth.session.v1",
    expect.not.stringContaining("cave_at_"),
    { keychainAccessible: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY" },
  );
  await expect(store.load()).resolves.toMatchObject({ accountId: expect.any(String) });
  await store.clear();
  await expect(store.load()).resolves.toBeNull();
});

test("fails closed on malformed persisted state", async () => {
  const store = createAuthSessionStore({
    getItemAsync: async () => "{\"refreshToken\":\"private-canary\"}",
    setItemAsync: async () => undefined,
    deleteItemAsync: jest.fn(async () => undefined),
  });
  await expect(store.load()).resolves.toBeNull();
});

test("normalizes a verified email while accepting legacy records without one", async () => {
  let encoded: string | null = null;
  const store = createAuthSessionStore({
    getItemAsync: async () => encoded,
    setItemAsync: async (_key: string, value: string) => { encoded = value; },
    deleteItemAsync: async () => undefined,
  });

  await store.save({
    accountId: "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
    email: " Person@Example.com ",
    refreshToken: `cave_rt_${"r".repeat(43)}`,
    refreshExpiresAt: "2026-09-27T17:00:00.000Z",
  });
  await expect(store.load()).resolves.toMatchObject({ email: "person@example.com" });

  encoded = JSON.stringify({
    accountId: "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
    refreshToken: `cave_rt_${"r".repeat(43)}`,
    refreshExpiresAt: "2026-09-27T17:00:00.000Z",
  });
  await expect(store.load()).resolves.toEqual(expect.not.objectContaining({ email: expect.anything() }));
});
