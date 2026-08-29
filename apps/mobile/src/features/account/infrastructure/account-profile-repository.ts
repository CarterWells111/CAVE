import { z } from "zod";

import {
  DEFAULT_ACCOUNT_DISPLAY_NAME,
  type AccountProfile,
} from "../domain/account-profile";

const AccountIdSchema = z.string().uuid();
const StoredProfileSchema = z.object({
  displayName: z.string().min(1).max(96),
  avatarUri: z.string().min(1).optional(),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();
type StoredProfile = z.infer<typeof StoredProfileSchema>;
type ProfileMap = Record<string, StoredProfile>;

type ProfileStorage = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  clear(): Promise<void>;
};

type AvatarFiles = {
  copy(accountId: string, sourceUri: string): Promise<string>;
  remove(uri: string): Promise<void>;
  clearAll(): Promise<void>;
};

export type AccountProfileRepository = {
  load(accountId: string): Promise<AccountProfile>;
  saveDisplayName(accountId: string, value: string): Promise<AccountProfile>;
  replaceAvatar(accountId: string, sourceUri: string): Promise<AccountProfile>;
  removeAvatar(accountId: string): Promise<AccountProfile>;
  clearAll(): Promise<void>;
};

type Dependencies = {
  storage: ProfileStorage;
  avatars: AvatarFiles;
  now(): string;
};

function validateAccountId(accountId: string): string {
  const parsed = AccountIdSchema.safeParse(accountId);
  if (!parsed.success) throw new Error("account-profile-invalid-account");
  return parsed.data;
}

function normalizeDisplayName(value: string): string {
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  if (length < 1 || length > 24) throw new Error("account-profile-invalid-name");
  return normalized;
}

function toProfile(accountId: string, stored?: StoredProfile): AccountProfile {
  return stored === undefined
    ? { accountId, displayName: DEFAULT_ACCOUNT_DISPLAY_NAME, updatedAt: null }
    : {
        accountId,
        displayName: stored.displayName,
        ...(stored.avatarUri === undefined ? {} : { avatarUri: stored.avatarUri }),
        updatedAt: stored.updatedAt,
      };
}

export function createAccountProfileRepository({
  avatars,
  now,
  storage,
}: Dependencies): AccountProfileRepository {
  let pendingMutation: Promise<void> = Promise.resolve();

  async function readMap() {
    const encoded = await storage.get();
    if (encoded === null) return {} as ProfileMap;
    try {
      const decoded = JSON.parse(encoded) as unknown;
      if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) return {};
      const profiles: ProfileMap = {};
      for (const [accountId, value] of Object.entries(decoded)) {
        if (!AccountIdSchema.safeParse(accountId).success) continue;
        const parsed = StoredProfileSchema.safeParse(value);
        if (!parsed.success) continue;
        try {
          normalizeDisplayName(parsed.data.displayName);
          profiles[accountId] = parsed.data;
        } catch {
          // One corrupt account must not make another account's profile unavailable.
        }
      }
      return profiles;
    } catch {
      return {};
    }
  }

  async function mutate<T>(operation: () => Promise<T>): Promise<T> {
    let resolveResult!: (value: T | PromiseLike<T>) => void;
    let rejectResult!: (reason?: unknown) => void;
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    const task = pendingMutation.then(async () => {
      try {
        resolveResult(await operation());
      } catch (error) {
        rejectResult(error);
      }
    });
    pendingMutation = task.catch(() => undefined);
    return await result;
  }

  async function save(
    accountId: string,
    update: (current: AccountProfile) => Promise<AccountProfile> | AccountProfile,
  ) {
    return await mutate(async () => {
      const profiles = await readMap();
      const next = await update(toProfile(accountId, profiles[accountId]));
      profiles[accountId] = {
        displayName: next.displayName,
        ...(next.avatarUri === undefined ? {} : { avatarUri: next.avatarUri }),
        updatedAt: next.updatedAt ?? now(),
      };
      await storage.set(JSON.stringify(profiles));
      return toProfile(accountId, profiles[accountId]);
    });
  }

  return {
    async load(rawAccountId) {
      const accountId = validateAccountId(rawAccountId);
      await pendingMutation;
      const profiles = await readMap();
      return toProfile(accountId, profiles[accountId]);
    },
    async saveDisplayName(rawAccountId, value) {
      const accountId = validateAccountId(rawAccountId);
      const displayName = normalizeDisplayName(value);
      return await save(accountId, (current) => ({ ...current, displayName, updatedAt: now() }));
    },
    async replaceAvatar(rawAccountId, sourceUri) {
      const accountId = validateAccountId(rawAccountId);
      if (sourceUri.length === 0) throw new Error("account-profile-invalid-avatar");
      return await mutate(async () => {
        const profiles = await readMap();
        const current = toProfile(accountId, profiles[accountId]);
        const avatarUri = await avatars.copy(accountId, sourceUri);
        const next = { ...current, avatarUri, updatedAt: now() };
        profiles[accountId] = {
          displayName: next.displayName,
          avatarUri,
          updatedAt: next.updatedAt,
        };
        try {
          await storage.set(JSON.stringify(profiles));
        } catch (error) {
          await avatars.remove(avatarUri).catch(() => undefined);
          throw error;
        }
        if (current.avatarUri !== undefined && current.avatarUri !== avatarUri) {
          await avatars.remove(current.avatarUri).catch(() => undefined);
        }
        return toProfile(accountId, profiles[accountId]);
      });
    },
    async removeAvatar(rawAccountId) {
      const accountId = validateAccountId(rawAccountId);
      return await mutate(async () => {
        const profiles = await readMap();
        const current = toProfile(accountId, profiles[accountId]);
        const { avatarUri, ...withoutAvatar } = current;
        const next = { ...withoutAvatar, updatedAt: now() };
        profiles[accountId] = {
          displayName: next.displayName,
          updatedAt: next.updatedAt,
        };
        await storage.set(JSON.stringify(profiles));
        if (avatarUri !== undefined) await avatars.remove(avatarUri).catch(() => undefined);
        return toProfile(accountId, profiles[accountId]);
      });
    },
    async clearAll() {
      await mutate(async () => {
        await avatars.clearAll();
        await storage.clear();
      });
    },
  };
}
