import type { EncryptedDatabaseManager } from "../storage/database";
import type { SecretRepository } from "../storage/types";

type DeleteAllDataDependencies = {
  database: EncryptedDatabaseManager;
  secrets: Pick<SecretRepository, "deleteAllSecrets">;
};

export async function deleteAllData({ database, secrets }: DeleteAllDataDependencies) {
  await database.close();
  await database.removeDatabaseFiles();
  await secrets.deleteAllSecrets();
  await database.initialize();
}
