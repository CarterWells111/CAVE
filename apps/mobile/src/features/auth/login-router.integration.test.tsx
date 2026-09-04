import type { AuthSessionResponse } from "@cave/contracts";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState, Text } from "react-native";

import RootLayout from "../../../app/_layout";
import EmailAuthRoute from "../../../app/auth/email";
import TabsLayout from "../../../app/(tabs)/_layout";
import JourneyLayout from "../../../app/journey/_layout";
import { useAuth, type AuthDependencies } from "./runtime/AuthProvider";
import { AccountPreferencesService } from "../account/application/account-preferences-service";
import { composeJourneyRuntime } from "../journey/runtime/journey-runtime";
import { InMemoryCommunicationCardRepository, InMemoryJourneyDraftRepository } from "../journey/infrastructure/in-memory-journey-repositories";
import { InMemoryAppearancePreferencesRepository } from "../../core/design/appearance-preferences";
import { useJourneyRuntime } from "../journey/runtime/JourneyRuntimeProvider";

let mockDependencies: AuthDependencies;
let mockRuntime: ReturnType<typeof composeJourneyRuntime>;
let mockPreferences: AccountPreferencesService;
jest.mock("./runtime/expo-auth-dependencies", () => ({ createExpoAuthDependencies: () => mockDependencies }));
jest.mock("../journey/runtime/default-journey-runtime", () => ({ createExpoJourneyRuntime: async () => mockRuntime }));
jest.mock("../account/infrastructure/expo-account-preferences", () => ({ createExpoAccountPreferencesService: () => mockPreferences }));
jest.mock("../account/infrastructure/expo-account-profile-dependencies", () => ({
  createExpoAccountProfileRepository: () => ({ load: async () => ({ displayName: "", avatarUri: null }) }),
}));

const accountId = "cb02004c-7b5b-4680-9b16-8a6a33511bc9";
const requestId = "7cbbc0f9-9d12-4b08-9741-75bbb399e7c6";
const now = "2026-09-04T12:00:00.000Z";
let profileMounts = 0;
function Profile() {
  const auth = useAuth();
  useEffect(() => { profileMounts += 1; }, []);
  return <Text>{auth.status === "signedIn" ? "已登录的我的页面" : "游客我的页面"}</Text>;
}
const Home = () => <Text>首页</Text>;
function PrivatePage() {
  useJourneyRuntime();
  return <Text>受限旅程页面</Text>;
}

function setup(ageConfirmed = true) {
  profileMounts = 0;
  let encoded: string | null = null;
  let declared = false;
  mockPreferences = new AccountPreferencesService({ get: async () => encoded, set: async (value) => { encoded = value; } });
  const appearance = new InMemoryAppearancePreferencesRepository();
  const loadAppearance = jest.spyOn(appearance, "load");
  mockRuntime = composeJourneyRuntime({
    mode: "expo-go-demo", persistence: "memory-only", drafts: new InMemoryJourneyDraftRepository(), cards: new InMemoryCommunicationCardRepository(),
    clipboard: { setStringAsync: async () => undefined }, createId: () => "login-test", now: () => now, appearancePreferences: appearance,
    adultDeclaration: { hasAdultDeclaration: async () => declared, recordAdultDeclaration: async () => { declared = true; }, deleteAdultDeclaration: async () => { declared = false; }, hasPendingLocalDataDeletion: async () => false },
  });
  const session: AuthSessionResponse = {
    contractVersion: "1", requestId, account: { id: accountId },
    session: { accessToken: `cave_at_${"a".repeat(43)}`, refreshToken: `cave_rt_${"r".repeat(43)}`, accessExpiresAt: "2026-09-04T12:15:00.000Z", refreshExpiresAt: "2026-10-04T12:00:00.000Z" },
  };
  mockDependencies = {
    api: {
      requestEmailChallenge: jest.fn(async () => ({ contractVersion: "1" as const, requestId, challengeId: requestId, expiresInSeconds: 600, resendAfterSeconds: 60 })),
      verifyEmailChallenge: jest.fn(async () => session), refresh: jest.fn(async () => session), logout: jest.fn(),
      requestAccountDeletionChallenge: jest.fn(), verifyAccountDeletionChallenge: jest.fn(), deleteAccount: jest.fn(),
      getAccountPreferences: jest.fn(async () => ({ contractVersion: "1" as const, requestId, preferences: { ageConfirmed, addressPreference: "妳" as const, updatedAt: now, revision: 1 } })),
      updateAccountPreferences: jest.fn(),
    },
    sessionStore: { load: jest.fn(async () => null), save: jest.fn(), clear: jest.fn() },
    getInstallationToken: async () => "test-installation", createRequestId: () => requestId, now: () => Date.parse(now),
  };
  const result = renderRouter({
    _layout: RootLayout, "auth/email": EmailAuthRoute, "(tabs)/_layout": TabsLayout,
    "(tabs)/index": Home, "(tabs)/profile": Profile, "(tabs)/reviews": Home, "(tabs)/practice": Home, "(tabs)/journal": Home,
    "journey/_layout": JourneyLayout, "journey/welcome": Home, "journey/body-knowledge": PrivatePage,
    "journey/adult-gate": Home, "journey/preface": PrivatePage, "journey/overnight": PrivatePage,
    "journey/behavior-map": PrivatePage, "journey/reflection": PrivatePage, "journey/final-preparation": PrivatePage,
    "journey/behavior-attitudes": PrivatePage, "journey/checklist": PrivatePage,
    "journey/communication-card": PrivatePage, "journey/preset-practice": PrivatePage,
  }, { initialUrl: "/(tabs)/profile" });
  return { result, loadAppearance };
}

async function login() {
  await act(async () => { router.push({ pathname: "/auth/email", params: { returnTo: "/(tabs)/profile" } }); });
  fireEvent.changeText(await screen.findByLabelText("邮箱地址"), "person@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));
  fireEvent.changeText(await screen.findByLabelText("6 位验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "登录" }));
}

test.each([false, true])("login keeps the real navigator stable with account adulthood %s", async (ageConfirmed) => {
  let foreground: ((state: "active") => void) | undefined;
  const originalAdd = jest.mocked(AppState.addEventListener).getMockImplementation();
  const listener = jest.spyOn(AppState, "addEventListener").mockImplementation((event, callback) => {
    if (event === "change") foreground = callback;
    return { remove: jest.fn() };
  });
  try {
    const { result, loadAppearance } = setup(ageConfirmed);
    await screen.findByText("游客我的页面");
    await login();
    await screen.findByText("已登录的我的页面");
    await waitFor(() => expect(mockPreferences.getSnapshot().syncStatus).toBe("saved"));
    if (ageConfirmed) await waitFor(() => expect(mockRuntime.service.getSnapshot()?.ageConfirmed).toBe(true));
    await act(async () => { await Promise.resolve(); });
    expect(result.getPathname()).toBe("/profile");
    expect(screen.queryByText("正在读取外观设置…")).toBeNull();
    expect(loadAppearance).toHaveBeenCalledTimes(ageConfirmed ? 1 : 0);
    expect(profileMounts).toBeLessThanOrEqual(2);
    const mountsAfterLogin = profileMounts;
    for (let count = 0; count < 3; count += 1) {
      await act(async () => { foreground!("active"); });
      await waitFor(() => expect(mockPreferences.getSnapshot().syncStatus).toBe("saved"));
      expect(result.getPathname()).toBe("/profile");
      expect(screen.getByText("已登录的我的页面")).toBeTruthy();
    }
    expect(profileMounts).toBe(mountsAfterLogin);
    expect(loadAppearance).toHaveBeenCalledTimes(ageConfirmed ? 1 : 0);
    fireEvent.press(screen.getByRole("tab", { name: "首页" }));
    fireEvent.press(screen.getByRole("tab", { name: "我的" }));
    expect(result.getPathname()).toBe("/profile");
  } finally { listener.mockImplementation(originalAdd ?? (() => ({ remove: jest.fn() }))); }
});

test("revocation locks a mounted private route and blocks reopening its deep link", async () => {
  const { result } = setup();
  await screen.findByText("游客我的页面");
  await login();
  await screen.findByText("已登录的我的页面");
  await waitFor(() => expect(mockRuntime.service.getSnapshot()?.ageConfirmed).toBe(true));
  await act(async () => { router.push("/journey/body-knowledge"); });
  await screen.findByText("受限旅程页面");
  await act(async () => { await mockPreferences.change({ ageConfirmed: false }); });
  await waitFor(() => expect(result.getPathname()).toBe("/journey/welcome"));
  expect(screen.queryByText("受限旅程页面")).toBeNull();
  await act(async () => { router.push("/journey/body-knowledge"); });
  await waitFor(() => expect(result.getPathname()).toBe("/journey/welcome"));
  expect(screen.queryByText("受限旅程页面")).toBeNull();
});
