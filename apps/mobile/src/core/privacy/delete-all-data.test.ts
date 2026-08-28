import type { EncryptedDatabaseManager } from "../storage/database";
import type { DatabaseSecretRepository } from "../storage/key-store";
import { DeleteAllDataIncompleteError, deleteAllData } from "./delete-all-data";

type FailureStage =
  | "record-intent"
  | "clear-gate"
  | "quiesce"
  | "delete-key"
  | "remove-files"
  | "delete-token"
  | "clear-intent";

function makeHarness(failOnceAt?: FailureStage) {
  const order: string[] = [];
  let pending = false;
  let failure = failOnceAt;
  const database = {
    initialize: jest.fn(),
    close: jest.fn(),
    removeDatabaseFiles: jest.fn(),
    withExclusiveMaintenance: jest.fn(async (
      operation: (maintenance: { removeDatabaseFiles(): Promise<void> }) => Promise<unknown>
    ) => {
      order.push("quiesce");
      if (failure === "quiesce") {
        failure = undefined;
        throw new Error("quiesce-failed");
      }
      return await operation({
        async removeDatabaseFiles() {
          order.push("remove-files");
          if (failure === "remove-files") {
            failure = undefined;
            throw new Error("remove-failed");
          }
        }
      });
    })
  } as unknown as EncryptedDatabaseManager;
  const secrets = {
    recordPendingLocalDataDeletion: jest.fn(async () => {
      order.push("record-intent");
      if (failure === "record-intent") {
        failure = undefined;
        throw new Error("record-failed");
      }
      pending = true;
    }),
    deleteAdultDeclaration: jest.fn(async () => {
      order.push("clear-gate");
      if (failure === "clear-gate") {
        failure = undefined;
        throw new Error("clear-gate-failed");
      }
    }),
    deleteDatabaseKey: jest.fn(async () => {
      order.push("delete-key");
      if (failure === "delete-key") {
        failure = undefined;
        throw new Error("delete-key-failed");
      }
    }),
    deleteInstallationToken: jest.fn(async () => {
      order.push("delete-token");
      if (failure === "delete-token") {
        failure = undefined;
        throw new Error("delete-token-failed");
      }
    }),
    clearPendingLocalDataDeletion: jest.fn(async () => {
      order.push("clear-intent");
      if (failure === "clear-intent") {
        failure = undefined;
        throw new Error("clear-intent-failed");
      }
      pending = false;
    })
  } as unknown as DatabaseSecretRepository;
  return { database, secrets, order, isPending: () => pending };
}

test("records intent, fails closed, and monotonically deletes local storage", async () => {
  const harness = makeHarness();

  await deleteAllData(harness);

  expect(harness.order).toEqual([
    "record-intent",
    "clear-gate",
    "quiesce",
    "delete-key",
    "remove-files",
    "delete-token",
    "clear-intent"
  ]);
  expect(harness.isPending()).toBe(false);
  expect(harness.database.initialize).not.toHaveBeenCalled();
});

test("keeps durable intent after partial failure and converges on retry", async () => {
  const harness = makeHarness("remove-files");

  await expect(deleteAllData(harness)).rejects.toEqual(
    expect.objectContaining({ name: "DeleteAllDataIncompleteError", stage: "remove-files" })
  );
  expect(harness.isPending()).toBe(true);
  expect(harness.secrets.clearPendingLocalDataDeletion).not.toHaveBeenCalled();

  await expect(deleteAllData(harness)).resolves.toBeUndefined();
  expect(harness.isPending()).toBe(false);
  expect(harness.order.slice(-7)).toEqual([
    "record-intent",
    "clear-gate",
    "quiesce",
    "delete-key",
    "remove-files",
    "delete-token",
    "clear-intent"
  ]);
});

test("does not claim pending deletion when recording the intent fails", async () => {
  const harness = makeHarness("record-intent");

  const deletion = deleteAllData(harness);
  await expect(deletion).rejects.toBeInstanceOf(DeleteAllDataIncompleteError);
  await expect(deletion).rejects.toMatchObject({
    cause: expect.objectContaining({ message: "record-failed" })
  });
  expect(harness.isPending()).toBe(false);
  expect(harness.order).toEqual(["record-intent"]);
});

test.each<FailureStage>([
  "clear-gate",
  "quiesce",
  "delete-key",
  "delete-token",
  "clear-intent"
])("keeps deletion pending when %s fails and completes on retry", async (stage) => {
  const harness = makeHarness(stage);

  await expect(deleteAllData(harness)).rejects.toMatchObject({ stage });
  expect(harness.isPending()).toBe(true);

  await expect(deleteAllData(harness)).resolves.toBeUndefined();
  expect(harness.isPending()).toBe(false);
});
