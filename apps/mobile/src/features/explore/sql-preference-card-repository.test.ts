import type { TransactionalEncryptedDatabaseManager } from "../../core/storage/database";
import { emptyPreferenceCard } from "./preference-card";
import { SqlPreferenceCardRepository } from "./sql-preference-card-repository";

it("uses encrypted database queries scoped to the active owner", async () => {
  const connection = {
    getFirstAsync: jest.fn(async () => ({ payload_json: JSON.stringify({ protection: "屏障方式" }) })),
    runAsync: jest.fn(async () => ({ changes: 1 })),
  };
  const database = { initialize: jest.fn(async () => connection) } as unknown as TransactionalEncryptedDatabaseManager;
  const repository = new SqlPreferenceCardRepository(database);

  expect(await repository.load("account-a")).toEqual({ ...emptyPreferenceCard(), protection: "屏障方式" });
  expect(connection.getFirstAsync).toHaveBeenCalledWith(
    "SELECT payload_json FROM journey_preference_cards WHERE owner_id = ?",
    "account-a",
  );
  await repository.save("account-a", { ...emptyPreferenceCard(), boundaries: "  暂时不想要纳入  " });
  expect(connection.runAsync).toHaveBeenCalledWith(
    expect.stringContaining("ON CONFLICT(owner_id) DO UPDATE"),
    "account-a",
    JSON.stringify({ ...emptyPreferenceCard(), boundaries: "暂时不想要纳入" }),
    expect.any(String),
  );
  await repository.clearAll();
  expect(connection.runAsync).toHaveBeenLastCalledWith("DELETE FROM journey_preference_cards");
});
