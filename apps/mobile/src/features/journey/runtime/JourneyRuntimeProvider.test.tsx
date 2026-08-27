import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StrictMode } from "react";
import { Pressable, Text, View } from "react-native";

import {
  InMemoryCommunicationCardRepository,
  InMemoryJourneyDraftRepository
} from "../infrastructure/in-memory-journey-repositories";
import {
  composeJourneyRuntime,
  type JourneyRuntime,
  type JourneyRuntimeMode
} from "./journey-runtime";
import { JourneyRuntimeProvider, useJourneyRuntime } from "./JourneyRuntimeProvider";

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
  const { controller, mode, restart, runAndRefresh, service, snapshot } = useJourneyRuntime();

  return (
    <View>
      <Text>{mode}</Text>
      <Text>{controller === undefined ? "missing-controller" : "controller-ready"}</Text>
      <Text>{snapshot?.id ?? "no-runtime-snapshot"}</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        void runAndRefresh(() => service.confirmAdult());
      }}>
        <Text>开始旅程</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void restart(); }}>
        <Text>重新开始</Text>
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
