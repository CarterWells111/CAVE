import { Directory, File, Paths } from "expo-file-system";
import * as ExpoSecureStore from "expo-secure-store";

import { createExpoSecureStoreAdapter } from "../../../core/storage/key-store";
import { createAccountProfileRepository } from "./account-profile-repository";

const PROFILE_STORE_KEY = "account.profiles.v1";
const AVATAR_DIRECTORY_NAME = "account-avatars";
const SAFE_IMAGE_EXTENSIONS = new Set([".heic", ".jpeg", ".jpg", ".png", ".webp"]);

type ExpoSecureStoreModule = Parameters<typeof createExpoSecureStoreAdapter>[0];

type ManagedDirectory = {
  readonly uri: string;
  exists: boolean;
  create(options: { idempotent: boolean; intermediates: boolean }): void;
  delete(): void;
};

type ManagedFile = {
  readonly uri: string;
  readonly extension: string;
  readonly exists: boolean;
  delete(): void;
};

export function createManagedAvatarFileStore({
  directory,
  fileAt,
  fileInDirectory,
  copyFile,
  now,
}: {
  directory: ManagedDirectory;
  fileAt(uri: string): ManagedFile;
  fileInDirectory(name: string): ManagedFile;
  copyFile(source: ManagedFile, destination: ManagedFile): void;
  now(): number;
}) {
  const isManaged = (uri: string) => uri.startsWith(directory.uri)
    && !uri.slice(directory.uri.length).includes("/");

  return {
    async copy(accountId: string, sourceUri: string) {
      directory.create({ idempotent: true, intermediates: true });
      const source = fileAt(sourceUri);
      const extension = SAFE_IMAGE_EXTENSIONS.has(source.extension.toLowerCase())
        ? source.extension.toLowerCase()
        : ".jpg";
      const destination = fileInDirectory(`${accountId}-${now()}${extension}`);
      copyFile(source, destination);
      return destination.uri;
    },
    async remove(uri: string) {
      if (!isManaged(uri)) return;
      const file = fileAt(uri);
      if (file.exists) file.delete();
    },
    async clearAll() {
      if (directory.exists) directory.delete();
    },
  };
}

function createAvatarFileStore(now: () => number) {
  const directory = new Directory(Paths.document, AVATAR_DIRECTORY_NAME);
  return createManagedAvatarFileStore({
    directory,
    fileAt: (uri) => new File(uri),
    fileInDirectory: (name) => new File(directory, name),
    copyFile: (source, destination) => {
      (source as File).copy(destination as File);
    },
    now,
  });
}

export function createExpoAccountProfileRepository() {
  const secureStore = createExpoSecureStoreAdapter(
    ExpoSecureStore as unknown as ExpoSecureStoreModule,
  );
  return createAccountProfileRepository({
    avatars: createAvatarFileStore(Date.now),
    now: () => new Date().toISOString(),
    storage: {
      get: () => secureStore.getItemAsync(PROFILE_STORE_KEY),
      set: (value) => secureStore.setItemAsync(PROFILE_STORE_KEY, value, {
        keychainAccessible: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY",
      }),
      clear: () => secureStore.deleteItemAsync(PROFILE_STORE_KEY),
    },
  });
}
