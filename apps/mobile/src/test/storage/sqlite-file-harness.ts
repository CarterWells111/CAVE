// Node SQLite tests validate SQL and durability only. Capability is explicitly simulated;
// this adapter does not encrypt data and must never be used by the application.
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEncryptedDatabaseManager, type DatabaseConnection } from "../../core/storage/database";
import { createSecretRepository, SECRET_NAMES } from "../../core/storage/key-store";
import type { HistoricalDatabaseFixture } from "./historical-fixtures";

export function createSqliteFileHarness(fixture?: HistoricalDatabaseFixture) {
  const directory = mkdtempSync(join(tmpdir(), "cave-synthetic-sqlite-"));
  const path = join(directory, "cave.db");
  const pendingIntentPath = join(directory, "synthetic-deletion-intent");
  const handles = new Set<DatabaseSync>();
  const values = new Map<string, string>();
  const events: string[] = [];
  let fault: ((operation: string, sql: string) => void) | undefined;
  const secureStore = {
    async getItemAsync(key: string) {
      if (key === SECRET_NAMES.deletionPending) return existsSync(pendingIntentPath) ? readFileSync(pendingIntentPath, "utf8") : null;
      return values.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string) {
      fault?.("secret-set", key);
      if (key === SECRET_NAMES.deletionPending) writeFileSync(pendingIntentPath, value);
      values.set(key, value);
    },
    async deleteItemAsync(key: string) {
      fault?.("secret-delete", key);
      if (key === SECRET_NAMES.deletionPending) rmSync(pendingIntentPath, { force: true });
      values.delete(key);
    }
  };
  function secrets() {
    return createSecretRepository({ secureStore, randomBytes: () => new Uint8Array(32).fill(7) });
  }
  function openRaw() { const db = new DatabaseSync(path); handles.add(db); return db; }
  function closeRaw(db: DatabaseSync) { db.close(); handles.delete(db); }
  if (fixture) {
    const db = openRaw();
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(fixture.schemaSql);
    db.exec(fixture.seedSql);
    db.exec(`PRAGMA user_version=${fixture.version}`);
    closeRaw(db);
    values.set(SECRET_NAMES.databaseKey, "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=");
  }
  const native = {
    async openDatabaseAsync(): Promise<DatabaseConnection> {
      events.push("open");
      const db = openRaw();
      return {
        async execAsync(sql) {
          // Never record the synthetic key SQL in diagnostics output.
          if (sql.startsWith("PRAGMA key")) return;
          events.push(sql); fault?.("exec", sql); db.exec(sql); fault?.("exec-after", sql);
        },
        async runAsync(sql, ...params) {
          events.push(sql); fault?.("run", sql);
          const changes = Number(db.prepare(sql).run(...params as SQLInputValue[]).changes);
          fault?.("run-after", sql);
          return { changes };
        },
        async getAllAsync<T>(sql: string, ...params: unknown[]) {
          fault?.("all", sql); return db.prepare(sql).all(...params as SQLInputValue[]) as T[];
        },
        async getFirstAsync<T>(sql: string, ...params: unknown[]) {
          fault?.("first", sql);
          if (sql === "PRAGMA cipher_version") return { cipher_version: "SIMULATED-NOT-ENCRYPTED" } as T;
          return (db.prepare(sql).get(...params as SQLInputValue[]) ?? null) as T | null;
        },
        async closeAsync() { events.push("close"); fault?.("close", ""); closeRaw(db); }
      };
    }
  };
  const files = {
    coordinationKey: directory,
    async databaseExists() { return existsSync(path); },
    async removeDatabaseFiles() {
      for (const suffix of ["", "-wal", "-shm"]) {
        fault?.("remove", suffix);
        rmSync(path + suffix, { force: true });
      }
      events.push("removed-files");
    }
  };
  return {
    directory, path, pendingIntentPath, values, events, native, files, secrets, openRaw, closeRaw,
    setFault(next?: typeof fault) { fault = next; },
    manager() { return createEncryptedDatabaseManager({ native, files, secrets: secrets() }); },
    bytes() { return readFileSync(path); },
    cleanup() {
      for (const db of handles) db.close();
      handles.clear();
      rmSync(directory, { recursive: true, force: true });
    }
  };
}
