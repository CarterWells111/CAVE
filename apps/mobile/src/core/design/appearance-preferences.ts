import type { ThemePreference } from "./theme";

export interface AppearancePreferencesRepository {
  load(): Promise<ThemePreference>;
  save(preference: ThemePreference): Promise<void>;
}

type AppearancePreferenceRow = { theme_preference: unknown };

export interface AppearancePreferencesConnection {
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number }>;
}

type AppearanceDatabase = {
  initialize(): Promise<AppearancePreferencesConnection>;
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export class InMemoryAppearancePreferencesRepository implements AppearancePreferencesRepository {
  private preference: ThemePreference = "system";

  async load(): Promise<ThemePreference> {
    return this.preference;
  }

  async save(preference: ThemePreference): Promise<void> {
    this.preference = preference;
  }
}

export class SqlAppearancePreferencesRepository implements AppearancePreferencesRepository {
  constructor(private readonly database: AppearanceDatabase) {}

  async load(): Promise<ThemePreference> {
    const connection = await this.database.initialize();
    const row = await connection.getFirstAsync<AppearancePreferenceRow>(
      "SELECT theme_preference FROM app_preferences WHERE singleton_id = ?",
      1,
    );
    return isThemePreference(row?.theme_preference) ? row.theme_preference : "system";
  }

  async save(preference: ThemePreference): Promise<void> {
    const connection = await this.database.initialize();
    await connection.runAsync(
      "INSERT INTO app_preferences (singleton_id, theme_preference) VALUES (?, ?) ON CONFLICT(singleton_id) DO UPDATE SET theme_preference = excluded.theme_preference",
      1,
      preference,
    );
  }
}
