import type { AccountPreferences } from "@cave/contracts";
import { z } from "zod";

const ValuesSchema = z.object({ ageConfirmed: z.boolean(), addressPreference: z.enum(["你", "妳"]).nullable() }).strict();
export type PreferenceValues = z.infer<typeof ValuesSchema>;
export type PreferenceChanges = Partial<PreferenceValues>;
const ChangesSchema = ValuesSchema.partial().transform((value): PreferenceChanges => ({
  ...(value.ageConfirmed === undefined ? {} : { ageConfirmed: value.ageConfirmed }),
  ...(value.addressPreference === undefined ? {} : { addressPreference: value.addressPreference }),
}));
export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  ageConfirmed: false, addressPreference: null, updatedAt: null, revision: 0,
};
const EntrySchema = z.object({
  values: ValuesSchema.extend({ updatedAt: z.string().datetime({ offset: true }).nullable(), revision: z.number().int().nonnegative() }),
  pending: ChangesSchema,
  fallback: ChangesSchema,
  version: z.number().int().nonnegative(),
  fieldVersions: z.object({ ageConfirmed: z.number().int().optional(), addressPreference: z.number().int().optional() }).default({}),
});
const StoreSchema = z.object({ guest: EntrySchema, accounts: z.record(z.string().uuid(), EntrySchema) });
type Entry = z.infer<typeof EntrySchema>;
type Store = z.infer<typeof StoreSchema>;
export type PreferencesRemote = {
  get(): Promise<AccountPreferences>;
  update(expectedRevision: number, changes: PreferenceChanges): Promise<AccountPreferences>;
};
export type PreferencesSnapshot = {
  initialized: boolean;
  ready: boolean;
  owner: string | null;
  preferences: AccountPreferences;
  syncStatus: "local" | "pending" | "syncing" | "saved" | "error";
};
const emptyEntry = (): Entry => ({ values: { ...DEFAULT_ACCOUNT_PREFERENCES }, pending: {}, fallback: {}, version: 0, fieldVersions: {} });
const emptyStore = (): Store => ({ guest: emptyEntry(), accounts: {} });
const nonempty = (value: PreferenceChanges) => Object.keys(value).length > 0;
const fields = ["ageConfirmed", "addressPreference"] as const;
function changedVersions(entry: Entry, changes: PreferenceChanges) {
  const versions = { ...entry.fieldVersions };
  for (const field of fields) if (changes[field] !== undefined) versions[field] = entry.version + 1;
  return versions;
}

/** Local writes are serialized independently of network requests, so offline saves never wait for a request. */
export class AccountPreferencesService {
  private store: Store = emptyStore();
  private tail: Promise<unknown> = Promise.resolve();
  private epoch = 0;
  private inFlight: { epoch: number; promise: Promise<void> } | null = null;
  private listeners = new Set<() => void>();
  private snapshot: PreferencesSnapshot = {
    initialized: false, ready: false, owner: null, preferences: { ...DEFAULT_ACCOUNT_PREFERENCES }, syncStatus: "local",
  };
  constructor(private readonly storage: { get(): Promise<string | null>; set(value: string): Promise<void> }) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<PreferencesSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const task = this.tail.then(action, action);
    this.tail = task.catch(() => undefined);
    return task;
  }
  private entry(owner = this.snapshot.owner): Entry { return owner === null ? this.store.guest : this.store.accounts[owner] ?? emptyEntry(); }
  private async persist(next: Store) {
    await this.storage.set(JSON.stringify(next));
    this.store = next;
  }
  private async put(owner: string | null, entry: Entry) {
    await this.persist(owner === null ? { ...this.store, guest: entry } : { ...this.store, accounts: { ...this.store.accounts, [owner]: entry } });
  }
  initialize(legacy: PreferenceValues): Promise<void> {
    return this.enqueue(async () => {
      if (this.snapshot.initialized) return;
      const encoded = await this.storage.get();
      if (encoded !== null) {
        // Corrupt preferences fail closed and remain available for explicit retry; never silently erase them.
        this.store = StoreSchema.parse(JSON.parse(encoded));
      } else {
        const next = emptyStore();
        next.guest.values = { ...DEFAULT_ACCOUNT_PREFERENCES, ...ValuesSchema.parse(legacy) };
        await this.persist(next);
      }
      this.emit({ initialized: true });
    });
  }
  activate(owner: string | null): Promise<void> {
    const epoch = ++this.epoch;
    this.emit({ owner, ready: false, preferences: { ...DEFAULT_ACCOUNT_PREFERENCES }, syncStatus: owner === null ? "local" : "pending" });
    return this.enqueue(async () => {
      if (!this.snapshot.initialized) throw new Error("account-preferences-not-initialized");
      if (epoch !== this.epoch) return;
      if (owner !== null) {
        z.string().uuid().parse(owner);
        const existing = this.store.accounts[owner];
        const guest = this.store.guest;
        const entry = existing ?? emptyEntry();
        const fallback = existing === undefined
          ? { ...(guest.values.ageConfirmed ? { ageConfirmed: true } : {}), ...(guest.values.addressPreference === null ? {} : { addressPreference: guest.values.addressPreference }) }
          : entry.fallback;
        const next: Entry = {
          ...entry, fallback,
          values: { ...entry.values, ...guest.pending },
          pending: { ...entry.pending, ...guest.pending },
          version: entry.version + 1,
          fieldVersions: changedVersions(entry, guest.pending),
        };
        // Consuming guest choices and saving the account entry is one durable write.
        await this.persist({ guest: emptyEntry(), accounts: { ...this.store.accounts, [owner]: next } });
      }
      if (epoch !== this.epoch) return;
      this.emit({ ready: true, preferences: this.entry(owner).values });
    });
  }
  change(changes: PreferenceChanges): Promise<void> {
    const owner = this.snapshot.owner;
    const epoch = this.epoch;
    return this.enqueue(async () => {
      if (!this.snapshot.ready || epoch !== this.epoch) throw new Error("account-preferences-owner-changed");
      const parsed = ChangesSchema.parse(changes);
      const current = this.entry(owner);
      const next: Entry = {
        ...current, values: { ...current.values, ...parsed }, pending: { ...current.pending, ...parsed }, version: current.version + 1,
        fieldVersions: changedVersions(current, parsed),
      };
      await this.put(owner, next);
      if (epoch === this.epoch) this.emit({ preferences: next.values, syncStatus: owner === null ? "local" : "pending" });
    });
  }
  sync(remote: PreferencesRemote): Promise<void> {
    const epoch = this.epoch;
    if (!this.snapshot.ready || this.snapshot.owner === null) return Promise.resolve();
    if (this.inFlight?.epoch === epoch) return this.inFlight.promise;
    const owner = this.snapshot.owner;
    const promise = this.synchronize(owner, epoch, remote).finally(() => {
      if (this.inFlight?.promise === promise) this.inFlight = null;
    });
    this.inFlight = { epoch, promise };
    return promise;
  }
  private async synchronize(owner: string, epoch: number, remote: PreferencesRemote) {
    const active = () => this.epoch === epoch;
    this.emit({ syncStatus: "syncing" });
    try {
      let server = await remote.get();
      let conflicts = 0;
      while (active()) {
        const request = await this.enqueue(async () => {
          if (!active()) return null;
          const current = this.entry(owner);
          const pending = { ...(server.revision === 0 ? current.fallback : {}), ...current.pending };
          const next = { ...current, pending, fallback: {}, values: { ...server, ...pending } };
          await this.put(owner, next);
          if (!active()) return null;
          this.emit({ preferences: next.values });
          return { pending, fieldVersions: { ...next.fieldVersions } };
        });
        if (request === null || !active()) return;
        if (!nonempty(request.pending)) { this.emit({ syncStatus: "saved" }); return; }
        try { server = await remote.update(server.revision, request.pending); }
        catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ACCOUNT_PREFERENCES_CONFLICT" && conflicts++ < 2) {
            server = await remote.get();
            continue;
          }
          throw error;
        }
        await this.enqueue(async () => {
          if (!active()) return;
          const current = this.entry(owner);
          const pending = { ...current.pending };
          for (const field of fields) {
            if (request.pending[field] !== undefined && current.fieldVersions[field] === request.fieldVersions[field]) delete pending[field];
          }
          const next = { ...current, pending, values: { ...server, ...pending } };
          await this.put(owner, next);
          if (active()) this.emit({ preferences: next.values });
        });
      }
    } catch {
      if (active()) this.emit({ syncStatus: "error" });
    }
  }
  clear(): Promise<void> {
    ++this.epoch;
    this.emit({ ready: false, owner: null, preferences: { ...DEFAULT_ACCOUNT_PREFERENCES }, syncStatus: "local" });
    return this.enqueue(async () => {
      await this.persist(emptyStore());
      this.emit({ initialized: true, ready: true });
    });
  }
}
