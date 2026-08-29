import { createAccountProfileRepository } from "./account-profile-repository";

const ACCOUNT_A = "cb02004c-7b5b-4680-9b16-8a6a33511bc9";
const ACCOUNT_B = "fb37d589-c1de-4300-8a93-63df012bbfb2";

function harness(initial: string | null = null) {
  let encoded = initial;
  const storage = {
    get: jest.fn(async () => encoded),
    set: jest.fn(async (value: string) => { encoded = value; }),
    clear: jest.fn(async () => { encoded = null; }),
  };
  const avatars = {
    copy: jest.fn(async (accountId: string) => `file:///account-avatars/${accountId}.jpg`),
    remove: jest.fn(async () => undefined),
    clearAll: jest.fn(async () => undefined),
  };
  const repository = createAccountProfileRepository({
    avatars,
    now: () => "2026-08-29T10:00:00.000Z",
    storage,
  });
  return { avatars, repository, storage, value: () => encoded };
}

test("returns a neutral default without writing it and keeps accounts isolated", async () => {
  const { repository, storage } = harness();

  expect(await repository.load(ACCOUNT_A)).toEqual({
    accountId: ACCOUNT_A,
    displayName: "内界用户",
    updatedAt: null,
  });
  await repository.saveDisplayName(ACCOUNT_A, "  阿岚  ");

  expect((await repository.load(ACCOUNT_A)).displayName).toBe("阿岚");
  expect((await repository.load(ACCOUNT_B)).displayName).toBe("内界用户");
  expect(storage.set).toHaveBeenCalledTimes(1);
});

test("validates account ids and display names before touching storage", async () => {
  const { repository, storage } = harness();

  await expect(repository.load("not-an-account")).rejects.toThrow("account-profile-invalid-account");
  await expect(repository.saveDisplayName(ACCOUNT_A, "   ")).rejects.toThrow("account-profile-invalid-name");
  await expect(repository.saveDisplayName(ACCOUNT_A, "界".repeat(25))).rejects.toThrow("account-profile-invalid-name");
  expect(storage.set).not.toHaveBeenCalled();
});

test("falls back safely from corrupt storage", async () => {
  const { repository } = harness("private-corrupt-value");

  expect(await repository.load(ACCOUNT_A)).toEqual({
    accountId: ACCOUNT_A,
    displayName: "内界用户",
    updatedAt: null,
  });
});

test("isolates a corrupt account entry without erasing valid profiles", async () => {
  const initial = JSON.stringify({
    [ACCOUNT_A]: { displayName: "阿岚", updatedAt: "2026-08-28T10:00:00.000Z" },
    [ACCOUNT_B]: { displayName: "界".repeat(25), updatedAt: "2026-08-28T10:00:00.000Z" },
  });
  const { repository, value } = harness(initial);

  expect((await repository.load(ACCOUNT_A)).displayName).toBe("阿岚");
  expect((await repository.load(ACCOUNT_B)).displayName).toBe("内界用户");
  await repository.saveDisplayName(ACCOUNT_B, "小界");

  expect(JSON.parse(value() ?? "{}")).toEqual(expect.objectContaining({
    [ACCOUNT_A]: expect.objectContaining({ displayName: "阿岚" }),
    [ACCOUNT_B]: expect.objectContaining({ displayName: "小界" }),
  }));
});

test("copies an avatar before replacing metadata and can restore the default", async () => {
  const { avatars, repository } = harness();

  const saved = await repository.replaceAvatar(ACCOUNT_A, "file:///picker/temporary.jpg");
  expect(avatars.copy).toHaveBeenCalledWith(ACCOUNT_A, "file:///picker/temporary.jpg");
  expect(saved.avatarUri).toBe(`file:///account-avatars/${ACCOUNT_A}.jpg`);

  const restored = await repository.removeAvatar(ACCOUNT_A);
  expect(avatars.remove).toHaveBeenCalledWith(`file:///account-avatars/${ACCOUNT_A}.jpg`);
  expect(restored.avatarUri).toBeUndefined();
});

test("keeps the old avatar when copied metadata cannot be committed", async () => {
  const { avatars, repository, storage } = harness();
  await repository.replaceAvatar(ACCOUNT_A, "file:///picker/first.jpg");
  const oldUri = (await repository.load(ACCOUNT_A)).avatarUri;
  avatars.copy.mockResolvedValueOnce("file:///account-avatars/new.jpg");
  storage.set.mockRejectedValueOnce(new Error("secure-store-failed"));

  await expect(repository.replaceAvatar(ACCOUNT_A, "file:///picker/second.jpg"))
    .rejects.toThrow("secure-store-failed");

  expect((await repository.load(ACCOUNT_A)).avatarUri).toBe(oldUri);
  expect(avatars.remove).toHaveBeenCalledWith("file:///account-avatars/new.jpg");
  expect(avatars.remove).not.toHaveBeenCalledWith(oldUri);
});

test("does not delete the current avatar when removing its metadata fails", async () => {
  const { avatars, repository, storage } = harness();
  await repository.replaceAvatar(ACCOUNT_A, "file:///picker/first.jpg");
  const oldUri = (await repository.load(ACCOUNT_A)).avatarUri;
  storage.set.mockRejectedValueOnce(new Error("secure-store-failed"));

  await expect(repository.removeAvatar(ACCOUNT_A)).rejects.toThrow("secure-store-failed");

  expect((await repository.load(ACCOUNT_A)).avatarUri).toBe(oldUri);
  expect(avatars.remove).not.toHaveBeenCalledWith(oldUri);
});

test("does not replace stored metadata when the avatar copy fails", async () => {
  const { avatars, repository, storage } = harness();
  avatars.copy.mockRejectedValueOnce(new Error("private file path"));

  await expect(repository.replaceAvatar(ACCOUNT_A, "file:///picker/temporary.jpg"))
    .rejects.toThrow("private file path");
  expect(storage.set).not.toHaveBeenCalled();
});

test("clears avatar files and profile metadata", async () => {
  const { avatars, repository, storage } = harness();

  await repository.clearAll();

  expect(avatars.clearAll).toHaveBeenCalledTimes(1);
  expect(storage.clear).toHaveBeenCalledTimes(1);
});
