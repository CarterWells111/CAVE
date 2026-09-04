import type { AccountPreferences, AuthSessionResponse, UpdateAccountPreferencesRequest } from "@cave/contracts";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import AdultGateRoute from "../../../../app/journey/adult-gate";
import PrefaceRoute from "../../../../app/journey/preface";
import EmailAuthRoute from "../../../../app/auth/email";
import DeleteAccountRoute from "../../../../app/auth/delete-account";
import { AuthProvider, useAuth, type AuthDependencies } from "../../auth/runtime/AuthProvider";
import { InMemoryCommunicationCardRepository, InMemoryJourneyDraftRepository } from "../../journey/infrastructure/in-memory-journey-repositories";
import { composeJourneyRuntime } from "../../journey/runtime/journey-runtime";
import { JourneyRuntimeProvider, useOptionalJourneyRuntime } from "../../journey/runtime/JourneyRuntimeProvider";
import { AccountPreferencesService, DEFAULT_ACCOUNT_PREFERENCES } from "../application/account-preferences-service";
import { AccountPreferencesProvider } from "./AccountPreferencesProvider";
import { AccountPreferenceSettings } from "../ui/AccountPreferenceSettings";
import { JournalAccessProvider, useJournalAccess } from "../../journal/runtime/JournalAccessProvider";

type Route = { pathname: string; params?: { returnTo?: string } };
let mockNavigate: (destination: string | Route) => void;
let mockParams: Route["params"] = {};
const mockRouter = {
  push: jest.fn((destination: string | Route) => mockNavigate(destination)),
  replace: jest.fn((destination: string | Route) => mockNavigate(destination)),
  canGoBack: () => false,
  back: jest.fn(),
};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

const requestId = "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6";
const accountId = "cb02004c-7b5b-4680-9b16-8a6a33511bc9";
const challengeId = "24fbfef0-32be-4d27-8b9f-a89173206b16";
const now = "2026-09-04T12:00:00.000Z";

function setup(initialServer: AccountPreferences = { ...DEFAULT_ACCOUNT_PREFERENCES }, failFirstRead = false) {
  let server = { ...initialServer };
  let encoded: string | null = null;
  let declared = false;
  const storage = {
    get: jest.fn(async () => {
      if (failFirstRead) { failFirstRead = false; throw new Error("transient-storage-read"); }
      return encoded;
    }),
    set: jest.fn(async (value: string) => { encoded = value; }),
  };
  const preferences = new AccountPreferencesService(storage);
  const runtime = composeJourneyRuntime({
    mode: "expo-go-demo", persistence: "memory-only",
    drafts: new InMemoryJourneyDraftRepository(), cards: new InMemoryCommunicationCardRepository(),
    clipboard: { setStringAsync: async () => undefined }, createId: () => "preferences-flow", now: () => now,
    adultDeclaration: {
      hasAdultDeclaration: async () => declared,
      recordAdultDeclaration: async () => { declared = true; },
      deleteAdultDeclaration: async () => { declared = false; },
      hasPendingLocalDataDeletion: async () => false,
    },
  });
  const session: AuthSessionResponse = {
    contractVersion: "1", requestId, account: { id: accountId },
    session: { accessToken: `cave_at_${"a".repeat(43)}`, refreshToken: `cave_rt_${"r".repeat(43)}`, accessExpiresAt: "2026-09-04T12:15:00.000Z", refreshExpiresAt: "2026-10-04T12:00:00.000Z" },
  };
  const dependencies: AuthDependencies = {
    api: {
      requestEmailChallenge: jest.fn(async () => ({ contractVersion: "1" as const, requestId, challengeId, expiresInSeconds: 600, resendAfterSeconds: 60 })),
      verifyEmailChallenge: jest.fn(async () => session),
      refresh: jest.fn(async () => session),
      logout: jest.fn(),
      requestAccountDeletionChallenge: jest.fn(async () => ({ contractVersion: "1" as const, requestId, challengeId, expiresInSeconds: 600, resendAfterSeconds: 60 })),
      verifyAccountDeletionChallenge: jest.fn(), deleteAccount: jest.fn(),
      getAccountPreferences: jest.fn(async (_token: string, id: string) => ({ contractVersion: "1" as const, requestId: id, preferences: { ...server } })),
      updateAccountPreferences: jest.fn(async (_token: string, input: UpdateAccountPreferencesRequest) => {
        if (input.expectedRevision !== server.revision) throw Object.assign(new Error("revision-conflict"), { code: "ACCOUNT_PREFERENCES_CONFLICT" });
        server = { ageConfirmed: input.changes.ageConfirmed ?? server.ageConfirmed, addressPreference: input.changes.addressPreference === undefined ? server.addressPreference : input.changes.addressPreference, updatedAt: now, revision: server.revision + 1 };
        return { contractVersion: "1" as const, requestId: input.requestId, preferences: { ...server } };
      }),
    },
    sessionStore: { load: jest.fn(async () => null), save: jest.fn(), clear: jest.fn() },
    getInstallationToken: async () => "preferences-flow-installation-token",
    createRequestId: () => requestId, now: () => Date.parse(now),
  };
  let currentRoute: Route = { pathname: "/journey/adult-gate" };
  let currentRuntime: ReturnType<typeof useOptionalJourneyRuntime> = null;
  let currentAuth: ReturnType<typeof useAuth> | undefined;
  let currentJournalAccess: ReturnType<typeof useJournalAccess> | undefined;
  function RoutedScreen({ route }: { route: Route }) {
    currentRuntime = useOptionalJourneyRuntime();
    currentAuth = useAuth();
    currentJournalAccess = useJournalAccess();
    mockParams = route.params ?? {};
    if (route.pathname === "/journey/adult-gate") return <AdultGateRoute />;
    if (route.pathname === "/journey/preface") return <PrefaceRoute />;
    if (route.pathname === "/auth/email") return <EmailAuthRoute />;
    if (route.pathname === "/auth/delete-account") return <DeleteAccountRoute />;
    if (route.pathname === "/(tabs)/profile") return <Text>我的页面</Text>;
    if (route.pathname === "/settings") return <AccountPreferenceSettings onRevoke={() => mockRouter.replace("/journey/adult-gate")} />;
    throw new Error(`Unexpected navigation: ${route.pathname}`);
  }
  function App() {
    // This state survives JourneyRuntimeProvider's public/authorized subtree replacement.
    const [route, setRoute] = useState<Route>({ pathname: "/journey/adult-gate" });
    currentRoute = route;
    mockNavigate = (destination) => setRoute(typeof destination === "string" ? { pathname: destination } : destination);
    return <AuthProvider dependencies={dependencies}>
      <AccountPreferencesProvider service={preferences}>
        <JourneyRuntimeProvider createRuntime={async () => runtime}>
          <JournalAccessProvider><RoutedScreen route={route} /></JournalAccessProvider>
        </JourneyRuntimeProvider>
      </AccountPreferencesProvider>
    </AuthProvider>;
  }
  render(<App />);
  return {
    preferences, runtime, storage, dependencies, server: () => server, route: () => currentRoute, declared: () => declared,
    runtimeContext: () => currentRuntime, auth: () => currentAuth, journalAccess: () => currentJournalAccess,
    nextLogin(nextAccountId: string, nextServer: AccountPreferences) {
      session.account.id = nextAccountId;
      session.session.accessToken = `cave_at_${"b".repeat(43)}`;
      session.session.refreshToken = `cave_rt_${"s".repeat(43)}`;
      server = { ...nextServer };
    },
  };
}

async function signInFromHint() {
  fireEvent.press(await screen.findByRole("link", { name: "登录后保存现有选择" }));
  await completeEmailLogin();
}

async function completeEmailLogin() {
  await screen.findByLabelText("邮箱地址");
  fireEvent.changeText(screen.getByLabelText("邮箱地址"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));
  await screen.findByLabelText("6 位验证码");
  fireEvent.changeText(screen.getByLabelText("6 位验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "登录" }));
}

beforeEach(() => { jest.clearAllMocks(); mockParams = {}; });

test.each([false, true])("My login returns automatically while restoring account adulthood %s", async (ageConfirmed) => {
  const h = setup({ ageConfirmed, addressPreference: "妳", updatedAt: now, revision: 2 });
  await screen.findByTestId("adult-gate");
  await act(async () => { mockNavigate({ pathname: "/auth/email", params: { returnTo: "/(tabs)/profile" } }); });
  await completeEmailLogin();
  await screen.findByText("我的页面");
  await waitFor(() => expect(h.preferences.getSnapshot()).toMatchObject({ owner: accountId, syncStatus: "saved" }));
  await waitFor(() => expect(h.runtimeContext() !== null).toBe(ageConfirmed));
  expect(h.route().pathname).toBe("/(tabs)/profile");
  expect(screen.queryByRole("button", { name: "从这台设备退出登录" })).toBeNull();
});

test("fresh guest explicitly confirms adulthood, saves 妳 without advancing, then signs in and still reads the welcome sheet", async () => {
  const h = setup();
  await screen.findByTestId("adult-gate");
  await waitFor(() => expect(h.preferences.getSnapshot().ready).toBe(true));
  expect(h.declared()).toBe(false);
  expect(h.runtime.service.getSnapshot()?.ageConfirmed ?? false).toBe(false);
  expect(mockRouter.replace).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));
  await screen.findByTestId("journey-preface");
  fireEvent.press(screen.getByRole("radio", { name: "妳｜明确称呼女性，更有书信感。" }));
  await waitFor(() => expect(h.preferences.getSnapshot().preferences.addressPreference).toBe("妳"));
  await waitFor(() => expect(screen.getByRole("button", { name: "这样称呼我" })).not.toBeDisabled());
  expect(screen.queryByText("欢迎来到内界 CAVE")).toBeNull();
  expect(h.route().pathname).toBe("/journey/preface");
  expect(h.runtime.service.getSnapshot()?.prefaceRead).toBe(false);

  await signInFromHint();
  await screen.findByText("欢迎来到内界 CAVE");
  await waitFor(() => expect(h.preferences.getSnapshot().syncStatus).toBe("saved"));
  expect(h.server()).toMatchObject({ ageConfirmed: true, addressPreference: "妳", revision: 1 });
  expect(h.runtime.service.getSnapshot()).toMatchObject({ ageConfirmed: true, addressPreference: "妳", prefaceRead: false });
  expect(h.route().pathname).toBe("/journey/preface");
  expect(h.dependencies.api.verifyEmailChallenge).toHaveBeenCalledWith(challengeId, expect.objectContaining({ code: "123456" }));
});

test("login before adult confirmation restores server preferences without marking the welcome sheet read", async () => {
  const h = setup({ ageConfirmed: true, addressPreference: "妳", updatedAt: now, revision: 4 });
  await screen.findByTestId("adult-gate");
  await signInFromHint();
  await screen.findByText("欢迎来到内界 CAVE");
  expect(h.runtime.service.getSnapshot()).toMatchObject({ ageConfirmed: true, addressPreference: "妳", prefaceRead: false });
  expect(h.route().pathname).toBe("/journey/preface");
  expect(h.dependencies.api.updateAccountPreferences).not.toHaveBeenCalled();
});

test("login to an empty server account still requires an explicit adult declaration", async () => {
  const h = setup();
  await screen.findByTestId("adult-gate");
  await signInFromHint();
  await waitFor(() => expect(h.preferences.getSnapshot()).toMatchObject({ owner: accountId, syncStatus: "saved" }));
  await screen.findByTestId("adult-gate");
  expect(h.route().pathname).toBe("/journey/adult-gate");
  expect(h.declared()).toBe(false);
  expect(h.server()).toEqual(DEFAULT_ACCOUNT_PREFERENCES);
  expect(screen.queryByText("欢迎来到内界 CAVE")).toBeNull();
  expect(screen.queryByRole("link", { name: "登录后保存现有选择" })).toBeNull();
});

test("settings update the active pronoun and revoke adult access while keeping the same draft and data", async () => {
  const h = setup({ ageConfirmed: true, addressPreference: "妳", updatedAt: now, revision: 2 });
  await screen.findByTestId("adult-gate");
  await signInFromHint();
  await screen.findByText("欢迎来到内界 CAVE");
  await act(async () => {
    await h.runtimeContext()!.runAndRefresh(() => h.runtime.service.dispatch({ type: "set-motivation-ids", ids: ["retained-local-choice"] }));
    mockNavigate("/settings");
  });
  const originalId = h.runtime.service.getSnapshot()!.id;
  fireEvent.press(await screen.findByRole("radio", { name: "你" }));
  await waitFor(() => expect(h.runtimeContext()?.snapshot?.addressPreference).toBe("你"));
  await waitFor(() => expect(h.server().addressPreference).toBe("你"));
  fireEvent.press(screen.getByRole("button", { name: "撤销成年确认" }));
  await screen.findByTestId("adult-gate");
  await waitFor(() => expect(h.runtimeContext()).toBeNull());
  await waitFor(() => expect(h.runtime.service.getSnapshot()).toMatchObject({ id: originalId, ageConfirmed: false, motivationIds: ["retained-local-choice"], addressPreference: "你" }));
  expect(h.route().pathname).toBe("/journey/adult-gate");
  expect(screen.queryByRole("link", { name: "登录后保存现有选择" })).toBeNull();
});

test("restarting and replacing the active review retain adult and address preferences but require the welcome sheet again", async () => {
  const h = setup({ ageConfirmed: true, addressPreference: "妳", updatedAt: now, revision: 2 });
  await screen.findByTestId("adult-gate");
  await signInFromHint();
  await screen.findByText("欢迎来到内界 CAVE");
  await act(async () => { mockNavigate("/settings"); });
  for (const action of ["restart", "replaceActiveReview"] as const) {
    await act(async () => { await h.runtimeContext()![action](); });
    await waitFor(() => expect(h.runtimeContext()?.snapshot).toMatchObject({ ageConfirmed: true, addressPreference: "妳", prefaceRead: false }));
  }
  await act(async () => { mockNavigate("/journey/preface"); });
  await screen.findByText("欢迎来到内界 CAVE");
});

test("logout restores empty guest choices and a second account does not inherit the first account preferences", async () => {
  const h = setup({ ageConfirmed: true, addressPreference: "妳", updatedAt: now, revision: 2 });
  await screen.findByTestId("adult-gate");
  await signInFromHint();
  await screen.findByText("欢迎来到内界 CAVE");
  await act(async () => { mockNavigate("/auth/email"); });
  fireEvent.press(await screen.findByRole("button", { name: "从这台设备退出登录" }));
  await waitFor(() => expect(h.auth()?.status).toBe("signedOut"));
  await waitFor(() => expect(h.preferences.getSnapshot()).toMatchObject({ ready: true, owner: null, preferences: { ageConfirmed: false, addressPreference: null } }));
  await waitFor(() => expect(h.runtimeContext()).toBeNull());
  const secondAccountId = "90baf564-07be-470e-8d85-4d3808047a8a";
  h.nextLogin(secondAccountId, { ...DEFAULT_ACCOUNT_PREFERENCES });
  await act(async () => { mockNavigate("/journey/adult-gate"); });
  await screen.findByTestId("adult-gate");
  await signInFromHint();
  await waitFor(() => expect(h.preferences.getSnapshot()).toMatchObject({ owner: secondAccountId, syncStatus: "saved", preferences: { ageConfirmed: false, addressPreference: null } }));
  await screen.findByTestId("adult-gate");
  expect(h.runtimeContext()).toBeNull();
  expect(h.server()).toEqual(DEFAULT_ACCOUNT_PREFERENCES);
  expect(h.dependencies.api.updateAccountPreferences).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: "登录后保存现有选择" })).toBeNull();
});

test("retry after a transient local preference read failure actually initializes and recovers", async () => {
  const h = setup(undefined, true);
  await screen.findByText("无法验证本机访问状态");
  expect(h.preferences.getSnapshot().initialized).toBe(false);
  expect(h.storage.get).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "重试检查" })); });
  await screen.findByTestId("adult-gate");
  await waitFor(() => expect(h.preferences.getSnapshot()).toMatchObject({ initialized: true, ready: true }));
  expect(h.storage.get).toHaveBeenCalledTimes(2);
  expect(h.declared()).toBe(false);
});

test("a signed-in account can start account deletion without confirming adulthood or exposing journey and journal content", async () => {
  const h = setup();
  await screen.findByTestId("adult-gate");
  await signInFromHint();
  await waitFor(() => expect(h.preferences.getSnapshot()).toMatchObject({ owner: accountId, syncStatus: "saved" }));
  await screen.findByTestId("adult-gate");
  expect(h.runtimeContext()).toBeNull();
  expect(h.declared()).toBe(false);
  await act(async () => { mockNavigate("/auth/delete-account"); });
  await screen.findByLabelText("账户邮箱");
  expect(h.journalAccess()?.status).toBe("locked");
  expect(h.journalAccess()?.service).toBeUndefined();
  expect(h.runtimeContext()).toBeNull();
  fireEvent.changeText(screen.getByLabelText("账户邮箱"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送删除验证码" }));
  await screen.findByLabelText("6 位删除验证码");
  expect(h.dependencies.api.requestAccountDeletionChallenge).toHaveBeenCalledWith(`cave_at_${"a".repeat(43)}`, expect.objectContaining({ email: "person@example.com" }));
  expect(h.runtimeContext()).toBeNull();
  expect(h.declared()).toBe(false);
});
