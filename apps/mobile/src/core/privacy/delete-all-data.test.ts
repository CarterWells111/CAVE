import { deleteAllData } from "./delete-all-data";
import type { EncryptedDatabaseManager } from "../storage/database";

test("delete all closes, removes files, and deletes secrets without rebuilding storage", async () => {
  const order: string[] = [];
  const database = {
    close: jest.fn(async () => { order.push("close"); }),
    removeDatabaseFiles: jest.fn(async () => { order.push("remove"); }),
    initialize: jest.fn(async () => { order.push("initialize"); return undefined; })
  };
  const secrets = { deleteAllSecrets: jest.fn(async () => { order.push("secrets"); }) };

  await deleteAllData({ database: database as unknown as EncryptedDatabaseManager, secrets });
  await deleteAllData({ database: database as unknown as EncryptedDatabaseManager, secrets });

  expect(order).toEqual([
    "close", "remove", "secrets",
    "close", "remove", "secrets"
  ]);
  expect(database.initialize).not.toHaveBeenCalled();
});
