import {
  InMemoryAppearancePreferencesRepository,
  SqlAppearancePreferencesRepository,
  type AppearancePreferencesConnection,
} from "./appearance-preferences";

test("defaults an empty in-memory preference to the system appearance", async () => {
  const repository = new InMemoryAppearancePreferencesRepository();

  await expect(repository.load()).resolves.toBe("system");
  await repository.save("light");
  await expect(repository.load()).resolves.toBe("light");
});

test("persists a validated appearance preference through the SQL repository", async () => {
  let stored: string | null = null;
  const connection: AppearancePreferencesConnection = {
    getFirstAsync: async <T,>() => (
      stored === null ? null : { theme_preference: stored } as T
    ),
    runAsync: jest.fn(async (_sql: string, _singleton: number, value: unknown) => {
      stored = String(value);
      return { changes: 1 };
    }),
  };
  const repository = new SqlAppearancePreferencesRepository({
    initialize: jest.fn(async () => connection),
  });

  await expect(repository.load()).resolves.toBe("system");
  await repository.save("dark");
  await expect(repository.load()).resolves.toBe("dark");
});

test("falls back to system when persisted appearance data is invalid", async () => {
  const connection: AppearancePreferencesConnection = {
    getFirstAsync: async <T,>() => ({ theme_preference: "sepia" } as T),
    runAsync: jest.fn(async () => ({ changes: 0 })),
  };
  const repository = new SqlAppearancePreferencesRepository({
    initialize: jest.fn(async () => connection),
  });

  await expect(repository.load()).resolves.toBe("system");
});
