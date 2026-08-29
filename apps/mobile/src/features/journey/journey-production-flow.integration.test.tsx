import { fireEvent, render, screen, waitFor, within, type RenderAPI } from "@testing-library/react-native";
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

async function unlockAllSixPages(journeyRuntime: JourneyRuntime) {
  await journeyRuntime.service.confirmAdult();
  await journeyRuntime.service.dispatch({ type: "set-address-preference", preference: "你" });
  await journeyRuntime.service.dispatch({ type: "set-preface-read", read: true });
  for (const cardId of [
    "draft-knowledge-body-signals",
    "draft-knowledge-consent",
    "draft-knowledge-health"
  ]) {
    await journeyRuntime.controller.readKnowledge(cardId);
  }
  await journeyRuntime.controller.saveOvernight({
    expectationIds: [],
    concernIds: [],
    customNote: ""
  });
  for (const behaviorId of [
    "behavior-hug",
    "draft-kissing",
    "behavior-same-bed",
    "behavior-my-nudity",
    "behavior-partner-nudity",
    "behavior-over-clothes-touch",
    "behavior-direct-touch"
  ]) {
    await journeyRuntime.controller.setBehaviorAttitude(behaviorId, "skip");
  }
  await journeyRuntime.controller.setExplicitContentConsent(false);
  await journeyRuntime.controller.saveReflection({
    motivationIds: [],
    comfortNeedIds: [],
    journalSaveChoice: "not-saved",
    journalText: ""
  });
  await journeyRuntime.controller.completePractice({
    behaviorId: null,
    intent: "pause-to-feel",
    phrase: "先停一下，我需要一点时间。",
    aftercareId: "quiet",
    completed: true
  });
}

async function openRoute(element: ReactElement, journeyRuntime: JourneyRuntime): Promise<RenderAPI> {
  const view = render(
    <JourneyRuntimeProvider createRuntime={async () => journeyRuntime}>
      {element}
    </JourneyRuntimeProvider>
  );
  await waitFor(() => {
    expect(screen.queryByText("正在启动旅程运行时…")).toBeNull();
    expect(screen.queryByText("正在检查本机访问状态…")).toBeNull();
    expect(screen.queryByText("正在读取外观设置…")).toBeNull();
    expect(screen.queryByText("正在恢复本机旅程…")).toBeNull();
  });
  expect(screen.queryByText("Expo Go 演示模式，数据仅在本次打开期间暂存")).toBeNull();
  return view;
}

test("the production routes expose all six content pages offline", async () => {
  const originalFetch = globalThis.fetch;
  const offlineFetch = jest.fn(async () => { throw new Error("offline"); });
  globalThis.fetch = offlineFetch as typeof fetch;
  const journeyRuntime = runtime();
  let view: RenderAPI | undefined;

  try {
    view = await openRoute(<WelcomeRoute />, journeyRuntime);
    expect(screen.queryByTestId("progress-center")).toBeNull();
    view.unmount();

    await unlockAllSixPages(journeyRuntime);
    const screens: Array<[JourneyPageId, number, ReactElement]> = [
      ["body-knowledge", 1, <BodyKnowledgeRoute />],
      ["overnight", 2, <OvernightRoute />],
      ["behavior-map", 3, <BehaviorMapRoute />],
      ["reflection", 4, <ReflectionRoute />],
      ["preset-practice", 5, <PresetPracticeRoute />],
      ["final-preparation", 6, <FinalPreparationRoute />]
    ];

    for (const [pageId, pageNumber, route] of screens) {
      await journeyRuntime.service.navigateTo(pageId);
      view = await openRoute(route, journeyRuntime);
      expect(screen.getByTestId(`journey-page-${pageId}`)).toBeTruthy();
      expect(within(screen.getByTestId("progress-center")).getByText(`${pageNumber} / 6`)).toBeTruthy();
      expect(screen.queryByText(/8\s*\/\s*8|共\s*8\s*页/u)).toBeNull();
      expect(screen.getByRole("button", { name: "旅程选项" })).toBeTruthy();
      view.unmount();
      view = undefined;
    }

    expect(offlineFetch).not.toHaveBeenCalled();
  } finally {
    view?.unmount();
    globalThis.fetch = originalFetch;
  }
}, 15_000);

test("the production landing opens onboarding without creating an active draft", async () => {
  const journeyRuntime = runtime();
  const view = await openRoute(<WelcomeRoute />, journeyRuntime);

  fireEvent.press(screen.getByText("开启旅程"));

  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/journey/adult-gate"));
  expect(await journeyRuntime.drafts.loadActive()).toBeNull();
  view.unmount();
});

test("the production reflection screen omits the prior behavior-answer review card", async () => {
  const journeyRuntime = runtime();
  await unlockAllSixPages(journeyRuntime);
  await journeyRuntime.service.navigateTo("reflection");
  const view = await openRoute(<ReflectionRoute />, journeyRuntime);

  expect(screen.queryByText("这是你刚才留下的答案")).toBeNull();
  expect(screen.queryByRole("button", { name: /修改.*的答案/u })).toBeNull();
  expect(screen.getAllByText("尚未记录")).toHaveLength(5);
  view.unmount();
});

test("the production final screen saves retained sections before opening the private draft", async () => {
  const journeyRuntime = runtime();
  await unlockAllSixPages(journeyRuntime);
  await journeyRuntime.service.navigateTo("final-preparation");
  const view = await openRoute(<FinalPreparationRoute />, journeyRuntime);

  expect(screen.queryByText("保留在沟通草稿中")).toBeNull();
  expect(screen.queryByText("只给自己看的准备")).toBeNull();
  expect(screen.queryByText("逐段确认沟通内容")).toBeNull();
  expect(screen.queryByRole("button", { name: "复制已确认内容" })).toBeNull();
  expect(screen.queryByRole("button", { name: "保存为图片" })).toBeNull();
  fireEvent.press(screen.getAllByText("从草稿中删除")[0]!);
  fireEvent.press(screen.getByText("保存并查看我的沟通草稿"));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/cards/card:production-flow-journey"));
  const saved = await journeyRuntime.cards.load("card:production-flow-journey");
  expect(saved).toMatchObject({
    journeyId: "production-flow-journey"
  });
  expect(saved?.card["communication-night-expectations"].visibility).toBe("deleted");
  expect(Object.entries(saved?.card ?? {}).filter(([id]) => id !== "communication-night-expectations").every(([, { needsReview, visibility }]) => (
    needsReview === false && visibility === "pending"
  ))).toBe(true);
  view.unmount();
});
