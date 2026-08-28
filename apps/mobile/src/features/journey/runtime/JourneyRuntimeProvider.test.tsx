import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StrictMode, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import JourneyLayout from "../../../../app/journey/_layout";
import AdultGateRoute from "../../../../app/journey/adult-gate";
import BehaviorMapRoute from "../../../../app/journey/behavior-map";
import PrefaceRoute from "../../../../app/journey/preface";
import WelcomeRoute from "../../../../app/journey/welcome";
import type { DatabaseConnection } from "../../../core/storage/database";
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
import { JourneyRuntimeProvider, useJourneyRuntime } from "./JourneyRuntimeProvider";

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

function nativePersistenceHarness() {
  let databaseExists = false;
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
      removeDatabaseFiles: jest.fn(async () => { databaseExists = false; })
    },
    secrets: {
      getDatabaseKey: jest.fn(async () => null),
      getOrCreateDatabaseKey: jest.fn(async () => "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
      getOrCreateInstallationToken: jest.fn(async () => "token"),
      deleteDatabaseKey: jest.fn(async () => undefined),
      deleteAllSecrets: jest.fn(async () => undefined),
      hasAdultDeclaration: jest.fn(async () => false),
      recordAdultDeclaration: jest.fn(async () => undefined),
      deleteAdultDeclaration: jest.fn(async () => undefined)
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

function RuntimeConsumer() {
  const { controller, deleteAllData, mode, restart, runAndRefresh, service, shellState, snapshot } = useJourneyRuntime();

  return (
    <View>
      <Text>{mode}</Text>
      <Text>{controller === undefined ? "missing-controller" : "controller-ready"}</Text>
      <Text>{shellState === undefined ? "missing-shell-state" : "shell-state-ready"}</Text>
      <Text>{snapshot?.id ?? "no-runtime-snapshot"}</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        void runAndRefresh(() => service.confirmAdult());
      }}>
        <Text>开始旅程</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void restart(); }}>
        <Text>重新开始</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void deleteAllData(); }}>
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

test("publishes a cleared snapshot after deleting all local data", async () => {
  render(
    <JourneyRuntimeProvider createRuntime={async () => runtime()}>
      <RuntimeConsumer />
    </JourneyRuntimeProvider>
  );
  expect(await screen.findByText("no-runtime-snapshot")).toBeTruthy();
  fireEvent.press(screen.getByText("开始旅程"));
  expect(await screen.findByText("journey-runtime-1")).toBeTruthy();
  fireEvent.press(screen.getByText("删除全部"));
  await waitFor(() => expect(screen.getByText("no-runtime-snapshot")).toBeTruthy());
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
