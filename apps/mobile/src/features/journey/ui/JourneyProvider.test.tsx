import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { createJourneyDraft, type JourneyDraft } from "../domain/types";
import { JourneyProvider, useJourney } from "./JourneyProvider";

function service(initialSnapshotId?: string) {
  let snapshot: JourneyDraft | null = initialSnapshotId === undefined
    ? null
    : createJourneyDraft({ id: initialSnapshotId, now: "2026-08-27T12:00:00.000Z" });
  return {
    getSnapshot: jest.fn(() => snapshot),
    initialize: jest.fn(async (): Promise<"ready" | "recovery-required"> => "ready"),
    confirmAdult: jest.fn(async () => {
      snapshot = {
        ...createJourneyDraft({ id: "journey-1", now: "2026-08-27T12:00:00.000Z" }),
        ageConfirmed: true
      };
    }),
    dispatch: jest.fn(async () => undefined),
    navigateTo: jest.fn(async () => undefined),
    resetJourney: jest.fn(async () => { snapshot = null; })
  };
}

function Consumer() {
  const { snapshot } = useJourney();
  return <Text>{snapshot === null ? "journey-ready" : snapshot.id}</Text>;
}

function ActionConsumer() {
  const { runAndRefresh, service: app, snapshot } = useJourney();
  const [result, setResult] = useState("idle");

  return (
    <View>
      <Text>{snapshot?.id ?? "no-snapshot"}</Text>
      <Text>{result}</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        void runAndRefresh(async () => {
          await app.confirmAdult();
          return "command-result";
        }).then(setResult);
      }}>
        <Text>运行命令</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => {
        void runAndRefresh(async () => {
          await app.confirmAdult();
          throw new Error("command-failed");
        }).catch((error: Error) => setResult(error.message));
      }}>
        <Text>运行失败命令</Text>
      </Pressable>
    </View>
  );
}

function PendingActionConsumer({ waitForRelease }: { waitForRelease: Promise<void> }) {
  const { runAndRefresh, service: app, snapshot } = useJourney();

  return (
    <View>
      <Text>{snapshot?.id ?? "no-pending-snapshot"}</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        void runAndRefresh(async () => {
          await waitForRelease;
          await app.confirmAdult();
        });
      }}>
        <Text>运行延迟命令</Text>
      </Pressable>
    </View>
  );
}

test("shows one loading state before initialization then exposes context", async () => {
  const app = service();
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(screen.getByText("正在恢复本机旅程…")).toBeTruthy();
  expect(screen.getByText("正在恢复本机旅程…")).toHaveProp("accessibilityLiveRegion", "polite");
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});

test("shows retry and reset actions instead of a blank screen after initialization failure", async () => {
  const app = service();
  app.initialize.mockRejectedValueOnce(new Error("storage unavailable"));
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByText("无法读取本机旅程")).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByText("错误代码：journey-runtime-initialization-failed")).toBeTruthy();
  fireEvent.press(screen.getByText("重试"));
  await waitFor(() => expect(app.initialize).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});

test("runAndRefresh returns the command result and publishes its updated snapshot", async () => {
  const app = service();
  render(<JourneyProvider service={app}><ActionConsumer /></JourneyProvider>);

  expect(await screen.findByText("no-snapshot")).toBeTruthy();
  fireEvent.press(screen.getByText("运行命令"));

  expect(await screen.findByText("journey-1")).toBeTruthy();
  expect(screen.getByText("command-result")).toBeTruthy();
});

test("runAndRefresh publishes a mutation before propagating a command rejection", async () => {
  const app = service();
  render(<JourneyProvider service={app}><ActionConsumer /></JourneyProvider>);

  expect(await screen.findByText("no-snapshot")).toBeTruthy();
  fireEvent.press(screen.getByText("运行失败命令"));

  expect(await screen.findByText("journey-1")).toBeTruthy();
  expect(screen.getByText("command-failed")).toBeTruthy();
});

test("ignores an obsolete initialization result after the service changes", async () => {
  let resolveObsolete!: (state: "ready" | "recovery-required") => void;
  const obsolete = service("obsolete-journey");
  obsolete.initialize.mockImplementation(() => new Promise((resolve) => {
    resolveObsolete = resolve;
  }));
  const current = service("current-journey");
  const { rerender } = render(<JourneyProvider service={obsolete}><Consumer /></JourneyProvider>);

  rerender(<JourneyProvider service={current}><Consumer /></JourneyProvider>);
  expect(await screen.findByText("current-journey")).toBeTruthy();

  await act(async () => { resolveObsolete("ready"); });
  expect(screen.getByText("current-journey")).toBeTruthy();
  expect(screen.queryByText("obsolete-journey")).toBeNull();
});

test("does not publish a pending action snapshot after its service is replaced", async () => {
  let releaseAction!: () => void;
  const waitForRelease = new Promise<void>((resolve) => { releaseAction = resolve; });
  const obsolete = service();
  const current = service("current-journey");
  const { rerender } = render(
    <JourneyProvider service={obsolete}>
      <PendingActionConsumer waitForRelease={waitForRelease} />
    </JourneyProvider>
  );

  expect(await screen.findByText("no-pending-snapshot")).toBeTruthy();
  fireEvent.press(screen.getByText("运行延迟命令"));
  rerender(<JourneyProvider service={current}><Consumer /></JourneyProvider>);
  expect(await screen.findByText("current-journey")).toBeTruthy();

  await act(async () => { releaseAction(); });
  expect(screen.getByText("current-journey")).toBeTruthy();
  expect(screen.queryByText("journey-1")).toBeNull();
});

test("requires an explicit reset for an unsupported stored schema", async () => {
  const app = service();
  app.initialize
    .mockResolvedValueOnce("recovery-required")
    .mockResolvedValueOnce("ready");
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByText("本机旅程需要恢复")).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.press(screen.getByText("重置本机旅程"));

  await waitFor(() => expect(app.resetJourney).toHaveBeenCalledTimes(1));
  expect(app.initialize).toHaveBeenCalledTimes(2);
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});

test("shows a structured error when an explicit recovery reset fails", async () => {
  const app = service();
  app.initialize.mockResolvedValue("recovery-required");
  app.resetJourney.mockRejectedValue(new Error("delete-failed"));
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByText("本机旅程需要恢复")).toBeTruthy();
  fireEvent.press(screen.getByText("重置本机旅程"));

  expect(await screen.findByText("错误代码：journey-runtime-reset-failed")).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(app.initialize).toHaveBeenCalledTimes(1);
});
