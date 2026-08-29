import { createManagedAvatarFileStore } from "./expo-account-profile-dependencies";

function harness() {
  const directory = {
    uri: "file:///private/account-avatars/",
    exists: false,
    create: jest.fn(),
    delete: jest.fn(),
  };
  const files = new Map<string, {
    uri: string;
    extension: string;
    exists: boolean;
    copy: jest.Mock;
    delete: jest.Mock;
  }>();
  const make = (uri: string) => {
    const file = {
      uri,
      extension: uri.endsWith(".png") ? ".png" : ".jpg",
      exists: true,
      copy: jest.fn(),
      delete: jest.fn(),
    };
    files.set(uri, file);
    return file;
  };
  const store = createManagedAvatarFileStore({
    directory,
    fileAt: (uri) => files.get(uri) ?? make(uri),
    fileInDirectory: (name) => make(`${directory.uri}${name}`),
    copyFile: (source, destination) => files.get(source.uri)?.copy(destination),
    now: () => 123,
  });
  return { directory, files, store };
}

test("copies the picked image into the private managed directory", async () => {
  const { directory, files, store } = harness();
  const source = "file:///picker/temporary.png";

  await expect(store.copy("cb02004c-7b5b-4680-9b16-8a6a33511bc9", source))
    .resolves.toBe("file:///private/account-avatars/cb02004c-7b5b-4680-9b16-8a6a33511bc9-123.png");

  expect(directory.create).toHaveBeenCalledWith({ idempotent: true, intermediates: true });
  expect(files.get(source)?.copy).toHaveBeenCalledWith(
    files.get("file:///private/account-avatars/cb02004c-7b5b-4680-9b16-8a6a33511bc9-123.png"),
  );
});

test("never deletes arbitrary or nested paths outside the managed direct children", async () => {
  const { files, store } = harness();
  const outside = "file:///private/not-managed.jpg";
  const nested = "file:///private/account-avatars/nested/file.jpg";

  await store.remove(outside);
  await store.remove(nested);

  expect(files.get(outside)).toBeUndefined();
  expect(files.get(nested)).toBeUndefined();
});

test("deletes a managed direct child and clears the managed directory idempotently", async () => {
  const { directory, files, store } = harness();
  const managed = "file:///private/account-avatars/avatar.jpg";

  await store.remove(managed);
  expect(files.get(managed)?.delete).toHaveBeenCalledTimes(1);

  await store.clearAll();
  expect(directory.delete).not.toHaveBeenCalled();
  directory.exists = true;
  await store.clearAll();
  expect(directory.delete).toHaveBeenCalledTimes(1);
});
