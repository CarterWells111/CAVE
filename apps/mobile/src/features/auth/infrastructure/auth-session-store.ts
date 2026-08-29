import { z } from "zod";

import { SECRET_NAMES } from "../../../core/storage/key-store";

const AuthSessionRecordSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().optional(),
  refreshToken: z.string().regex(/^cave_rt_[A-Za-z0-9_-]{43}$/u),
  refreshExpiresAt: z.string().datetime({ offset: true }),
}).strict();

export type AuthSessionRecord = z.infer<typeof AuthSessionRecordSchema>;

type SecureStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options: { keychainAccessible: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY" },
  ): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

const SESSION_KEY = SECRET_NAMES.authSession;
const DEVICE_ONLY = { keychainAccessible: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY" } as const;

export function createAuthSessionStore(secureStore: SecureStore) {
  return {
    async load(): Promise<AuthSessionRecord | null> {
      const encoded = await secureStore.getItemAsync(SESSION_KEY);
      if (encoded === null) return null;
      try {
        const parsed = AuthSessionRecordSchema.safeParse(JSON.parse(encoded) as unknown);
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    async save(record: AuthSessionRecord): Promise<void> {
      const parsed = AuthSessionRecordSchema.parse(record);
      await secureStore.setItemAsync(SESSION_KEY, JSON.stringify(parsed), DEVICE_ONLY);
    },
    clear: () => secureStore.deleteItemAsync(SESSION_KEY),
  };
}

export type AuthSessionStore = ReturnType<typeof createAuthSessionStore>;
