import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StrictMode, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../../core/design/theme-provider";

import JourneyLayout from "../../../../app/journey/_layout";
import AdultGateRoute from "../../../../app/journey/adult-gate";
import BehaviorMapRoute from "../../../../app/journey/behavior-map";
import PrefaceRoute from "../../../../app/journey/preface";
import WelcomeRoute from "../../../../app/journey/welcome";
import SettingsRoute from "../../../../app/settings";
import {
  DatabaseRecoveryRequiredError,
  type DatabaseConnection
} from "../../../core/storage/database";
import {
  InMemoryCommunicationCardRepository,
  InMemoryJourneyDraftRepository
} from "../infrastructure/in-memory-journey-repositories";
import type { ExpoJourneyAdapters } from "../infrastructure/expo-journey-adapters";
import { createComposedJourneyRuntime } from "./default-journey-runtime";
import {
  composeJourneyRuntime,
  type JourneyRuntime,
  type JourneyRuntimeMode
} from "./journey-runtime";
import {
  JourneyRuntimeProvider,
  useJourneyRuntime,
  useOptionalJourneyRuntime
} from "./JourneyRuntimeProvider";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockPathname = "/journey/welcome";
let mockStackContent: ReactNode = null;
const mockRedirect = jest.fn();
const mockStackRender = jest.fn(() => mockStackContent);
jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props);
    return null;
  },
  Stack: () => mockStackRender(),
  usePathname: () => mockPathname,
  useRouter: () => mockRouter
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/journey/welcome";
  mockStackContent = null;
});

function nativePersistenceHarness({
  adultDeclared = false,
  failAdultClearOnce = false,
  failAdultRecordOnce = false,
  failFileRemovalOnce = false
} = {}) {
  let databaseExists = false;
  let hasAdultDeclaration = adultDeclared;
  let deletionPending = false;
  let shouldFailFileRemoval = failFileRemovalOnce;
  let shouldFailAdultClear = failAdultClearOnce;
  let shouldFailAdultRecord = failAdultRecordOnce;
  const sqlCalls: string[] = [];
  const database = {
    execAsync: jest.fn(async (sql: string) => { sqlCalls.push(sql); }),
    runAsync: jest.fn(async (sql: string) => { sqlCalls.push(sql); return { changes: 0 }; }),
    getAllAsync: jest.fn(async <T,>(sql: string) => { sqlCalls.push(sql); return [] as T[]; }),
    getFirstAsync: jest.fn(async <T,>(sql: string) => {
      sqlCalls.push(sql);
      return (sql === "PRAGMA user_version" ? { user_version: 0 } : null) as T | null;
    }),
    closeAsync: jest.fn(async () => undefined)
  } as DatabaseConnection;
  const adapters = {
    native: {
      openDatabaseAsync: jest.fn(async () => {
        databaseExists = true;
        return database;
      })
    },
    files: {
      databaseExists: jest.fn(async () => databaseExists),
      removeDatabaseFiles: jest.fn(async () => {
        if (shouldFailFileRemoval) {
          shouldFailFileRemoval = false;
          throw new Error("remove-failed");
        }
        databaseExists = false;
      })
    },
    secrets: {
      getDatabaseKey: jest.fn(async () => null),
      getOrCreateDatabaseKey: jest.fn(async () => "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
      getOrCreateInstallationToken: jest.fn(async () => "token"),
      deleteDatabaseKey: jest.fn(async () => undefined),
      deleteAllSecrets: jest.fn(async () => { hasAdultDeclaration = false; }),
      hasAdultDeclaration: jest.fn(async () => hasAdultDeclaration),
      recordAdultDeclaration: jest.fn(async () => {
        if (shouldFailAdultRecord) {
          shouldFailAdultRecord = false;
          throw new Error("adult-record-failed");
        }
        hasAdultDeclaration = true;
      }),
      deleteAdultDeclaration: jest.fn(async () => {
        if (shouldFailAdultClear) {
          shouldFailAdultClear = false;
          throw new Error("adult-clear-failed");
        }
        hasAdultDeclaration = false;
      }),
      hasPendingLocalDataDeletion: jest.fn(async () => deletionPending),
      recordPendingLocalDataDeletion: jest.fn(async () => { deletionPending = true; }),
      clearPendingLocalDataDeletion: jest.fn(async () => { deletionPending = false; }),
      deleteInstallationToken: jest.fn(async () => undefined)
    },
    clipboard: { setStringAsync: jest.fn(async () => undefined) }
  } as unknown as ExpoJourneyAdapters;
  const createRuntime = () => createComposedJourneyRuntime({
    executionEnvironment: "standalone",
    clipboard: adapters.clipboard,
    createId: () => "native-zero-write",
    now: () => "2026-08-28T12:00:00.000Z",
    loadNativeAdapters: async () => adapters
  });
  return { adapters, createRuntime, database, sqlCalls };
}

function runtime(mode: JourneyRuntimeMode = "expo-go-demo") {
  return composeJourneyRuntime({
    mode,
    persistence: mode === "expo-go-demo" ? "memory-only" : "sqlcipher-secure-store",
    drafts: new InMemoryJourneyDraftRepository(),
    cards: new InMemoryCommunicationCardRepository(),
    clipboard: { setStringAsync: jest.fn(async () => undefined) },
    createId: () => "journey-runtime-1",
    now: () => "2026-08-27T12:00:00.000Z"
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function RuntimeConsumer() {
  const theme = useTheme();
  const { controller, deleteAllData, mode, restart, runAndRefresh, service, shellState, snapshot } = useJourneyRuntime();

  return (
    <View>
      <Text>{mode}</Text>
      <Text>{`theme-${theme.name}`}</Text>
      <Text>{controller === undefined ? "missing-controller" : "controller-ready"}</Text>
      <Text>{shellState === undefined ? "missing-shell-state" : "shell-state-ready"}</Text>
      <Text>{snapshot?.id ?? "no-runtime-snapshot"}</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        void runAndRefresh(() => service.confirmAdult());
      }}>
        <Text>开始旅程</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void restart().catch(() => undefined); }}>
        <Text>重新开始</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void deleteAllData(); }}>
        <Text>删除全部</Text>
      </Pressable>
    </View>
  );
}

function SafeDeletionConsumer() {
  const runtime = useOptionalJourneyRuntime();
  if (runtime === null) return <Text>runtime-access-revoked</Text>;
  return (
    <View>
      <Text>{runtime.snapshot?.id ?? "no-runtime-snapshot"}</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        void runtime.runAndRefresh(() => runtime.service.confirmAdult());
      }}>
        <Text>开始旅程</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => {
        void runtime.deleteAllData().catch(() => undefined);
      }}>
        <Text>删除全部</Text>
      </Pressable>
    </View>
  );
}

test("creates one runtime across rerenders and keeps the Expo Go notice visible", async () => {
  const appRuntime = runtime();
  const createRuntime = jest.fn(async () => appRuntime);
  const replacementFactory = jest.fn(async () => runtime("native-secure"));
  const { rerender } = render(
    <JourneyRuntimeProvider createRuntime={createRuntime}>
      <RuntimeConsumer />
    </JourneyRuntimeProvider>
  );

  expect(screen.getByText("正在启动旅程运行时…")).toBeTruthy();
  expect(screen.getByText("正在启动旅程运行时…")).toHaveProp("accessibilityLiveRegion", "polite");
  expect(await screen.findByText("Expo Go 演示模式，数据仅在本次打开期间暂存")).toBeTruthy();
  expect(screen.getByText("controller-ready")).toBeTruthy();
  expect(screen.getByText("theme-light")).toBeTruthy();
  expect(screen.getByText("shell-state-ready")).toBeTruthy();

  rerender(
    <JourneyRuntimeProvider createRuntime={replacementFactory}>
      <RuntimeConsumer />
    </JourneyRuntimeProvider>
  );

  expect(screen.getByText("expo-go-demo")).toBeTruthy();
  expect(createRuntime).toHaveBeenCalledTimes(1);
  expect(replacementFactory).not.toHaveBeenCalled();
});

test("invokes the runtime factory once under React StrictMode", async () => {
  const createRuntime = jest.fn(async () => runtime());
  render(
    <StrictMode>
      <JourneyRuntimeProvider createRuntime={createRuntime}>
        <RuntimeConsumer />
      </JourneyRuntimeProvider>
    </StrictMode>
  );

  expect(await screen.findByText("controller-ready")).toBeTruthy();
  expect(createRuntime).toHaveBeenCalledTimes(1);
});

test("runAndRefresh and restart publish service snapshot changes", async () => {
  const createRuntime = jest.fn(async () => runtime());
  render(
    <JourneyRuntimeProvider createRuntime={createRuntime}>
      <RuntimeConsumer />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByText("no-runtime-snapshot")).toBeTruthy();
  fireEvent.press(screen.getByText("开始旅程"));
  expect(await screen.findByText("journey-runtime-1")).toBeTruthy();

  fireEvent.press(screen.getByText("重新开始"));
  await waitFor(() => expect(screen.getByText("no-runtime-snapshot")).toBeTruthy());
});

test("revokes runtime access after deleting all local data", async () => {
  render(
    <JourneyRuntimeProvider createRuntime={async () => runtime()}>
      <SafeDeletionConsumer />
    </JourneyRuntimeProvider>
  );
  expect(await screen.findByText("no-runtime-snapshot")).toBeTruthy();
  fireEvent.press(screen.getByText("开始旅程"));
  expect(await screen.findByText("journey-runtime-1")).toBeTruthy();
  fireEvent.press(screen.getByText("删除全部"));
  await waitFor(() => expect(screen.getByText("runtime-access-revoked")).toBeTruthy());
});

test("shows a structured error when runtime creation fails without retrying or rendering children", async () => {
  const createRuntime = jest.fn<Promise<JourneyRuntime>, []>(async () => {
    throw new Error("secure-runtime-unavailable");
  });
  const { rerender } = render(
    <JourneyRuntimeProvider createRuntime={createRuntime}>
      <Text>protected-journey-content</Text>
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByText("无法启动旅程运行时")).toBeTruthy();
  expect(screen.getByText("错误代码：journey-runtime-creation-failed")).toBeTruthy();
  expect(screen.queryByText("protected-journey-content")).toBeNull();
  expect(screen.queryByText("Expo Go 演示模式，数据仅在本次打开期间暂存")).toBeNull();

  rerender(
    <JourneyRuntimeProvider createRuntime={createRuntime}>
      <Text>protected-journey-content</Text>
    </JourneyRuntimeProvider>
  );
  expect(createRuntime).toHaveBeenCalledTimes(1);
});

test("keeps a native initialization failure visible without changing to Expo Go mode", async () => {
  const nativeRuntime = runtime("native-secure");
  jest.spyOn(nativeRuntime.service, "initialize").mockRejectedValue(new Error("database-unavailable"));
  const createRuntime = jest.fn(async () => nativeRuntime);
  render(
    <JourneyRuntimeProvider createRuntime={createRuntime}>
      <RuntimeConsumer />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByText("无法读取本机旅程")).toBeTruthy();
  expect(screen.getByText("错误代码：journey-runtime-initialization-failed")).toBeTruthy();
  expect(screen.queryByText("Expo Go 演示模式，数据仅在本次打开期间暂存")).toBeNull();
  expect(createRuntime).toHaveBeenCalledTimes(1);
});

test("retries a failed pending-deletion startup only after explicit user action", async () => {
  const appRuntime = runtime("native-secure");
  const createRuntime = jest.fn<Promise<JourneyRuntime>, []>()
    .mockRejectedValueOnce(new Error("pending-deletion-resume-failed"))
    .mockResolvedValueOnce(appRuntime);

  render(
    <JourneyRuntimeProvider createRuntime={createRuntime}>
      <RuntimeConsumer />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByText("无法启动旅程运行时")).toBeTruthy();
  expect(createRuntime).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole("button", { name: "重试启动" }));

  expect(await screen.findByText("controller-ready")).toBeTruthy();
  expect(createRuntime).toHaveBeenCalledTimes(2);
});

test("maps encrypted database recovery to an explicit confirmed delete path", async () => {
  const appRuntime = runtime("native-secure");
  jest.spyOn(appRuntime.service, "initialize").mockRejectedValue(
    new DatabaseRecoveryRequiredError("missing-key")
  );
  const deleteAllData = jest.spyOn(appRuntime, "deleteAllData").mockResolvedValue();

  render(
    <JourneyRuntimeProvider createRuntime={async () => appRuntime}>
      <SettingsRoute />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByRole("header", { name: "本机加密数据需要恢复" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  expect(screen.getByRole("alert", {
    name: "请再次确认：全部本机数据会被删除，并且无法恢复。"
  })).toBeTruthy();
  expect(deleteAllData).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  await waitFor(() => expect(deleteAllData).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: "/journey/welcome" }));
});

test("revokes protected runtime access as soon as deletion starts and keeps failed deletion retryable", async () => {
  const appRuntime = runtime("native-secure");
  const firstDeletion = deferred<void>();
  const deleteAllData = jest.spyOn(appRuntime, "deleteAllData")
    .mockReturnValueOnce(firstDeletion.promise)
    .mockResolvedValueOnce();

  render(
    <JourneyRuntimeProvider createRuntime={async () => appRuntime}>
      <SettingsRoute />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByText("设置")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  expect(await screen.findByText("正在删除本机数据…")).toBeTruthy();
  expect(screen.queryByText("设置")).toBeNull();
  await act(async () => { firstDeletion.reject(new Error("remove-failed")); });

  expect(await screen.findByRole("header", { name: "本机数据删除尚未完成" })).toBeTruthy();
  expect(screen.queryByText("设置")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "重试删除" }));

  await waitFor(() => expect(deleteAllData).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: "/journey/welcome" }));
});

test.each([
  "hasAdultDeclaration",
  "hasPendingLocalDataDeletion"
] as const)("fails closed when %s cannot be read during startup", async (method) => {
  const appRuntime = runtime("native-secure");
  jest.spyOn(appRuntime.adultDeclaration, method).mockRejectedValue(new Error("marker-read-failed"));

  render(
    <JourneyRuntimeProvider createRuntime={async () => appRuntime}>
      <Text>protected-runtime-content</Text>
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByRole("header", { name: "无法验证本机访问状态" })).toBeTruthy();
  expect(screen.queryByText("protected-runtime-content")).toBeNull();
  expect(screen.queryByText("marker-read-failed")).toBeNull();
});

test("does not retain authorized content when a later marker read fails", async () => {
  const appRuntime = runtime("native-secure");
  jest.spyOn(appRuntime.adultDeclaration, "hasAdultDeclaration")
    .mockResolvedValueOnce(true)
    .mockRejectedValueOnce(new Error("marker-read-failed"));

  render(
    <JourneyRuntimeProvider createRuntime={async () => appRuntime}>
      <RuntimeConsumer />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByText("controller-ready")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重新开始" }));

  expect(await screen.findByRole("header", { name: "无法验证本机访问状态" })).toBeTruthy();
  expect(screen.queryByText("controller-ready")).toBeNull();
});

test("shows the public landing before native persistence is initialized", async () => {
  const harness = nativePersistenceHarness();

  render(
    <JourneyRuntimeProvider createRuntime={harness.createRuntime}>
      <WelcomeRoute />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByTestId("welcome-landing")).toBeTruthy();
  expect(harness.adapters.secrets.getOrCreateDatabaseKey).not.toHaveBeenCalled();
  expect(harness.adapters.native.openDatabaseAsync).not.toHaveBeenCalled();
});

test("renders the real public journey layout without loading private navigation state", async () => {
  const harness = nativePersistenceHarness();

  render(
    <JourneyRuntimeProvider createRuntime={harness.createRuntime}>
      <JourneyLayout />
      <WelcomeRoute />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByTestId("welcome-landing")).toBeTruthy();
  expect(harness.adapters.secrets.getDatabaseKey).not.toHaveBeenCalled();
  expect(harness.adapters.secrets.getOrCreateDatabaseKey).not.toHaveBeenCalled();
  expect(harness.adapters.native.openDatabaseAsync).not.toHaveBeenCalled();
  expect(harness.sqlCalls).toEqual([]);
});

test("redirects public settings deep links without initializing private storage", async () => {
  const harness = nativePersistenceHarness();

  render(
    <JourneyRuntimeProvider createRuntime={harness.createRuntime}>
      <SettingsRoute />
    </JourneyRuntimeProvider>
  );

  await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: "/journey/welcome" }));
  expect(harness.adapters.secrets.getDatabaseKey).not.toHaveBeenCalled();
  expect(harness.adapters.secrets.getOrCreateDatabaseKey).not.toHaveBeenCalled();
  expect(harness.adapters.native.openDatabaseAsync).not.toHaveBeenCalled();
  expect(harness.sqlCalls).toEqual([]);
});

test("does not recreate native storage while returning to the public theme after deletion", async () => {
  const harness = nativePersistenceHarness({ adultDeclared: true });

  render(
    <JourneyRuntimeProvider createRuntime={harness.createRuntime}>
      <SettingsRoute />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByText("设置")).toBeTruthy();
  const keyCallsBeforeDelete = jest.mocked(
    harness.adapters.secrets.getOrCreateDatabaseKey
  ).mock.calls.length;
  const openCallsBeforeDelete = jest.mocked(
    harness.adapters.native.openDatabaseAsync
  ).mock.calls.length;
  expect(keyCallsBeforeDelete).toBe(1);
  expect(openCallsBeforeDelete).toBe(1);

  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  await waitFor(() => expect(harness.adapters.secrets.clearPendingLocalDataDeletion)
    .toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: "/journey/welcome" }));
  await act(async () => undefined);
  expect(harness.adapters.secrets.getOrCreateDatabaseKey).toHaveBeenCalledTimes(keyCallsBeforeDelete);
  expect(harness.adapters.native.openDatabaseAsync).toHaveBeenCalledTimes(openCallsBeforeDelete);
});

test("returns to the public gate when deletion partially fails after clearing adulthood", async () => {
  const harness = nativePersistenceHarness({
    adultDeclared: true,
    failFileRemovalOnce: true
  });

  render(
    <JourneyRuntimeProvider createRuntime={harness.createRuntime}>
      <SettingsRoute />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByText("设置")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  expect(await screen.findByRole("header", { name: "本机数据删除尚未完成" })).toBeTruthy();
  expect(mockRedirect).not.toHaveBeenCalledWith({ href: "/journey/welcome" });
  expect(harness.adapters.secrets.clearPendingLocalDataDeletion).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "重试删除" }));
  await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: "/journey/welcome" }));
});

test("returns to the public gate when deletion intent exists but clearing adulthood fails", async () => {
  const harness = nativePersistenceHarness({
    adultDeclared: true,
    failAdultClearOnce: true
  });

  render(
    <JourneyRuntimeProvider createRuntime={harness.createRuntime}>
      <SettingsRoute />
    </JourneyRuntimeProvider>
  );

  expect(await screen.findByText("设置")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "删除全部本机数据" }));
  fireEvent.press(screen.getByRole("button", { name: "确认删除全部本机数据" }));

  expect(await screen.findByRole("header", { name: "本机数据删除尚未完成" })).toBeTruthy();
  expect(mockRedirect).not.toHaveBeenCalledWith({ href: "/journey/welcome" });
  expect(harness.adapters.secrets.recordPendingLocalDataDeletion).toHaveBeenCalledTimes(1);
  expect(harness.adapters.files.removeDatabaseFiles).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "重试删除" }));
  await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: "/journey/welcome" }));
});

test.each([
  ["/journey/preface", <PrefaceRoute />],
  ["/journey/behavior-map", <BehaviorMapRoute />]
])("redirects the public deep link %s before protected content or storage mounts", async (
  pathname,
  protectedRoute
) => {
  const harness = nativePersistenceHarness();
  mockPathname = pathname;
  mockStackContent = protectedRoute;

  render(
    <JourneyRuntimeProvider createRuntime={harness.createRuntime}>
      <JourneyLayout />
    </JourneyRuntimeProvider>
  );

  await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: "/journey/welcome" }));
  expect(mockStackRender).not.toHaveBeenCalled();
  expect(harness.adapters.secrets.getDatabaseKey).not.toHaveBeenCalled();
  expect(harness.adapters.secrets.getOrCreateDatabaseKey).not.toHaveBeenCalled();
  expect(harness.adapters.native.openDatabaseAsync).not.toHaveBeenCalled();
  expect(harness.sqlCalls).toEqual([]);
});

test("does not confirm adulthood or write its marker when an existing draft needs recovery", async () => {
  const appRuntime = runtime("native-secure");
  jest.spyOn(appRuntime.adultDeclaration, "hasAdultDeclaration").mockResolvedValue(false);
  const initialize = jest.spyOn(appRuntime.service, "initialize").mockResolvedValue("recovery-required");
  const confirmAdult = jest.spyOn(appRuntime.service, "confirmAdult");
  const recordAdultDeclaration = jest.spyOn(
    appRuntime.adultDeclaration,
    "recordAdultDeclaration"
  );

  render(
    <JourneyRuntimeProvider createRuntime={async () => appRuntime}>
      <AdultGateRoute />
    </JourneyRuntimeProvider>
  );

  fireEvent.press(await screen.findByRole("button", { name: "我已年满 18 岁，继续" }));

  expect(await screen.findByText("确认暂时无法保存，请重试。")).toBeTruthy();
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(confirmAdult).not.toHaveBeenCalled();
  expect(recordAdultDeclaration).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalledWith("/journey/preface");
});

test("a successful first native declaration remounts the authorized route and opens the preface", async () => {
  const harness = nativePersistenceHarness();

  render(
    <JourneyRuntimeProvider createRuntime={harness.createRuntime}>
      <AdultGateRoute />
    </JourneyRuntimeProvider>
  );

  fireEvent.press(await screen.findByRole("button", { name: "我已年满 18 岁，继续" }));

  await waitFor(() => expect(mockRouter.replace.mock.calls).toEqual([["/journey/preface"]]));
  expect(harness.adapters.secrets.recordAdultDeclaration).toHaveBeenCalledTimes(1);
  expect(harness.adapters.native.openDatabaseAsync).toHaveBeenCalledTimes(1);
});

test("a failed first native declaration marker stays public and retries the marker before opening the preface", async () => {
  const harness = nativePersistenceHarness({ failAdultRecordOnce: true });
  const appRuntime = await harness.createRuntime();

  render(
    <JourneyRuntimeProvider createRuntime={async () => appRuntime}>
      <AdultGateRoute />
    </JourneyRuntimeProvider>
  );

  fireEvent.press(await screen.findByRole("button", { name: "我已年满 18 岁，继续" }));

  expect(await screen.findByText("确认暂时无法保存，请重试。")).toBeTruthy();
  expect(appRuntime.service.getSnapshot()).toMatchObject({ ageConfirmed: true });
  expect(harness.adapters.secrets.recordAdultDeclaration).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).not.toHaveBeenCalledWith("/journey/preface");

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));

  await waitFor(() => expect(harness.adapters.secrets.recordAdultDeclaration).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(mockRouter.replace.mock.calls).toEqual([["/journey/preface"]]));
});

test("first launch through the underage exit never creates a key, database, migration, draft, or declaration", async () => {
  const harness = nativePersistenceHarness();

  const view = render(
    <JourneyRuntimeProvider createRuntime={harness.createRuntime}>
      <AdultGateRoute />
    </JourneyRuntimeProvider>
  );

  fireEvent.press(await screen.findByRole("button", { name: "我未满 18 岁" }));

  expect(mockRouter.replace).toHaveBeenCalledWith("/underage-exit");
  expect(harness.adapters.secrets.getDatabaseKey).not.toHaveBeenCalled();
  expect(harness.adapters.secrets.getOrCreateDatabaseKey).not.toHaveBeenCalled();
  expect(harness.adapters.secrets.recordAdultDeclaration).not.toHaveBeenCalled();
  expect(harness.adapters.native.openDatabaseAsync).not.toHaveBeenCalled();
  expect(harness.database.runAsync).not.toHaveBeenCalled();
  expect(harness.sqlCalls.some((sql) => sql.includes("CREATE TABLE"))).toBe(false);
  view.unmount();
});
