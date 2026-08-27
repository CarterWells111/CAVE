import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import type { JourneyDraft } from "../domain/types";
import { JourneyProvider, useJourney } from "./JourneyProvider";

function service() {
  let snapshot: JourneyDraft | null = null;
  return {
    getSnapshot: jest.fn(() => snapshot),
    initialize: jest.fn(async (): Promise<"ready" | "recovery-required"> => "ready"),
    confirmAdult: jest.fn(async () => undefined),
    dispatch: jest.fn(async () => undefined),
    navigateTo: jest.fn(async () => undefined),
    resetJourney: jest.fn(async () => { snapshot = null; })
  };
}

function Consumer() {
  const { snapshot } = useJourney();
  return <Text>{snapshot === null ? "journey-ready" : snapshot.id}</Text>;
}

test("shows one loading state before initialization then exposes context", async () => {
  const app = service();
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(screen.getByText("正在恢复本机旅程…")).toBeTruthy();
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});

test("shows retry and reset actions instead of a blank screen after initialization failure", async () => {
  const app = service();
  app.initialize.mockRejectedValueOnce(new Error("storage unavailable"));
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByText("无法读取本机旅程")).toBeTruthy();
  fireEvent.press(screen.getByText("重试"));
  await waitFor(() => expect(app.initialize).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});

test("requires an explicit reset for an unsupported stored schema", async () => {
  const app = service();
  app.initialize
    .mockResolvedValueOnce("recovery-required")
    .mockResolvedValueOnce("ready");
  render(<JourneyProvider service={app}><Consumer /></JourneyProvider>);

  expect(await screen.findByText("本机旅程需要恢复")).toBeTruthy();
  fireEvent.press(screen.getByText("重置本机旅程"));

  await waitFor(() => expect(app.resetJourney).toHaveBeenCalledTimes(1));
  expect(app.initialize).toHaveBeenCalledTimes(2);
  expect(await screen.findByText("journey-ready")).toBeTruthy();
});
