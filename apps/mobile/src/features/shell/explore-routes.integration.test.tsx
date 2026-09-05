import { resolve } from "node:path";
import { createContext, useContext as mockUseContext, useState } from "react";
import { Button, Text } from "react-native";
import { Stack, router } from "expo-router";
import { act, fireEvent, getMockContext, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createJourneyDraft } from "../journey/domain/types";

const draft = { ...createJourneyDraft({ id: "original", now: "2026-09-04T00:00:00.000Z" }), ageConfirmed: true, addressPreference: "妳" as const, prefaceRead: true };
const mockShellLoad = jest.fn(async () => null);
let mockRuntime: { snapshot: typeof draft | null; shellState: { load: typeof mockShellLoad } } | null;
const mockRuntimeContext = createContext<typeof mockRuntime>(null);
let rerenderRoot: () => void;
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useOptionalJourneyRuntime: () => mockUseContext(mockRuntimeContext),
  useAdultDeclaration: () => ({ status: mockUseContext(mockRuntimeContext) === null ? "public" : "authorized" }),
}));
function Root() {
  const [, update] = useState(0);
  rerenderRoot = () => update((value) => value + 1);
  return <mockRuntimeContext.Provider value={mockRuntime}><Stack screenOptions={{ headerShown: false }} /></mockRuntimeContext.Provider>;
}
function MapMarker() {
  return <><Text>地图入口</Text><Button title="进入样板" onPress={() => router.push({ pathname: "/explore/[journeyId]", params: { journeyId: "journey-01" } })} /></>;
}
function open(initialUrl: string) {
  const actual = getMockContext(resolve(__dirname, "../../../app"));
  const context = Object.fromEntries(actual.keys().map((key) => [
    key.replace(/^\.\//u, "").replace(/\.[tj]sx?$/u, ""),
    key === "./_layout.tsx" ? Root
      : key === "./(tabs)/index.tsx" ? MapMarker
        : key === "./journey/_layout.tsx" ? (() => <Stack screenOptions={{ headerShown: false }} />)
          : key === "./journey/welcome.tsx" ? (() => <Text>欢迎引导</Text>)
            : key === "./journey/preface.tsx" ? (() => <Text>需要完成前言</Text>)
              : () => { const Page = actual(key).default; return <Page />; },
  ]));
  return renderRouter({ ...context, "+not-found": () => <Text>未匹配路由</Text> }, { initialUrl });
}
beforeEach(() => {
  mockRuntime = { snapshot: draft, shellState: { load: mockShellLoad } };
  mockShellLoad.mockReset().mockResolvedValue(null);
});

test("real dynamic sample route pages through and exits to the map", async () => {
  const view = open("/explore/journey-02");
  await screen.findByText("旅程 02");
  expect(screen.getByText("1 / 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "下一页" }));
  expect(screen.getByText("2 / 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  expect(screen.getByText("1 / 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "退出旅程" }));
  await screen.findByText("地图入口");
  expect(view.getPathname()).toBe("/");
  expect(mockRuntime?.snapshot).toBe(draft);
});

test("unknown journey IDs have a working map-return action", async () => {
  const view = open("/explore/unknown");
  fireEvent.press(await screen.findByRole("button", { name: "返回地图" }));
  await screen.findByText("地图入口");
  expect(view.getPathname()).toBe("/");
});

test("undeclared cold links cannot show sample content or read completion", async () => {
  mockRuntime = null;
  open("/explore/journey-01");
  await screen.findByText("欢迎引导");
  expect(screen.queryByText("旅程 01")).toBeNull();
  expect(mockShellLoad).not.toHaveBeenCalled();
});

test("unfinished onboarding is redirected before showing a sample", async () => {
  mockRuntime = { snapshot: { ...draft, prefaceRead: false }, shellState: { load: mockShellLoad } };
  open("/explore/journey-01");
  await screen.findByText("需要完成前言");
  expect(screen.queryByText("旅程 01")).toBeNull();
});

test("revocation hides active and retained sample screens", async () => {
  open("/explore/journey-01");
  await screen.findByText("旅程 01");
  await act(async () => { router.push({ pathname: "/explore/[journeyId]", params: { journeyId: "journey-02" } }); });
  await screen.findByText("旅程 02");
  await act(async () => { mockRuntime = null; rerenderRoot(); });
  await screen.findByText("欢迎引导");
  expect(screen.queryAllByText(/旅程 0[12]/u, { includeHiddenElements: true })).toHaveLength(0);
});

test("switching IDs and reopening a sample both start at page one", async () => {
  open("/(tabs)");
  fireEvent.press(await screen.findByRole("button", { name: "进入样板" }));
  await screen.findByText("旅程 01");
  fireEvent.press(screen.getByRole("button", { name: "下一页" }));
  await act(async () => { router.setParams({ journeyId: "journey-02" }); });
  await screen.findByText("旅程 02");
  expect(screen.getByText("1 / 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "退出旅程" }));
  fireEvent.press(await screen.findByRole("button", { name: "进入样板" }));
  await waitFor(() => expect(screen.getByText("1 / 3")).toBeTruthy());
});
