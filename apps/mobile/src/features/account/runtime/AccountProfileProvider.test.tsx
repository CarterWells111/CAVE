import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import type { AccountProfile } from "../domain/account-profile";
import type { AccountProfileRepository } from "../infrastructure/account-profile-repository";
import {
  AccountProfileProvider,
  type AccountProfilePicker,
  useAccountProfile,
} from "./AccountProfileProvider";

const ACCOUNT_A = "a3e0d2f7-ff19-47fe-b9cc-b6fc9346722f";
const ACCOUNT_B = "a62718f1-f1e7-4882-b01b-47c633004432";

let mockAuth = {
  status: "loading" as "loading" | "signedOut" | "signedIn" | "offline",
  accountId: undefined as string | undefined,
  email: undefined as string | undefined,
};

jest.mock("../../auth/runtime/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function profile(accountId: string, displayName: string, avatarUri?: string): AccountProfile {
  return {
    accountId,
    displayName,
    ...(avatarUri === undefined ? {} : { avatarUri }),
    updatedAt: "2026-08-29T10:00:00.000Z",
  };
}

function createRepository(): jest.Mocked<AccountProfileRepository> {
  return {
    load: jest.fn(async (accountId) => profile(accountId, `用户-${accountId.slice(0, 4)}`)),
    saveDisplayName: jest.fn(async (accountId, value) => profile(accountId, value.trim())),
    replaceAvatar: jest.fn(async (accountId, uri) => profile(accountId, "内界用户", uri)),
    removeAvatar: jest.fn(async (accountId) => profile(accountId, "内界用户")),
    clearAll: jest.fn(async () => undefined),
  };
}

function createPicker(): jest.Mocked<AccountProfilePicker> {
  return {
    requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
    launchImageLibraryAsync: jest.fn(async (
      options: Parameters<AccountProfilePicker["launchImageLibraryAsync"]>[0],
    ) => {
      void options;
      return {
        canceled: false,
        assets: [{ uri: "file:///picked-avatar.jpg" }],
      };
    }),
  };
}

function Probe() {
  const value = useAccountProfile();
  const [saveResult, setSaveResult] = useState("idle");
  return (
    <>
      <Text>{`status:${value.status}`}</Text>
      <Text>{`account:${value.accountId ?? "none"}`}</Text>
      <Text>{`email:${value.email ?? "none"}`}</Text>
      <Text>{`name:${value.profile?.displayName ?? "none"}`}</Text>
      <Text>{`avatar:${value.profile?.avatarUri ?? "none"}`}</Text>
      <Text>{`error:${value.error ?? "none"}`}</Text>
      <Text>{`save-result:${saveResult}`}</Text>
      <Text accessibilityRole="button" onPress={() => {
        void value.saveDisplayName(" 新昵称 ").then(
          () => setSaveResult("fulfilled"),
          () => setSaveResult("rejected"),
        );
      }}>save</Text>
      <Text accessibilityRole="button" onPress={() => { void value.chooseAvatar(); }}>choose</Text>
      <Text accessibilityRole="button" onPress={() => { void value.removeAvatar(); }}>remove</Text>
      <Text accessibilityRole="button" onPress={value.retry}>retry</Text>
    </>
  );
}

function renderProvider(
  repository = createRepository(),
  picker = createPicker(),
) {
  return {
    picker,
    repository,
    ...render(
      <AccountProfileProvider dependencies={{ picker, repository }}>
        <Probe />
      </AccountProfileProvider>,
    ),
  };
}

beforeEach(() => {
  mockAuth = { status: "loading", accountId: undefined, email: undefined };
});

test("does not load a profile while auth is loading or signed out", () => {
  const view = renderProvider();
  expect(screen.getByText("status:loading")).toBeTruthy();
  expect(view.repository.load).not.toHaveBeenCalled();

  mockAuth = { status: "signedOut", accountId: undefined, email: undefined };
  view.rerender(
    <AccountProfileProvider dependencies={{ picker: view.picker, repository: view.repository }}>
      <Probe />
    </AccountProfileProvider>,
  );
  expect(screen.getByText("status:signedOut")).toBeTruthy();
  expect(view.repository.load).not.toHaveBeenCalled();
});

test("loads the exact authenticated account and exposes its local email", async () => {
  mockAuth = { status: "offline", accountId: ACCOUNT_A, email: "person@example.com" };
  const view = renderProvider();
  expect(screen.getByText("status:loading")).toBeTruthy();
  expect(await screen.findByText("name:用户-a3e0")).toBeTruthy();
  expect(screen.getByText("email:person@example.com")).toBeTruthy();
  expect(view.repository.load).toHaveBeenCalledWith(ACCOUNT_A);
});

test("hides the old account immediately and ignores its late load after an account switch", async () => {
  const first = deferred<AccountProfile>();
  const second = deferred<AccountProfile>();
  const repository = createRepository();
  repository.load.mockImplementation((accountId) => (
    accountId === ACCOUNT_A ? first.promise : second.promise
  ));
  mockAuth = { status: "signedIn", accountId: ACCOUNT_A, email: "a@example.com" };
  const view = renderProvider(repository);

  mockAuth = { status: "signedIn", accountId: ACCOUNT_B, email: "b@example.com" };
  view.rerender(
    <AccountProfileProvider dependencies={{ picker: view.picker, repository }}>
      <Probe />
    </AccountProfileProvider>,
  );
  expect(screen.getByText("status:loading")).toBeTruthy();
  expect(screen.getByText("name:none")).toBeTruthy();

  await act(async () => { first.resolve(profile(ACCOUNT_A, "旧账号")); });
  expect(screen.queryByText("name:旧账号")).toBeNull();
  expect(screen.getByText("status:loading")).toBeTruthy();

  await act(async () => { second.resolve(profile(ACCOUNT_B, "新账号")); });
  expect(screen.getByText("status:ready")).toBeTruthy();
  expect(screen.getByText("name:新账号")).toBeTruthy();
  expect(screen.getByText(`account:${ACCOUNT_B}`)).toBeTruthy();
});

test("updates display name and avatar, requests permission on demand, and removes the avatar", async () => {
  mockAuth = { status: "signedIn", accountId: ACCOUNT_A, email: "a@example.com" };
  const view = renderProvider();
  await screen.findByText("status:ready");
  expect(view.picker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.getByText("name:新昵称")).toBeTruthy());
  expect(view.repository.saveDisplayName).toHaveBeenCalledWith(ACCOUNT_A, " 新昵称 ");

  fireEvent.press(screen.getByRole("button", { name: "choose" }));
  await waitFor(() => expect(screen.getByText("avatar:file:///picked-avatar.jpg")).toBeTruthy());
  expect(view.picker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(view.picker.launchImageLibraryAsync).toHaveBeenCalledWith({
    allowsEditing: true,
    aspect: [1, 1],
    mediaTypes: ["images"],
    quality: 0.85,
  });
  expect(view.repository.replaceAvatar).toHaveBeenCalledWith(ACCOUNT_A, "file:///picked-avatar.jpg");

  fireEvent.press(screen.getByRole("button", { name: "remove" }));
  await waitFor(() => expect(screen.getByText("avatar:none")).toBeTruthy());
  expect(view.repository.removeAvatar).toHaveBeenCalledWith(ACCOUNT_A);
});

test("treats picker cancellation as no change and permission denial as a neutral error", async () => {
  mockAuth = { status: "signedIn", accountId: ACCOUNT_A, email: "a@example.com" };
  const picker = createPicker();
  picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: [] });
  const view = renderProvider(createRepository(), picker);
  await screen.findByText("status:ready");

  fireEvent.press(screen.getByRole("button", { name: "choose" }));
  await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
  expect(view.repository.replaceAvatar).not.toHaveBeenCalled();
  expect(screen.getByText("error:none")).toBeTruthy();

  picker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false });
  fireEvent.press(screen.getByRole("button", { name: "choose" }));
  await screen.findByText("error:permission");
  expect(screen.getByText("status:ready")).toBeTruthy();
});

test("keeps an earlier persisted mutation visible when a later picker is canceled", async () => {
  mockAuth = { status: "signedIn", accountId: ACCOUNT_A, email: "a@example.com" };
  const pendingSave = deferred<AccountProfile>();
  const repository = createRepository();
  repository.saveDisplayName.mockImplementationOnce(() => pendingSave.promise);
  const picker = createPicker();
  picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: [] });
  renderProvider(repository, picker);
  await screen.findByText("status:ready");

  fireEvent.press(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(repository.saveDisplayName).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole("button", { name: "choose" }));
  await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));

  await act(async () => { pendingSave.resolve(profile(ACCOUNT_A, "已保存昵称")); });
  expect(screen.getByText("name:已保存昵称")).toBeTruthy();
  expect(screen.getByText("save-result:fulfilled")).toBeTruthy();
});

test("lets the latest same-account avatar choice win when the second picker finishes first", async () => {
  mockAuth = { status: "signedIn", accountId: ACCOUNT_A, email: "a@example.com" };
  const firstChoice = deferred<{
    canceled: boolean;
    assets: ReadonlyArray<{ uri: string }> | null;
  }>();
  const secondChoice = deferred<{
    canceled: boolean;
    assets: ReadonlyArray<{ uri: string }> | null;
  }>();
  const picker = createPicker();
  picker.launchImageLibraryAsync
    .mockImplementationOnce(() => firstChoice.promise)
    .mockImplementationOnce(() => secondChoice.promise);
  const view = renderProvider(createRepository(), picker);
  await screen.findByText("status:ready");

  fireEvent.press(screen.getByRole("button", { name: "choose" }));
  await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole("button", { name: "choose" }));
  await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(2));

  await act(async () => {
    secondChoice.resolve({ canceled: false, assets: [{ uri: "file:///second.jpg" }] });
  });
  await screen.findByText("avatar:file:///second.jpg");
  await act(async () => {
    firstChoice.resolve({ canceled: false, assets: [{ uri: "file:///first.jpg" }] });
  });
  expect(view.repository.replaceAvatar).toHaveBeenCalledTimes(1);
  expect(view.repository.replaceAvatar).toHaveBeenCalledWith(ACCOUNT_A, "file:///second.jpg");
  expect(screen.getByText("avatar:file:///second.jpg")).toBeTruthy();
});

test("does not restore a pending picker result after a newer remove-avatar operation", async () => {
  mockAuth = { status: "signedIn", accountId: ACCOUNT_A, email: "a@example.com" };
  const choice = deferred<{
    canceled: boolean;
    assets: ReadonlyArray<{ uri: string }> | null;
  }>();
  const picker = createPicker();
  picker.launchImageLibraryAsync.mockImplementationOnce(() => choice.promise);
  const view = renderProvider(createRepository(), picker);
  await screen.findByText("status:ready");

  fireEvent.press(screen.getByRole("button", { name: "choose" }));
  await waitFor(() => expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole("button", { name: "remove" }));
  await waitFor(() => expect(view.repository.removeAvatar).toHaveBeenCalledWith(ACCOUNT_A));

  await act(async () => {
    choice.resolve({ canceled: false, assets: [{ uri: "file:///stale.jpg" }] });
  });
  expect(view.repository.replaceAvatar).not.toHaveBeenCalled();
  expect(screen.getByText("avatar:none")).toBeTruthy();
});

test("preserves the old profile on mutation failure and retries a failed load without leaking errors", async () => {
  mockAuth = { status: "signedIn", accountId: ACCOUNT_A, email: "a@example.com" };
  const repository = createRepository();
  repository.saveDisplayName.mockRejectedValueOnce(new Error("file:///private/secret"));
  const view = renderProvider(repository);
  await screen.findByText("name:用户-a3e0");

  fireEvent.press(screen.getByRole("button", { name: "save" }));
  await screen.findByText("error:save");
  expect(screen.getByText("save-result:rejected")).toBeTruthy();
  expect(screen.getByText("name:用户-a3e0")).toBeTruthy();
  expect(screen.queryByText(/private\/secret/u)).toBeNull();

  repository.load.mockRejectedValueOnce(new Error("broken store"));
  mockAuth = { status: "signedIn", accountId: ACCOUNT_B, email: "b@example.com" };
  view.rerender(
    <AccountProfileProvider dependencies={{ picker: view.picker, repository }}>
      <Probe />
    </AccountProfileProvider>,
  );
  await screen.findByText("status:error");
  expect(screen.getByText("error:load")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "retry" }));
  expect(screen.getByText("status:loading")).toBeTruthy();
  expect(await screen.findByText("status:ready")).toBeTruthy();
  expect(repository.load).toHaveBeenLastCalledWith(ACCOUNT_B);
});
