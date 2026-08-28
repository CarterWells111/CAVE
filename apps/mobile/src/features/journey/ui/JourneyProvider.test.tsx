import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { startTransition, Suspense, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { createJourneyDraft, type JourneyDraft } from "../domain/types";
import { DatabaseRecoveryRequiredError } from "../../../core/storage/database";
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

function draft(id: string) {
  return createJourneyDraft({ id, now: "2026-08-27T08:00:00.000Z" });
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

function PendingRender({ promise }: { promise: Promise<void> }): ReactNode {
  throw promise;
}

test("shows one loading state before initialization then exposes context", async () => {
  const app = service();
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  const loadingStatus = screen.getByRole("status", { name: "ⓘ 正在恢复本机旅程…" });
  expect(screen.getByText("正在恢复本机旅程…")).toBeTruthy();
  expect(loadingStatus.props.accessibilityLiveRegion).toBe("polite");
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});

test("shows retry and reset actions instead of a blank screen after initialization failure", async () => {
  const app = service();
  app.initialize.mockRejectedValueOnce(new Error("storage unavailable"));
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByRole("header", { name: "无法读取本机旅程" })).toBeTruthy();
  expect(screen.getByRole("alert", { name: "读取失败，请重试。" })).toHaveProp(
    "accessibilityLiveRegion",
    "assertive"
  );
  expect(screen.getByText("错误代码：journey-runtime-initialization-failed")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  await waitFor(() => expect(app.initialize).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});

test("falls back to a safe error when database recovery has no outer handler", async () => {
  const app = service();
  app.initialize.mockRejectedValueOnce(new DatabaseRecoveryRequiredError("key-mismatch"));

  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByRole("header", { name: "无法读取本机旅程" })).toBeTruthy();
  expect(screen.queryByText("journey-ready")).toBeNull();
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

test("shows a safe generic initialization error without exposing the rejected error", async () => {
  const app = service();
  app.initialize.mockRejectedValueOnce(new Error("private storage path /secret/journey.db"));
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByText("无法读取本机旅程")).toBeTruthy();
  const errorStatus = screen.getByRole("alert", { name: "读取失败，请重试。" });
  expect(errorStatus.props.accessibilityLiveRegion).toBe("assertive");
  expect(screen.queryByText(/private storage path|secret|journey\.db/u)).toBeNull();
});

test("guards a pending retry against rapid duplicate presses", async () => {
  const app = service();
  const retry = deferred<"ready" | "recovery-required">();
  app.initialize
    .mockRejectedValueOnce(new Error("initial failure"))
    .mockReturnValueOnce(retry.promise);
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  fireEvent.press(await screen.findByRole("button", { name: "重试" }));
  fireEvent.press(screen.getByRole("button", { name: "正在重试…" }));

  expect(app.initialize).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "正在重试…" }).props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );

  await act(async () => { retry.resolve("ready"); });
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});

test("requires an explicit reset for an unsupported stored schema", async () => {
  const app = service();
  app.initialize
    .mockResolvedValueOnce("recovery-required")
    .mockResolvedValueOnce("ready");
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByRole("header", { name: "本机旅程需要恢复" })).toBeTruthy();
  expect(screen.getByRole("alert", {
    name: "当前本机草稿版本无法继续使用。重置后可以安全重新开始。"
  })).toHaveProp("accessibilityLiveRegion", "assertive");
  fireEvent.press(screen.getByRole("button", { name: "重置本机旅程" }));

  await waitFor(() => expect(app.resetJourney).toHaveBeenCalledTimes(1));
  expect(app.initialize).toHaveBeenCalledTimes(2);
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});

test("shows a structured error when an explicit recovery reset fails", async () => {
  const app = service();
  app.initialize.mockResolvedValue("recovery-required");
  app.resetJourney.mockRejectedValue(new Error("delete-failed"));
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByRole("header", { name: "本机旅程需要恢复" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重置本机旅程" }));

  expect(await screen.findByText("错误代码：journey-runtime-reset-failed")).toBeTruthy();
  expect(screen.getByRole("alert", { name: "重置失败，请重试。" })).toHaveProp(
    "accessibilityLiveRegion",
    "assertive"
  );
  expect(app.initialize).toHaveBeenCalledTimes(1);
});

test("guards reset while pending and exposes a recoverable safe failure", async () => {
  const app = service();
  const reset = deferred<void>();
  app.initialize.mockResolvedValueOnce("recovery-required");
  app.resetJourney.mockReturnValueOnce(reset.promise);
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  fireEvent.press(await screen.findByRole("button", { name: "重置本机旅程" }));
  fireEvent.press(screen.getByRole("button", { name: "正在重置…" }));

  expect(app.resetJourney).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "正在重置…" }).props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );

  await act(async () => { reset.reject(new Error("private reset failure")); });
  expect(await screen.findByRole("alert", { name: "重置失败，请重试。" })).toBeTruthy();
  expect(screen.queryByText("private reset failure")).toBeNull();
  expect(screen.getByRole("button", { name: "重置本机旅程" }).props.accessibilityState?.disabled).not.toBe(true);
});

test("ignores an old service recovery result after a newer service becomes ready", async () => {
  const appA = service();
  const appB = service();
  const initializeA = deferred<"ready" | "recovery-required">();
  const initializeB = deferred<"ready" | "recovery-required">();
  appA.getSnapshot.mockReturnValue(draft("service-a"));
  appB.getSnapshot.mockReturnValue(draft("service-b"));
  appA.initialize.mockReturnValue(initializeA.promise);
  appB.initialize.mockReturnValue(initializeB.promise);

  const view = render(<JourneyProvider service={appA}><Consumer /></JourneyProvider>);
  view.rerender(<JourneyProvider service={appB}><Consumer /></JourneyProvider>);

  await act(async () => { initializeB.resolve("ready"); });
  expect(await screen.findByText("service-b")).toBeTruthy();

  await act(async () => { initializeA.resolve("recovery-required"); });
  expect(screen.getByText("service-b")).toBeTruthy();
  expect(screen.queryByText("本机旅程需要恢复")).toBeNull();
});

test("ignores an old service rejection after a newer service becomes ready", async () => {
  const appA = service();
  const appB = service();
  const initializeA = deferred<"ready" | "recovery-required">();
  const initializeB = deferred<"ready" | "recovery-required">();
  appA.getSnapshot.mockReturnValue(draft("service-a"));
  appB.getSnapshot.mockReturnValue(draft("service-b"));
  appA.initialize.mockReturnValue(initializeA.promise);
  appB.initialize.mockReturnValue(initializeB.promise);

  const view = render(<JourneyProvider service={appA}><Consumer /></JourneyProvider>);
  view.rerender(<JourneyProvider service={appB}><Consumer /></JourneyProvider>);

  await act(async () => { initializeB.resolve("ready"); });
  expect(await screen.findByText("service-b")).toBeTruthy();

  await act(async () => { initializeA.reject(new Error("stale private failure")); });
  expect(screen.getByText("service-b")).toBeTruthy();
  expect(screen.queryByText("无法读取本机旅程")).toBeNull();
  expect(screen.queryByText("stale private failure")).toBeNull();
});

test("does not settle initialization state after unmount", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const resolvingApp = service();
    const resolvingInitialize = deferred<"ready" | "recovery-required">();
    resolvingApp.initialize.mockReturnValue(resolvingInitialize.promise);
    const resolvingView = render(
      <JourneyProvider service={resolvingApp}><Consumer /></JourneyProvider>
    );
    resolvingView.unmount();

    await act(async () => { resolvingInitialize.resolve("ready"); });
    expect(resolvingApp.getSnapshot).not.toHaveBeenCalled();

    const rejectingApp = service();
    const rejectingInitialize = deferred<"ready" | "recovery-required">();
    rejectingApp.initialize.mockReturnValue(rejectingInitialize.promise);
    const rejectingView = render(
      <JourneyProvider service={rejectingApp}><Consumer /></JourneyProvider>
    );
    rejectingView.unmount();

    await act(async () => { rejectingInitialize.reject(new Error("private unmounted failure")); });
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    consoleError.mockRestore();
  }
});

test("does not resume an old reset after the service changes", async () => {
  const appA = service();
  const appB = service();
  const resetA = deferred<void>();
  const initializeB = deferred<"ready" | "recovery-required">();
  appA.getSnapshot.mockReturnValue(draft("service-a"));
  appB.getSnapshot.mockReturnValue(draft("service-b"));
  appA.initialize.mockResolvedValueOnce("recovery-required");
  appA.resetJourney.mockReturnValueOnce(resetA.promise);
  appB.initialize.mockReturnValueOnce(initializeB.promise);

  const view = render(<JourneyProvider service={appA}><Consumer /></JourneyProvider>);
  fireEvent.press(await screen.findByRole("button", { name: "重置本机旅程" }));
  view.rerender(<JourneyProvider service={appB}><Consumer /></JourneyProvider>);

  await act(async () => { initializeB.resolve("ready"); });
  expect(await screen.findByText("service-b")).toBeTruthy();

  await act(async () => { resetA.resolve(); });
  expect(appA.initialize).toHaveBeenCalledTimes(1);
  expect(screen.getByText("service-b")).toBeTruthy();
});

test("keeps the committed service current when a concurrent service render suspends", async () => {
  const appA = service();
  const appB = service();
  const initializeA = deferred<"ready" | "recovery-required">();
  const blockedRender = deferred<void>();
  appA.getSnapshot.mockReturnValue(draft("service-a"));
  appA.initialize.mockReturnValue(initializeA.promise);

  const view = render(
    <Suspense fallback={<Text>transition-fallback</Text>}>
      <JourneyProvider service={appA}><Consumer /></JourneyProvider>
    </Suspense>
  );

  await act(async () => {
    startTransition(() => {
      view.rerender(
        <Suspense fallback={<Text>transition-fallback</Text>}>
          <JourneyProvider service={appB}><Consumer /></JourneyProvider>
          <PendingRender promise={blockedRender.promise} />
        </Suspense>
      );
    });
  });

  expect(screen.getByRole("status", { name: "ⓘ 正在恢复本机旅程…" })).toBeTruthy();
  expect(appB.initialize).not.toHaveBeenCalled();

  await act(async () => { initializeA.resolve("ready"); });
  expect(await screen.findByText("service-a")).toBeTruthy();
  expect(screen.queryByText("transition-fallback")).toBeNull();

  view.unmount();
});
