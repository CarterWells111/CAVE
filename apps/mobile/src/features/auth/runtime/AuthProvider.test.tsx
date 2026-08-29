import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { MobileAuthApiError } from "../infrastructure/auth-api-client";
import { AuthProvider, useAuth, type AuthDependencies } from "./AuthProvider";

const stored = {
  accountId: "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
  email: "person@example.com",
  refreshToken: `cave_rt_${"r".repeat(43)}`,
  refreshExpiresAt: "2026-09-27T17:00:00.000Z",
};

afterEach(() => { jest.restoreAllMocks(); });

function dependencies(overrides: Partial<AuthDependencies> = {}): AuthDependencies {
  return {
    api: {
      requestEmailChallenge: jest.fn(), verifyEmailChallenge: jest.fn(),
      refresh: jest.fn(async () => ({
        contractVersion: "1" as const,
        requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
        account: { id: stored.accountId },
        session: {
          accessToken: `cave_at_${"a".repeat(43)}`,
          accessExpiresAt: "2026-08-28T17:15:00.000Z",
          refreshToken: `cave_rt_${"n".repeat(43)}`,
          refreshExpiresAt: stored.refreshExpiresAt,
        },
      })),
      logout: jest.fn(), requestAccountDeletionChallenge: jest.fn(),
      verifyAccountDeletionChallenge: jest.fn(), deleteAccount: jest.fn(),
    },
    sessionStore: { load: jest.fn(async () => stored), save: jest.fn(), clear: jest.fn() },
    getInstallationToken: jest.fn(async () => "installation-token-at-least-sixteen"),
    createRequestId: () => "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
    now: () => Date.parse("2026-08-28T17:00:00.000Z"),
    ...overrides,
  } as AuthDependencies;
}

function Probe() {
  const auth = useAuth();
  return <Text>{auth.status}</Text>;
}

test("restores a refresh session without persisting the new access token or losing the local email", async () => {
  const deps = dependencies();
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><Probe /></AuthProvider>);
  await screen.findByText("signedIn");
  expect(deps.api.refresh).toHaveBeenCalledTimes(1);
  expect(deps.sessionStore.save).toHaveBeenCalledWith(expect.objectContaining({ email: stored.email }));
  expect(deps.sessionStore.save).toHaveBeenCalledWith(expect.not.objectContaining({ accessToken: expect.anything() }));
});

test("keeps the account locally recognizable while offline", async () => {
  const deps = dependencies();
  jest.mocked(deps.api.refresh).mockRejectedValueOnce(Object.assign(new Error(), { code: "NETWORK_ERROR" }));
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><IdentityProbe /></AuthProvider>);
  await screen.findByText("offline");
  expect(resultEmail()).toBe(stored.email);
  expect(deps.sessionStore.clear).not.toHaveBeenCalled();
});

let capturedAuth: ReturnType<typeof useAuth> | undefined;

function IdentityProbe() {
  capturedAuth = useAuth();
  return <Text>{capturedAuth.status}</Text>;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function resultEmail() {
  return capturedAuth?.email;
}

test("does not expose email while loading or signed out", async () => {
  let resolveLoad!: (value: null) => void;
  const load = new Promise<null>((resolve) => { resolveLoad = resolve; });
  const deps = dependencies({
    sessionStore: { load: jest.fn(() => load), save: jest.fn(), clear: jest.fn() },
  });
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><IdentityProbe /></AuthProvider>);
  expect(capturedAuth?.status).toBe("loading");
  expect(resultEmail()).toBeUndefined();

  resolveLoad(null);
  await screen.findByText("signedOut");
  expect(resultEmail()).toBeUndefined();
});

test("fails closed without logging private details when loading the session rejects", async () => {
  const privateDetail = "load failed for private.person@example.com";
  const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  const loggedError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const deps = dependencies({
    sessionStore: {
      load: jest.fn(async () => { throw new Error(privateDetail); }),
      save: jest.fn(),
      clear: jest.fn(),
    },
  });
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><IdentityProbe /></AuthProvider>);

  await screen.findByText("signedOut");
  expect(capturedAuth?.accountId).toBeUndefined();
  expect(resultEmail()).toBeUndefined();
  expect(JSON.stringify([...warning.mock.calls, ...loggedError.mock.calls])).not.toContain(privateDetail);
  warning.mockRestore();
  loggedError.mockRestore();
});

test("fails closed when clearing an expired session rejects", async () => {
  const expired = { ...stored, refreshExpiresAt: "2026-08-27T17:00:00.000Z" };
  const deps = dependencies({
    sessionStore: {
      load: jest.fn(async () => expired),
      save: jest.fn(),
      clear: jest.fn(async () => { throw new Error("private expired-session detail"); }),
    },
  });
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><IdentityProbe /></AuthProvider>);

  await screen.findByText("signedOut");
  expect(capturedAuth?.accountId).toBeUndefined();
  expect(resultEmail()).toBeUndefined();
});

test("fails closed when clearing a refresh-401 session rejects", async () => {
  const deps = dependencies({
    sessionStore: {
      load: jest.fn(async () => stored),
      save: jest.fn(),
      clear: jest.fn(async () => { throw new Error("private refresh-session detail"); }),
    },
  });
  jest.mocked(deps.api.refresh).mockRejectedValueOnce(
    new MobileAuthApiError("AUTH_UNAUTHORIZED", 401),
  );
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><IdentityProbe /></AuthProvider>);

  await screen.findByText("signedOut");
  expect(capturedAuth?.accountId).toBeUndefined();
  expect(resultEmail()).toBeUndefined();
});

test("an expired-session clear cannot delete a concurrently verified login", async () => {
  const clearing = deferred<void>();
  const expired = { ...stored, refreshExpiresAt: "2026-08-27T17:00:00.000Z" };
  let persisted: Parameters<AuthDependencies["sessionStore"]["save"]>[0] | null = expired;
  const sessionStore: AuthDependencies["sessionStore"] = {
    load: jest.fn(async () => expired),
    save: jest.fn(async (record) => { persisted = record; }),
    clear: jest.fn(async () => {
      await clearing.promise;
      persisted = null;
    }),
  };
  const deps = dependencies({ sessionStore });
  jest.mocked(deps.api.verifyEmailChallenge).mockResolvedValueOnce({
    contractVersion: "1",
    requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
    account: { id: "fb37d589-c1de-4300-8a93-63df012bbfb2" },
    session: {
      accessToken: `cave_at_${"b".repeat(43)}`,
      accessExpiresAt: "2026-08-28T17:15:00.000Z",
      refreshToken: `cave_rt_${"m".repeat(43)}`,
      refreshExpiresAt: stored.refreshExpiresAt,
    },
  });
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><IdentityProbe /></AuthProvider>);
  await waitFor(() => expect(sessionStore.clear).toHaveBeenCalledTimes(1));

  let loginPromise!: Promise<void>;
  act(() => {
    loginPromise = capturedAuth!.verifyEmailChallenge(
      "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
      "123456",
      "person@example.com",
    );
  });
  await waitFor(() => expect(deps.api.verifyEmailChallenge).toHaveBeenCalledTimes(1));
  clearing.resolve(undefined);
  await act(async () => { await loginPromise; });

  expect(capturedAuth?.status).toBe("signedIn");
  expect(persisted).toMatchObject({
    accountId: "fb37d589-c1de-4300-8a93-63df012bbfb2",
    email: "person@example.com",
  });
});

test("a refresh-401 clear cannot sign out or delete a concurrently verified login", async () => {
  const clearing = deferred<void>();
  let persisted: Parameters<AuthDependencies["sessionStore"]["save"]>[0] | null = stored;
  const sessionStore: AuthDependencies["sessionStore"] = {
    load: jest.fn(async () => stored),
    save: jest.fn(async (record) => { persisted = record; }),
    clear: jest.fn(async () => {
      await clearing.promise;
      persisted = null;
    }),
  };
  const deps = dependencies({ sessionStore });
  jest.mocked(deps.api.refresh).mockRejectedValueOnce(
    new MobileAuthApiError("AUTH_UNAUTHORIZED", 401),
  );
  jest.mocked(deps.api.verifyEmailChallenge).mockResolvedValueOnce({
    contractVersion: "1",
    requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
    account: { id: "fb37d589-c1de-4300-8a93-63df012bbfb2" },
    session: {
      accessToken: `cave_at_${"b".repeat(43)}`,
      accessExpiresAt: "2026-08-28T17:15:00.000Z",
      refreshToken: `cave_rt_${"m".repeat(43)}`,
      refreshExpiresAt: stored.refreshExpiresAt,
    },
  });
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><IdentityProbe /></AuthProvider>);
  await waitFor(() => expect(sessionStore.clear).toHaveBeenCalledTimes(1));

  let loginPromise!: Promise<void>;
  act(() => {
    loginPromise = capturedAuth!.verifyEmailChallenge(
      "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
      "123456",
      "person@example.com",
    );
  });
  await waitFor(() => expect(deps.api.verifyEmailChallenge).toHaveBeenCalledTimes(1));
  clearing.resolve(undefined);
  await act(async () => { await loginPromise; });

  expect(capturedAuth?.status).toBe("signedIn");
  expect(persisted).toMatchObject({
    accountId: "fb37d589-c1de-4300-8a93-63df012bbfb2",
    email: "person@example.com",
  });
});

test("blocks starting email authentication before the local adult declaration", async () => {
  const deps = dependencies({ sessionStore: { load: jest.fn(async () => null), save: jest.fn(), clear: jest.fn() } });
  let result: ReturnType<typeof useAuth> | undefined;
  function Capture() { result = useAuth(); return <Text>{result.status}</Text>; }
  render(<AuthProvider adultStatus="public" dependencies={deps}><Capture /></AuthProvider>);
  await screen.findByText("signedOut");
  await act(async () => {
    await expect(result!.requestEmailChallenge("person@example.com"))
      .rejects.toMatchObject({ code: "ADULT_DECLARATION_REQUIRED" });
  });
  expect(deps.api.requestEmailChallenge).not.toHaveBeenCalled();
});

test("logout clears the device even when the network request fails", async () => {
  const deps = dependencies();
  jest.mocked(deps.api.logout).mockRejectedValueOnce(new Error("offline"));
  let result: ReturnType<typeof useAuth> | undefined;
  function Capture() { result = useAuth(); return <Text>{result.status}</Text>; }
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><Capture /></AuthProvider>);
  await screen.findByText("signedIn");
  expect(result?.email).toBe(stored.email);
  await act(async () => { await result!.logout(); });
  await waitFor(() => expect(result?.status).toBe("signedOut"));
  expect(result?.email).toBeUndefined();
  expect(deps.sessionStore.clear).toHaveBeenCalled();
});

test("hides email before a pending remote logout completes", async () => {
  let resolveLogout!: () => void;
  const pendingLogout = new Promise<void>((resolve) => { resolveLogout = resolve; });
  const deps = dependencies();
  jest.mocked(deps.api.logout).mockReturnValueOnce(pendingLogout);
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><IdentityProbe /></AuthProvider>);
  await screen.findByText("signedIn");

  let logoutPromise!: Promise<void>;
  act(() => { logoutPromise = capturedAuth!.logout(); });
  await screen.findByText("signedOut");
  expect(resultEmail()).toBeUndefined();

  resolveLogout();
  await act(async () => { await logoutPromise; });
});

test("shares one refresh request across concurrent protected actions", async () => {
  let now = Date.parse("2026-08-28T17:00:00.000Z");
  const deps = dependencies({ now: () => now });
  let result: ReturnType<typeof useAuth> | undefined;
  function Capture() { result = useAuth(); return <Text>{result.status}</Text>; }
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><Capture /></AuthProvider>);
  await screen.findByText("signedIn");
  now = Date.parse("2026-08-28T17:16:00.000Z");

  await act(async () => {
    await Promise.all([
      result!.requestAccountDeletionChallenge("person@example.com"),
      result!.requestAccountDeletionChallenge("person@example.com"),
    ]);
  });

  expect(deps.api.refresh).toHaveBeenCalledTimes(2);
  expect(deps.api.requestAccountDeletionChallenge).toHaveBeenCalledTimes(2);
});

test("does not restore a startup refresh after the local session was cleared", async () => {
  let resolveRefresh!: (value: Awaited<ReturnType<AuthDependencies["api"]["refresh"]>>) => void;
  const pendingRefresh = new Promise<Awaited<ReturnType<AuthDependencies["api"]["refresh"]>>>((resolve) => {
    resolveRefresh = resolve;
  });
  const deps = dependencies();
  jest.mocked(deps.api.refresh).mockReturnValueOnce(pendingRefresh);
  let result: ReturnType<typeof useAuth> | undefined;
  function Capture() { result = useAuth(); return <Text>{result.status}</Text>; }
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><Capture /></AuthProvider>);
  await waitFor(() => expect(deps.api.refresh).toHaveBeenCalledTimes(1));

  await act(async () => { await result!.clearLocalSession(); });
  resolveRefresh({
    contractVersion: "1",
    requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
    account: { id: stored.accountId },
    session: {
      accessToken: `cave_at_${"a".repeat(43)}`,
      accessExpiresAt: "2026-08-28T17:15:00.000Z",
      refreshToken: `cave_rt_${"n".repeat(43)}`,
      refreshExpiresAt: stored.refreshExpiresAt,
    },
  });

  await waitFor(() => expect(result?.status).toBe("signedOut"));
  expect(deps.sessionStore.save).not.toHaveBeenCalled();
});

test("a new email login supersedes an older startup refresh", async () => {
  let resolveRefresh!: (value: Awaited<ReturnType<AuthDependencies["api"]["refresh"]>>) => void;
  const pendingRefresh = new Promise<Awaited<ReturnType<AuthDependencies["api"]["refresh"]>>>((resolve) => {
    resolveRefresh = resolve;
  });
  const deps = dependencies();
  jest.mocked(deps.api.refresh).mockReturnValueOnce(pendingRefresh);
  const newAccountId = "fb37d589-c1de-4300-8a93-63df012bbfb2";
  jest.mocked(deps.api.verifyEmailChallenge).mockResolvedValueOnce({
    contractVersion: "1",
    requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
    account: { id: newAccountId },
    session: {
      accessToken: `cave_at_${"b".repeat(43)}`,
      accessExpiresAt: "2026-08-28T17:15:00.000Z",
      refreshToken: `cave_rt_${"m".repeat(43)}`,
      refreshExpiresAt: stored.refreshExpiresAt,
    },
  });
  let result: ReturnType<typeof useAuth> | undefined;
  function Capture() { result = useAuth(); return <Text>{result.status}</Text>; }
  render(<AuthProvider adultStatus="authorized" dependencies={deps}><Capture /></AuthProvider>);
  await waitFor(() => expect(deps.api.refresh).toHaveBeenCalledTimes(1));

  await act(async () => {
    await result!.verifyEmailChallenge(
      "cb02004c-7b5b-4680-9b16-8a6a33511bc9",
      "123456",
      " Person@Example.com ",
    );
  });
  expect(result?.accountId).toBe(newAccountId);
  expect(result?.email).toBe("person@example.com");
  resolveRefresh({
    contractVersion: "1",
    requestId: "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6",
    account: { id: stored.accountId },
    session: {
      accessToken: `cave_at_${"a".repeat(43)}`,
      accessExpiresAt: "2026-08-28T17:15:00.000Z",
      refreshToken: `cave_rt_${"n".repeat(43)}`,
      refreshExpiresAt: stored.refreshExpiresAt,
    },
  });

  await waitFor(() => expect(result?.accountId).toBe(newAccountId));
  expect(deps.sessionStore.save).toHaveBeenLastCalledWith(expect.objectContaining({
    accountId: newAccountId,
    email: "person@example.com",
    refreshToken: `cave_rt_${"m".repeat(43)}`,
  }));
});
