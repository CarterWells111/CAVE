import { fireEvent, render, screen, waitFor, type RenderAPI } from "@testing-library/react-native";
import type { ReactElement } from "react";

import BehaviorAttitudesRoute from "../../../app/journey/behavior-attitudes";
import BodyKnowledgeRoute from "../../../app/journey/body-knowledge";
import ChecklistRoute from "../../../app/journey/checklist";
import CommunicationCardRoute from "../../../app/journey/communication-card";
import OvernightRoute from "../../../app/journey/overnight";
import PresetPracticeRoute from "../../../app/journey/preset-practice";
import ReflectionRoute from "../../../app/journey/reflection";
import WelcomeRoute from "../../../app/journey/welcome";
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

test("the production routes complete Page 1 through 8 offline with real snapshots and actions", async () => {
  const originalFetch = globalThis.fetch;
  const offlineFetch = jest.fn(async () => { throw new Error("offline"); });
  globalThis.fetch = offlineFetch as typeof fetch;
  const clipboard = { setStringAsync: jest.fn(async () => undefined) };
  const journeyRuntime = runtime(clipboard);
  let view: RenderAPI | undefined;

  try {
    view = await openRoute(<WelcomeRoute />, journeyRuntime);
    fireEvent.press(screen.getByText("阅读能力与局限短笺"));
    fireEvent.press(screen.getByText("我已满18岁"));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/journey/overnight"));
    expect(journeyRuntime.service.getSnapshot()).toMatchObject({ ageConfirmed: true, prefaceRead: true });
    view.unmount();

    view = await openRoute(<OvernightRoute />, journeyRuntime);
    fireEvent.press(screen.getByText("好好休息"));
    fireEvent.press(screen.getByText("担心被催促"));
    fireEvent.changeText(screen.getByPlaceholderText("可选补充"), "需要安静离开的空间");
    fireEvent.press(screen.getByText("继续"));
    await waitFor(() => expect(journeyRuntime.service.getSnapshot()?.currentPage).toBe("body-knowledge"));
    view.unmount();

    view = await openRoute(<BodyKnowledgeRoute />, journeyRuntime);
    fireEvent.press(screen.getByText("主动展开医学图示"));
    fireEvent.press(screen.getByText("标记已读：同意可以改变"));
    fireEvent.press(screen.getByText("继续"));
    await waitFor(() => expect(journeyRuntime.service.getSnapshot()?.currentPage).toBe("behavior-attitudes"));
    view.unmount();

    view = await openRoute(<BehaviorAttitudesRoute />, journeyRuntime);
    fireEvent.press(screen.getAllByText("不确定")[0]!);
    fireEvent.press(screen.getAllByText("不确定")[1]!);
    fireEvent.press(screen.getByText("继续"));
    await waitFor(() => expect(journeyRuntime.service.getSnapshot()?.currentPage).toBe("reflection"));
    view.unmount();

    view = await openRoute(<ReflectionRoute />, journeyRuntime);
    fireEvent.press(screen.getByText("想了解自己的感受"));
    fireEvent.press(screen.getByText("保有隐私"));
    fireEvent.press(screen.getByText("需要表达支持"));
    fireEvent.press(screen.getByText("完成反思"));
    await waitFor(() => expect(journeyRuntime.service.getSnapshot()?.currentPage).toBe("preset-practice"));
    view.unmount();

    view = await openRoute(<PresetPracticeRoute />, journeyRuntime);
    fireEvent.press(screen.getByText("插入式性行为"));
    fireEvent.press(screen.getByText("我想停下现在这件事。"));
    fireEvent.press(screen.getByText("草稿：练习再次清楚表达边界。"));
    fireEvent.changeText(screen.getByDisplayValue("我想停下现在这件事。"), "请先停下来。");
    fireEvent.press(screen.getByText("采用这句话"));
    await waitFor(() => expect(journeyRuntime.service.getSnapshot()?.currentPage).toBe("checklist"));
    expect(journeyRuntime.service.getSnapshot()?.practice).toMatchObject({
      behaviorId: "draft-penetrative-sex",
      intent: "stop-current-action",
      selectedPhraseId: "draft-phrase-stop-current",
      editedPhrase: "请先停下来。",
      partnerResponseBranch: "disappointed-follow-up"
    });
    view.unmount();

    view = await openRoute(<ChecklistRoute />, journeyRuntime);
    expect(screen.getByText("关于「插入式性行为」的态度")).toBeTruthy();
    expect(screen.getByText("健康准备：插入式性行为")).toBeTruthy();
    expect(screen.queryByText(/checklist:/u)).toBeNull();
    fireEvent.changeText(screen.getAllByPlaceholderText("补充说明（可选）")[0]!, "先说出暂停句");
    fireEvent.press(screen.getAllByText("已考虑")[0]!);
    fireEvent.press(screen.getByText("完成回顾"));
    await waitFor(() => expect(journeyRuntime.service.getSnapshot()?.currentPage).toBe("communication-card"));
    view.unmount();

    view = await openRoute(<CommunicationCardRoute />, journeyRuntime);
    const firstField = screen.getAllByDisplayValue(/draft-card/u)[0]!;
    fireEvent.changeText(firstField, "请继续前先问我。");
    await waitFor(() => expect(journeyRuntime.service.getSnapshot()?.communicationCard.intentions?.userText)
      .toBe("请继续前先问我。"));
    fireEvent.press(screen.getByText("本机保存"));
    await waitFor(async () => expect(await journeyRuntime.cards.list()).toHaveLength(1));
    fireEvent.press(screen.getByText("复制当前卡片"));
    await waitFor(() => expect(screen.getByText("已复制")).toBeTruthy());
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining("请继续前先问我。"));
    fireEvent.press(screen.getByText("现场展示"));
    expect(screen.getByText("暂停与确认表达保持可见")).toBeTruthy();

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

test("clipboard failure is structured and visible on the production Page 8 route", async () => {
  const clipboard = { setStringAsync: jest.fn(async () => { throw new Error("denied"); }) };
  const journeyRuntime = runtime(clipboard);
  await journeyRuntime.service.confirmAdult();
  await journeyRuntime.service.navigateTo("communication-card");
  const view = await openRoute(<CommunicationCardRoute />, journeyRuntime);

  fireEvent.press(screen.getByText("复制当前卡片"));

  expect(await screen.findByText("复制失败，请重试")).toBeTruthy();
  view.unmount();
});
