import type { EncryptedDatabaseManager } from "../storage/database";
import type { DatabaseSecretRepository } from "../storage/key-store";

export type DeleteAllDataStage =
  | "record-intent"
  | "clear-gate"
  | "quiesce"
  | "delete-key"
  | "remove-files"
  | "delete-account-profiles"
  | "delete-token"
  | "delete-auth-session"
  | "clear-intent";

export class DeleteAllDataIncompleteError extends Error {
  override readonly cause: unknown;

  constructor(readonly stage: DeleteAllDataStage, cause?: unknown) {
    super(`Local data deletion incomplete at stage: ${stage}`);
    this.name = "DeleteAllDataIncompleteError";
    this.cause = cause;
  }
}

type DeleteAllDataDependencies = {
  database: EncryptedDatabaseManager;
  accountProfiles: { clearAll(): Promise<void> };
  secrets: Pick<
    DatabaseSecretRepository,
    | "recordPendingLocalDataDeletion"
    | "deleteAdultDeclaration"
    | "deleteDatabaseKey"
    | "deleteInstallationToken"
    | "deleteAuthSession"
    | "clearPendingLocalDataDeletion"
  >;
};

export async function deleteAllData({ accountProfiles, database, secrets }: DeleteAllDataDependencies) {
  async function run(stage: DeleteAllDataStage, operation: () => Promise<void>) {
    try {
      await operation();
    } catch (error) {
      throw new DeleteAllDataIncompleteError(stage, error);
    }
  }

  await run("record-intent", () => secrets.recordPendingLocalDataDeletion());
  await run("clear-gate", () => secrets.deleteAdultDeclaration());
  try {
    await database.withExclusiveMaintenance(async (maintenance) => {
      await run("delete-key", () => secrets.deleteDatabaseKey());
      await run("remove-files", () => maintenance.removeDatabaseFiles());
    });
  } catch (error) {
    if (error instanceof DeleteAllDataIncompleteError) throw error;
    throw new DeleteAllDataIncompleteError("quiesce", error);
  }
  await run("delete-account-profiles", () => accountProfiles.clearAll());
  await run("delete-token", () => secrets.deleteInstallationToken());
  await run("delete-auth-session", () => secrets.deleteAuthSession());
  await run("clear-intent", () => secrets.clearPendingLocalDataDeletion());
}
