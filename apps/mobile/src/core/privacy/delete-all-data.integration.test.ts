import { existsSync, writeFileSync } from "node:fs";
import { createSqliteFileHarness } from "../../test/storage/sqlite-file-harness";
import { HISTORICAL_DATABASE_FIXTURES } from "../../test/storage/historical-fixtures";
import { SECRET_NAMES } from "../storage/key-store";
import { createComposedJourneyRuntime } from "../../features/journey/runtime/default-journey-runtime";

const failurePoints = [
  ["clear-gate", "secret-delete", SECRET_NAMES.adultDeclaration],
  ["quiesce", "close", ""],
  ["delete-key", "secret-delete", SECRET_NAMES.databaseKey],
  ["remove-files", "remove", ""],
  ["remove-files", "remove", "-wal"],
  ["remove-files", "remove", "-shm"],
  ["delete-account-profiles", "profiles", ""],
  ["delete-token", "secret-delete", SECRET_NAMES.installationToken],
  ["delete-auth-session", "secret-delete", SECRET_NAMES.authSession],
  ["clear-intent", "secret-delete", SECRET_NAMES.deletionPending]
] as const;

test.each(failurePoints)("resumes %s (%s %s) after runtime reconstruction without premature initialization", async (stage, operation, name) => {
  const h = createSqliteFileHarness(HISTORICAL_DATABASE_FIXTURES.find((fixture) => fixture.id === "v12")!);
  let fail = false;
  const injected = new Error("synthetic deletion interruption");
  let profilesExist = true;
  const accountProfiles = { async clearAll() {
    if (fail && operation === "profiles") throw injected;
    profilesExist = false;
  } };
  const compose = () => createComposedJourneyRuntime({
    executionEnvironment: "standalone", clipboard: { setStringAsync: async () => undefined },
    createId: () => "synthetic", now: () => "2026-01-01T00:00:00.000Z", accountProfiles,
    loadNativeAdapters: async () => ({
      native: { ...h.native }, files: { ...h.files }, secrets: h.secrets(),
      clipboard: { setStringAsync: async () => undefined }
    })
  });
  try {
    h.values.set(SECRET_NAMES.adultDeclaration, "confirmed");
    h.values.set(SECRET_NAMES.installationToken, "synthetic-token");
    h.values.set(SECRET_NAMES.authSession, "synthetic-session");
    const first = await compose();
    await first.appearancePreferences.save("light");
    expect(existsSync(h.path + "-wal")).toBe(true);
    expect(existsSync(h.path + "-shm")).toBe(true);
    h.setFault((currentOperation, sql) => {
      if (fail && currentOperation === operation && sql === name) throw injected;
    });
    fail = true;
    await expect(first.deleteAllData()).rejects.toMatchObject({ stage, cause: injected });
    expect(existsSync(h.pendingIntentPath)).toBe(true);
    // New adapter and repository objects read the intent from disk.
    expect(await h.secrets().hasPendingLocalDataDeletion()).toBe(true);
    const openCount = h.events.filter((event) => event === "open").length;
    await expect(first.appearancePreferences.save("dark")).rejects.toMatchObject({ code: "LOCAL_DATA_DELETION_IN_PROGRESS" });
    await expect(compose()).rejects.toMatchObject({ stage });
    expect(h.events.filter((event) => event === "open")).toHaveLength(openCount);
    // Sidecars can survive an interrupted delete independently of the main file.
    if (operation === "remove") {
      writeFileSync(h.path + "-wal", "synthetic orphan WAL");
      writeFileSync(h.path + "-shm", "synthetic orphan SHM");
    }
    fail = false;
    await compose();
    expect(h.events.filter((event) => event === "open")).toHaveLength(openCount);
    for (const suffix of ["", "-wal", "-shm"]) expect(existsSync(h.path + suffix)).toBe(false);
    expect(existsSync(h.pendingIntentPath)).toBe(false);
    expect(profilesExist).toBe(false);
    for (const key of Object.values(SECRET_NAMES)) expect(h.values.has(key)).toBe(false);
  } finally { h.cleanup(); }
});

test("failure recording intent preserves data and requires an explicit retry on the reconstructed runtime", async () => {
  const h = createSqliteFileHarness(HISTORICAL_DATABASE_FIXTURES[0]!);
  const compose = () => createComposedJourneyRuntime({
    executionEnvironment: "standalone", clipboard: { setStringAsync: async () => undefined },
    createId: () => "synthetic", now: () => "2026-01-01T00:00:00.000Z",
    loadNativeAdapters: async () => ({ native: { ...h.native }, files: { ...h.files }, secrets: h.secrets(), clipboard: { setStringAsync: async () => undefined } })
  });
  try {
    const first = await compose();
    const before = h.bytes();
    h.setFault((operation, key) => { if (operation === "secret-set" && key === SECRET_NAMES.deletionPending) throw new Error("intent unavailable"); });
    await expect(first.deleteAllData()).rejects.toMatchObject({ stage: "record-intent" });
    expect(h.bytes()).toEqual(before);
    expect(await h.secrets().hasPendingLocalDataDeletion()).toBe(false);
    expect(await h.secrets().getDatabaseKey()).not.toBeNull();
    h.setFault();
    const reconstructed = await compose();
    await reconstructed.deleteAllData();
    expect(existsSync(h.path)).toBe(false);
    expect(await h.secrets().getDatabaseKey()).toBeNull();
  } finally { h.cleanup(); }
});
