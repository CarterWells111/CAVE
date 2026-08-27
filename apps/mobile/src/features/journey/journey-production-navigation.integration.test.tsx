import { act, fireEvent, render, screen, waitFor, type RenderAPI } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { Alert } from "react-native";

import BehaviorAttitudesRoute from "../../../app/journey/behavior-attitudes";
import ReflectionRoute from "../../../app/journey/reflection";
import WelcomeRoute from "../../../app/journey/welcome";
import {
  InMemoryCommunicationCardRepository,
  InMemoryJourneyDraftRepository
} from "./infrastructure/in-memory-journey-repositories";
import { composeJourneyRuntime, type JourneyRuntime } from "./runtime/journey-runtime";
import { JourneyRuntimeProvider } from "./runtime/JourneyRuntimeProvider";

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn()
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter
}));

function runtime() {
  return composeJourneyRuntime({
    mode: "expo-go-demo",
    persistence: "memory-only",
    drafts: new InMemoryJourneyDraftRepository(),
    cards: new InMemoryCommunicationCardRepository(),
    clipboard: { setStringAsync: jest.fn(async () => undefined) },
    createId: () => "production-navigation-journey",
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

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("the production Welcome route resumes at the persisted journey page", async () => {
  const journeyRuntime = runtime();
  await journeyRuntime.service.confirmAdult();
  await journeyRuntime.service.navigateTo("checklist");
  const view = await openRoute(<WelcomeRoute />, journeyRuntime);

  fireEvent.press(screen.getByText("继续本机旅程"));

  expect(mockRouter.replace).toHaveBeenCalledWith("/journey/checklist");
  view.unmount();
});

test("the production Welcome route confirms restart before resetting and returning to welcome", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const journeyRuntime = runtime();
  await journeyRuntime.service.confirmAdult();
  await journeyRuntime.service.navigateTo("reflection");
  const view = await openRoute(<WelcomeRoute />, journeyRuntime);

  fireEvent.press(screen.getByText("重新开始（需要确认）"));

  expect(alert).toHaveBeenCalledWith(
    "确认重新开始",
    "当前旅程草稿会被清除。",
    expect.arrayContaining([expect.objectContaining({ text: "确认重新开始", style: "destructive" })])
  );
  const destructive = alert.mock.calls[0]?.[2]?.find(({ style }) => style === "destructive");
  await act(async () => { destructive?.onPress?.(); });

  await waitFor(() => expect(journeyRuntime.service.getSnapshot()).toBeNull());
  expect(mockRouter.replace).toHaveBeenCalledWith("/journey/welcome");
  view.unmount();
});

test("production back navigation can edit Page 4 and recompute derived output without losing user text", async () => {
  const journeyRuntime = runtime();
  await journeyRuntime.service.confirmAdult();
  await journeyRuntime.controller.setBehaviorAttitude("draft-kissing", "unsure");
  await journeyRuntime.controller.editCommunicationCard("pace", "请保留我的节奏表达。");
  await journeyRuntime.service.navigateTo("reflection");
  const originalGenerated = journeyRuntime.service.getSnapshot()?.communicationCard.pace?.generatedText;
  let view = await openRoute(<ReflectionRoute />, journeyRuntime);

  fireEvent.press(screen.getByTestId("journey-back"));
  await waitFor(() => {
    expect(journeyRuntime.service.getSnapshot()?.currentPage).toBe("behavior-attitudes");
    expect(mockRouter.replace).toHaveBeenCalledWith("/journey/behavior-attitudes");
  });
  view.unmount();

  view = await openRoute(<BehaviorAttitudesRoute />, journeyRuntime);
  fireEvent.press(screen.getAllByText("这次不要")[0]!);

  await waitFor(() => expect(journeyRuntime.service.getSnapshot()?.behaviorAttitudes["draft-kissing"])
    .toBe("not-this-time"));
  expect(journeyRuntime.service.getSnapshot()?.communicationCard.pace).toMatchObject({
    userText: "请保留我的节奏表达。",
    needsReview: true
  });
  expect(journeyRuntime.service.getSnapshot()?.communicationCard.pace?.generatedText)
    .not.toBe(originalGenerated);

  fireEvent.press(screen.getByText("继续"));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/journey/reflection"));
  view.unmount();
});
