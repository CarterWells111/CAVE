import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { SCHEMA_V11, SCHEMA_V13 } from "../../../core/storage/migrations";
import type { DatabaseTransactionConnection } from "../../../core/storage/database";
import { createJournalRecord, createJournalEntry } from "../domain/journal-record";
import { SqlJournalRepository } from "./sql-journal-repository";

const now = "2026-10-14T10:00:00.000Z";
const original = createJournalRecord({ id: "synthetic-record", occurredAt: "2026-10-13", createdAt: now, title: "合成标题", body: "合成原文", source: { kind: "freeform" } });

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(`${SCHEMA_V11}${SCHEMA_V13}`);
  const connection: DatabaseTransactionConnection = {
    runAsync: jest.fn(async (sql: string, ...args: unknown[]) => ({ changes: Number(db.prepare(sql).run(...args as SQLInputValue[]).changes) })),
    getFirstAsync: async <T,>(sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args as SQLInputValue[]) ?? null) as T | null,
    getAllAsync: async <T,>(sql: string, ...args: unknown[]) => db.prepare(sql).all(...args as SQLInputValue[]) as T[],
  };
  const manager = {
    initialize: async () => connection,
    withTransaction: async <T,>(operation: (connection: DatabaseTransactionConnection) => Promise<T>): Promise<T> => {
      db.exec("BEGIN IMMEDIATE");
      try { const result = await operation(connection); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
  return { db, connection, manager, repository: new SqlJournalRepository(manager) };
}

test("SQL guarded confirmation commits record and original revision atomically", async () => {
  const { db, repository } = database();
  try {
    await repository.createRecord("synthetic-owner", original);
    await repository.updateRecord("synthetic-owner", { ...original, body: "确认文字" }, { id: "rev", recordId: original.id, itemId: original.id, itemKind: "record", savedAt: now, snapshot: original }, { expected: original, canCommit: () => true, now: () => now });
    expect((await repository.loadRecord("synthetic-owner", original.id))!.body).toBe("确认文字");
    expect((await repository.listRevisions("synthetic-owner", original.id))[0]!.snapshot).toEqual(original);
  } finally { db.close(); }
});

test("SQL guard rejects same-timestamp concurrent text changes, locked, deleted and foreign records", async () => {
  const { db, repository } = database();
  try {
    await repository.createRecord("synthetic-owner", original);
    const guard = { expected: original, canCommit: () => true, now: () => now };
    await repository.updateRecord("synthetic-owner", { ...original, body: "新的文字" });
    await expect(repository.updateRecord("synthetic-owner", original, undefined, guard)).rejects.toThrow("journal-record-conflict");
    await expect(repository.updateRecord("other-owner", original, undefined, guard)).rejects.toThrow("journal-record-not-found");
    await repository.updateRecord("synthetic-owner", original);
    await expect(repository.updateRecord("synthetic-owner", original, undefined, { ...guard, now: () => original.editableUntil })).rejects.toThrow("journal-item-locked");
    await repository.deleteRecord("synthetic-owner", original.id);
    await expect(repository.updateRecord("synthetic-owner", original, undefined, guard)).rejects.toThrow("journal-record-not-found");
  } finally { db.close(); }
});

test.each(["create", "update"])("SQL %s rolls back if account changes while SQLite write awaits", async operation => {
  const { db, repository, connection } = database();
  try {
    await repository.createRecord("synthetic-owner", original);
    let active = true;
    const run = connection.runAsync;
    connection.runAsync = async (sql, ...args) => {
      const result = await run(sql, ...args);
      if (sql.startsWith(operation === "create" ? "INSERT INTO journal_records" : "UPDATE journal_records")) active = false;
      return result;
    };
    const guard = { canCommit: () => active };
    if (operation === "create") {
      await expect(repository.createRecord("synthetic-owner", { ...original, id: "new" }, guard)).rejects.toThrow("journal-session-changed");
      expect(await repository.loadRecord("synthetic-owner", "new")).toBeNull();
    } else {
      await expect(repository.updateRecord("synthetic-owner", { ...original, body: "迟到修改" }, { id: "rev", recordId: original.id, itemId: original.id, itemKind: "record", savedAt: now, snapshot: original }, { ...guard, expected: original, now: () => now })).rejects.toThrow("journal-session-changed");
      expect(await repository.loadRecord("synthetic-owner", original.id)).toEqual(original);
      expect(await repository.listRevisions("synthetic-owner", original.id)).toEqual([]);
    }
  } finally { db.close(); }
});

test("SQL guarded review append preserves a locked original and accepts unchanged entries", async () => {
  const { db, repository } = database();
  try {
    await repository.createRecord("synthetic-owner", original);
    const existing = createJournalEntry({ id: "existing", recordId: original.id, kind: "event-change", occurredAt: "2026-10-15", createdAt: "2026-10-15T10:00:00.000Z", body: "已有补充" });
    await repository.createEntry("synthetic-owner", existing);
    const insight = createJournalEntry({ id: "review", recordId: original.id, kind: "insight", occurredAt: "2026-10-17", createdAt: "2026-10-17T10:00:00.000Z", body: "确认的回顾" });
    await repository.createEntry("synthetic-owner", insight, { expected: original, expectedEntries: [existing], canCommit: () => true });
    expect(await repository.loadRecord("synthetic-owner", original.id)).toEqual(original);
    expect(await repository.listEntries("synthetic-owner", original.id)).toEqual([existing, insight]);
    expect(await repository.listEntries("other-owner", original.id)).toEqual([]);
  } finally { db.close(); }
});

test.each(["account-change", "record-change", "entry-change", "delete"] as const)("SQL insight append rolls back late %s after the actual insert", async change => {
  const { db, repository, connection } = database();
  try {
    await repository.createRecord("synthetic-owner", original);
    const existing = createJournalEntry({ id: "existing", recordId: original.id, kind: "event-change", occurredAt: "2026-10-14", createdAt: now, body: "已有补充" });
    await repository.createEntry("synthetic-owner", existing);
    const insight = createJournalEntry({ id: "review", recordId: original.id, kind: "insight", occurredAt: "2026-10-17", createdAt: "2026-10-17T10:00:00.000Z", body: "迟到回顾" });
    let active = true;
    const run = connection.runAsync;
    connection.runAsync = async (sql, ...args) => {
      const result = await run(sql, ...args);
      if (sql.startsWith("INSERT INTO journal_entries")) {
        if (change === "account-change") active = false;
        if (change === "record-change") db.prepare("UPDATE journal_records SET body=? WHERE id=?").run("同毫秒新原文", original.id);
        if (change === "entry-change") db.prepare("UPDATE journal_entries SET body=? WHERE id=?").run("同毫秒新补充", existing.id);
        if (change === "delete") db.prepare("DELETE FROM journal_records WHERE id=?").run(original.id);
      }
      return result;
    };
    await expect(repository.createEntry("synthetic-owner", insight, { expected: original, expectedEntries: [existing], canCommit: () => active }))
      .rejects.toThrow(change === "account-change" ? "journal-session-changed" : change === "delete" ? "journal-record-not-found" : "journal-record-conflict");
    expect(await repository.loadRecord("synthetic-owner", original.id)).toEqual(original);
    expect(await repository.listEntries("synthetic-owner", original.id)).toEqual([existing]);
    expect(await repository.loadEntry("synthetic-owner", insight.id)).toBeNull();
  } finally { db.close(); }
});

test("SQL append guard rejects foreign owners and deleted or changed read entries before writing", async () => {
  const { db, repository } = database();
  try {
    await repository.createRecord("synthetic-owner", original);
    const existing = createJournalEntry({ id: "existing", recordId: original.id, kind: "event-change", occurredAt: "2026-10-14", createdAt: now, body: "原有补充" });
    const insight = createJournalEntry({ id: "review", recordId: original.id, kind: "insight", occurredAt: "2026-10-17", createdAt: now, body: "回顾" });
    await repository.createEntry("synthetic-owner", existing);
    const guard = { expected: original, expectedEntries: [existing], canCommit: () => true };
    await expect(repository.createEntry("other-owner", insight, guard)).rejects.toThrow("journal-record-not-found");
    await repository.deleteEntry("synthetic-owner", existing.id);
    await expect(repository.createEntry("synthetic-owner", insight, guard)).rejects.toThrow("journal-record-conflict");
    expect(await repository.listEntries("synthetic-owner", original.id)).toEqual([]);
  } finally { db.close(); }
});

const periodReview = {
  id: "synthetic-period-review", periodStart: "2026-10-01T00:00:00.000Z", periodEnd: now,
  createdAt: now, updatedAt: now, editableUntil: "2026-10-15T10:00:00.000Z",
  title: "合成阶段回顾", body: "合成小结", sourceRecordIds: [original.id],
};

test("SQL period review does not write after its guard is revoked while queued", async () => {
  const { db, connection, manager } = database();
  let release!: () => void;
  const queue = new Promise<void>((resolve) => { release = resolve; });
  let active = true;
  const repository = new SqlJournalRepository({
    ...manager,
    withTransaction: async (operation) => {
      await queue;
      return manager.withTransaction(operation);
    },
  });
  try {
    const saving = repository.savePeriodReview("synthetic-owner", periodReview, { canCommit: () => active });
    active = false;
    release();
    await expect(saving).rejects.toThrow("journal-session-changed");
    expect(connection.runAsync).not.toHaveBeenCalled();
    expect(await repository.listPeriodReviews("synthetic-owner")).toEqual([]);
  } finally { db.close(); }
});

test.each(["create", "update"] as const)("SQL period review %s rolls back when its guard is revoked after the write", async (operation) => {
  const { db, connection, repository } = database();
  try {
    await repository.savePeriodReview("synthetic-owner", periodReview, { canCommit: () => true });
    let active = true;
    const run = connection.runAsync;
    connection.runAsync = async (sql, ...args) => {
      const result = await run(sql, ...args);
      if (sql.startsWith("INSERT INTO journal_period_reviews")) active = false;
      return result;
    };
    const pendingReview = { ...periodReview, id: operation === "create" ? "synthetic-new-review" : periodReview.id, body: "取消后不应落盘的小结" };
    await expect(repository.savePeriodReview("synthetic-owner", pendingReview, { canCommit: () => active }))
      .rejects.toThrow("journal-session-changed");
    expect(await repository.listPeriodReviews("synthetic-owner")).toEqual([periodReview]);
  } finally { db.close(); }
});
