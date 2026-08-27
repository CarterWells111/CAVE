import { fireEvent, render, screen, waitFor, type RenderAPI } from "@testing-library/react-native";
import type { ReactElement } from "react";

import BehaviorMapRoute from "../../../app/journey/behavior-map";
import BodyKnowledgeRoute from "../../../app/journey/body-knowledge";
import FinalPreparationRoute from "../../../app/journey/final-preparation";
import OvernightRoute from "../../../app/journey/overnight";
import PresetPracticeRoute from "../../../app/journey/preset-practice";
import ReflectionRoute from "../../../app/journey/reflection";
import WelcomeRoute from "../../../app/journey/welcome";
import type { JourneyPageId } from "./domain/types";
import { InMemoryCommunicationCardRepository, InMemoryJourneyDraftRepository } from "./infrastructure/in-memory-journey-repositories";
import { composeJourneyRuntime, type JourneyRuntime } from "./runtime/journey-runtime";
import { JourneyRuntimeProvider } from "./runtime/JourneyRuntimeProvider";

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn()
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter
}));

function runtime(clipboard = { setStringAsync: jest.fn(async () => undefined) }) {
  const drafts = new InMemoryJourneyDraftRepository();
  const cards = new InMemoryCommunicationCardRepository();
  return composeJourneyRuntime({
    mode: "expo-go-demo",
    persistence: "memory-only",
    drafts,
    cards,
    clipboard,
    createId: () => "production-flow-journey",
    now: () => "2026-08-27T12:00:00.000Z"
  });
}

async function openRoute(element: ReactElement, journeyRuntime: JourneyRuntime): Promise<RenderAPI> {
  const view = render(
    <JourneyRuntimeProvider createRuntime={async () => journeyRuntime}>
      {element}
    </JourneyRuntimeProvider>
  );
  expect(await screen.findByText("Expo Go 演示模式，数据仅在本次打开期间暂存")).toBeTruthy();
  return view;
}

test("the production routes expose all seven screens offline without an eighth route", async () => {
  const originalFetch = globalThis.fetch;
  const offlineFetch = jest.fn(async () => { throw new Error("offline"); });
  globalThis.fetch = offlineFetch as typeof fetch;
  const journeyRuntime = runtime();
  let view: RenderAPI | undefined;

  try {
    view = await openRoute(<WelcomeRoute />, journeyRuntime);
    expect(screen.queryByTestId("progress-center")).toBeNull();
    view.unmount();

    await journeyRuntime.controller.enterWelcome({ adult: true, prefaceRead: false });
    const screens: Array<[JourneyPageId, number, ReactElement]> = [
      ["overnight", 2, <OvernightRoute />],
      ["body-knowledge", 3, <BodyKnowledgeRoute />],
      ["behavior-map", 4, <BehaviorMapRoute />],
      ["reflection", 5, <ReflectionRoute />],
      ["preset-practice", 6, <PresetPracticeRoute />],
      ["final-preparation", 7, <FinalPreparationRoute />]
    ];

    for (const [pageId, pageNumber, route] of screens) {
      await journeyRuntime.service.navigateTo(pageId);
      view = await openRoute(route, journeyRuntime);
      expect(screen.getByTestId(`journey-page-${pageId}`)).toBeTruthy();
      expect(screen.getByText(`${pageNumber} / 7`)).toBeTruthy();
      expect(screen.queryByText(/8\s*\/\s*8|共\s*8\s*页/u)).toBeNull();
      expect(screen.getByRole("button", { name: "退出旅程" })).toBeTruthy();
      view.unmount();
      view = undefined;
    }

    expect(offlineFetch).not.toHaveBeenCalled();
  } finally {
    view?.unmount();
    globalThis.fetch = originalFetch;
  }
});

test("the production underage route exits without creating an active draft", async () => {
  const journeyRuntime = runtime();
  const view = await openRoute(<WelcomeRoute />, journeyRuntime);

  fireEvent.press(screen.getByText("我未满18岁"));

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/journey/underage-exit"));
  expect(await journeyRuntime.drafts.loadActive()).toBeNull();
  view.unmount();
});

test("clipboard failure is structured and visible on the production final screen", async () => {
  const clipboard = { setStringAsync: jest.fn(async () => { throw new Error("denied"); }) };
  const journeyRuntime = runtime(clipboard);
  await journeyRuntime.service.confirmAdult();
  await journeyRuntime.service.navigateTo("final-preparation");
  const view = await openRoute(<FinalPreparationRoute />, journeyRuntime);

  fireEvent.press(screen.getByText("复制当前卡片"));

  expect(await screen.findByText("复制失败，请重试")).toBeTruthy();
  view.unmount();
});
