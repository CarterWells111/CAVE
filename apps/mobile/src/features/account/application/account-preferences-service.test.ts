import { AccountPreferencesService, type PreferencesRemote } from "./account-preferences-service";

const defaults = { ageConfirmed: false, addressPreference: null, updatedAt: null, revision: 0 } as const;
const accountA = "cb02004c-7b5b-4680-9b16-8a6a33511bc9";
const accountB = "ab02004c-7b5b-4680-9b16-8a6a33511bc9";
function setup() {
  let stored: string | null = null;
  const storage = { get: async () => stored, set: async (value: string) => { stored = value; } };
  const service = new AccountPreferencesService(storage);
  return { service, storage };
}
function remote(initial = { ...defaults } as { ageConfirmed: boolean; addressPreference: "你" | "妳" | null; updatedAt: string | null; revision: number }) {
  let value = initial;
  const api: PreferencesRemote = {
    get: jest.fn(async () => value),
    update: jest.fn(async (revision, changes) => {
      if (revision !== value.revision) throw Object.assign(new Error(), { code: "ACCOUNT_PREFERENCES_CONFLICT" });
      value = { ...value, ...changes, revision: value.revision + 1, updatedAt: "2026-09-04T10:00:00.000Z" };
      return value;
    }),
  };
  return api;
}
async function start(service: AccountPreferencesService) {
  await service.initialize({ ageConfirmed: false, addressPreference: null });
  await service.activate(null);
}

test("remembers guest selections after restart and consumes them only for the first signed-in account", async () => {
  const { service, storage } = setup();
  await start(service);
  await service.change({ ageConfirmed: true, addressPreference: "妳" });
  const restarted = new AccountPreferencesService(storage);
  await start(restarted);
  expect(restarted.getSnapshot().preferences).toMatchObject({ ageConfirmed: true, addressPreference: "妳" });
  await restarted.activate(accountA);
  const api = remote();
  await restarted.sync(api);
  expect(await api.get()).toMatchObject({ ageConfirmed: true, addressPreference: "妳" });
  await restarted.activate(null);
  expect(restarted.getSnapshot().preferences).toMatchObject(defaults);
  await restarted.activate(accountB);
  expect(restarted.getSnapshot().preferences).toMatchObject(defaults);
});

test("new choices win by field but migrated legacy values do not replace saved account preferences", async () => {
  const { service } = setup();
  await service.initialize({ ageConfirmed: true, addressPreference: "你" });
  await service.activate(null);
  await service.change({ addressPreference: "妳" });
  await service.activate(accountA);
  const api = remote({ ...defaults, ageConfirmed: false, addressPreference: "你", revision: 2 });
  await service.sync(api);
  expect(service.getSnapshot().preferences).toMatchObject({ ageConfirmed: false, addressPreference: "妳" });
});

test("migrated values seed an empty account and new journeys can reuse them", async () => {
  const { service } = setup();
  await service.initialize({ ageConfirmed: true, addressPreference: "妳" });
  await service.activate(accountA);
  await service.sync(remote());
  expect(service.getSnapshot()).toMatchObject({ syncStatus: "saved", preferences: { ageConfirmed: true, addressPreference: "妳" } });
});

test("failed sync keeps a durable pending revocation and retries without restoring remote adult permission", async () => {
  const { service, storage } = setup();
  await start(service);
  await service.activate(accountA);
  const api = remote({ ...defaults, ageConfirmed: true, revision: 1 });
  await service.sync(api);
  await service.change({ ageConfirmed: false });
  const failing = { ...api, update: jest.fn(async () => { throw new Error("offline"); }) };
  await service.sync(failing);
  expect(service.getSnapshot()).toMatchObject({ syncStatus: "error", preferences: { ageConfirmed: false } });
  const restarted = new AccountPreferencesService(storage);
  await restarted.initialize(defaults);
  await restarted.activate(accountA);
  expect(restarted.getSnapshot().preferences.ageConfirmed).toBe(false);
  await restarted.sync(api);
  expect(await api.get()).toMatchObject({ ageConfirmed: false });
});

test("an in-flight response never replaces newer local choices or another account", async () => {
  const { service } = setup();
  await start(service);
  await service.activate(accountA);
  let resolve!: (value: typeof defaults) => void;
  const api = remote();
  const slow = { ...api, get: () => new Promise<typeof defaults>((done) => { resolve = done; }) };
  const syncing = service.sync(slow);
  await service.change({ addressPreference: "妳" });
  await service.activate(accountB);
  resolve(defaults);
  await syncing;
  expect(service.getSnapshot()).toMatchObject({ owner: accountB, preferences: defaults });
  await service.activate(accountA);
  await service.sync(api);
  expect(await api.get()).toMatchObject({ addressPreference: "妳" });
});

test("clearing local data fences pending responses and leaves the server record untouched", async () => {
  const { service, storage } = setup();
  await start(service);
  await service.activate(accountA);
  const api = remote({ ...defaults, ageConfirmed: true, revision: 1 });
  await service.sync(api);
  await service.clear();
  expect(service.getSnapshot()).toMatchObject({ owner: null, preferences: defaults });
  const restarted = new AccountPreferencesService(storage);
  await start(restarted);
  expect(restarted.getSnapshot().preferences).toMatchObject(defaults);
  await restarted.activate(accountA);
  await restarted.sync(api);
  expect(restarted.getSnapshot().preferences.ageConfirmed).toBe(true);
});

test("acknowledges each field separately so changing address cannot resend an already-saved adult confirmation", async () => {
  const { service } = setup();
  await start(service);
  await service.activate(accountA);
  await service.change({ ageConfirmed: true });
  let release!: () => void;
  let started!: () => void;
  const dispatched = new Promise<void>((resolve) => { started = resolve; });
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  let server = { ...defaults } as Awaited<ReturnType<PreferencesRemote["get"]>>;
  const api: PreferencesRemote = {
    get: async () => server,
    update: async (revision, changes) => {
      if (revision !== server.revision) throw Object.assign(new Error(), { code: "ACCOUNT_PREFERENCES_CONFLICT" });
      server = { ...server, ...changes, revision: revision + 1 };
      if (revision === 0) {
        const response = server;
        started();
        await delayed;
        server = { ...server, ageConfirmed: false, revision: 2 };
        return response;
      }
      return server;
    },
  };
  const syncing = service.sync(api);
  await dispatched;
  await service.change({ addressPreference: "妳" });
  release();
  await syncing;
  expect(server).toMatchObject({ ageConfirmed: false, addressPreference: "妳" });
});
