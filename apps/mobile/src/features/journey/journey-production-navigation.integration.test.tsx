import { act, fireEvent, render, screen, waitFor, type RenderAPI } from "@testing-library/react-native";
import type { ReactElement } from "react";

import AdultGateRoute from "../../../app/journey/adult-gate";
import PrefaceRoute from "../../../app/journey/preface";
import WelcomeRoute from "../../../app/journey/welcome";
import { createJourneyDraft } from "./domain/types";
import {
  InMemoryCommunicationCardRepository,
  InMemoryJourneyDraftRepository,
} from "./infrastructure/in-memory-journey-repositories";
import { composeJourneyRuntime, type JourneyRuntime } from "./runtime/journey-runtime";
import { JourneyRuntimeProvider } from "./runtime/JourneyRuntimeProvider";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

function runtime() {
  return composeJourneyRuntime({
    mode: "expo-go-demo",
    persistence: "memory-only",
    drafts: new InMemoryJourneyDraftRepository(),
    cards: new InMemoryCommunicationCardRepository(),
    clipboard: { setStringAsync: jest.fn(async () => undefined) },
    createId: () => "production-navigation-journey",
    now: () => "2026-08-28T12:00:00.000Z",
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function openRoute(element: ReactElement, journeyRuntime: JourneyRuntime): Promise<RenderAPI> {
  const view = render(
    <JourneyRuntimeProvider createRuntime={async () => journeyRuntime}>{element}</JourneyRuntimeProvider>,
  );
  expect(await screen.findByText("Expo Go 演示模式，数据仅在本次打开期间暂存")).toBeTruthy();
  return view;
}

beforeEach(() => jest.clearAllMocks());

test("landing has one start action and routes to the adult declaration", async () => {
  const journeyRuntime = runtime();
  const view = await openRoute(<WelcomeRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("button", { name: "开启旅程" }));
  expect(mockRouter.push).toHaveBeenCalledWith("/journey/adult-gate");
  expect(journeyRuntime.service.getSnapshot()).toBeNull();
  view.unmount();
});

test("an undeclared legacy draft still starts at the adult declaration", async () => {
  const journeyRuntime = runtime();
  await journeyRuntime.drafts.saveActive({
    ...createJourneyDraft({ id: "undeclared", now: "2026-08-28T10:00:00.000Z" }),
    addressPreference: "你",
    prefaceRead: true,
    currentPage: "reflection",
  });
  const view = await openRoute(<WelcomeRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("button", { name: "开启旅程" }));

  expect(mockRouter.push).toHaveBeenCalledWith("/journey/adult-gate");
  expect(mockRouter.replace).not.toHaveBeenCalled();
  view.unmount();
});

test.each([
  { addressPreference: null, prefaceRead: true, label: "missing address preference" },
  { addressPreference: "妳" as const, prefaceRead: false, label: "unread preface" },
])("a confirmed draft with $label continues to the preface", async ({ addressPreference, prefaceRead }) => {
  const journeyRuntime = runtime();
  await journeyRuntime.drafts.saveActive({
    ...createJourneyDraft({ id: "onboarding", now: "2026-08-28T10:00:00.000Z" }),
    addressPreference,
    ageConfirmed: true,
    prefaceRead,
  });
  const view = await openRoute(<WelcomeRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("button", { name: "继续旅程" }));

  expect(mockRouter.replace).toHaveBeenCalledWith("/journey/preface");
  view.unmount();
});

test("a confirmed draft with completed onboarding resumes its formal page", async () => {
  const journeyRuntime = runtime();
  await journeyRuntime.drafts.saveActive({
    ...createJourneyDraft({ id: "resumable", now: "2026-08-28T10:00:00.000Z" }),
    addressPreference: "妳",
    ageConfirmed: true,
    prefaceRead: true,
  });
  const view = await openRoute(<WelcomeRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("button", { name: "继续旅程" }));

  expect(mockRouter.replace).toHaveBeenCalledWith("/journey/body-knowledge");
  view.unmount();
});

test("preface cannot be opened before the local adult declaration", async () => {
  const journeyRuntime = runtime();
  const view = await openRoute(<PrefaceRoute />, journeyRuntime);

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/journey/welcome"));
  expect(screen.queryByText("开始前，想告诉你")).toBeNull();
  expect(journeyRuntime.service.getSnapshot()).toBeNull();
  view.unmount();
});

test("adult declaration creates the local journey and opens the preface", async () => {
  const journeyRuntime = runtime();
  const view = await openRoute(<AdultGateRoute />, journeyRuntime);

  expect(screen.queryByText(/验证码|登录/u)).toBeNull();
  expect(screen.getByText(/不收集.*邮箱/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));

  await waitFor(() => expect(journeyRuntime.service.getSnapshot()).toMatchObject({
    ageConfirmed: true,
    prefaceRead: false,
    currentPage: "body-knowledge",
  }));
  expect(mockRouter.replace).toHaveBeenCalledWith("/journey/preface");
  view.unmount();
});

test("adult declaration publishes the confirmed snapshot before the preface renders", async () => {
  const journeyRuntime = runtime();
  const createRuntime = async () => journeyRuntime;
  const view = render(
    <JourneyRuntimeProvider createRuntime={createRuntime}>
      <AdultGateRoute />
    </JourneyRuntimeProvider>,
  );
  expect(await screen.findByText("Expo Go 演示模式，数据仅在本次打开期间暂存")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/journey/preface"));
  mockRouter.replace.mockClear();

  view.rerender(
    <JourneyRuntimeProvider createRuntime={createRuntime}>
      <PrefaceRoute />
    </JourneyRuntimeProvider>,
  );

  expect(await screen.findByText("开始前，想告诉你")).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalledWith("/journey/welcome");
  view.unmount();
});

test("adult confirmation blocks the underage decision and only opens the preface when persistence finishes", async () => {
  const journeyRuntime = runtime();
  const savingDeclaration = deferred<void>();
  const saveActive = journeyRuntime.drafts.saveActive.bind(journeyRuntime.drafts);
  jest.spyOn(journeyRuntime.drafts, "saveActive").mockImplementation(async (draft) => {
    await savingDeclaration.promise;
    await saveActive(draft);
  });
  const view = await openRoute(<AdultGateRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));
  await waitFor(() => expect(journeyRuntime.drafts.saveActive).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole("button", { name: "我未满 18 岁" }));

  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(journeyRuntime.service.getSnapshot()).toBeNull();

  await act(async () => savingDeclaration.resolve());
  await waitFor(() => expect(journeyRuntime.service.getSnapshot()).toMatchObject({ ageConfirmed: true }));
  expect(mockRouter.replace.mock.calls).toEqual([["/journey/preface"]]);
  view.unmount();
});

test("adult confirmation can retry after persistence fails", async () => {
  const journeyRuntime = runtime();
  const saveActive = journeyRuntime.drafts.saveActive.bind(journeyRuntime.drafts);
  jest.spyOn(journeyRuntime.drafts, "saveActive")
    .mockRejectedValueOnce(new Error("private persistence failure"))
    .mockImplementation(saveActive);
  const view = await openRoute(<AdultGateRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));

  expect(await screen.findByText("确认暂时无法保存，请重试。")).toBeTruthy();
  expect(screen.queryByText("private persistence failure")).toBeNull();
  expect(journeyRuntime.service.getSnapshot()).toBeNull();
  expect(mockRouter.replace).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));
  await waitFor(() => expect(journeyRuntime.service.getSnapshot()).toMatchObject({ ageConfirmed: true }));
  expect(mockRouter.replace.mock.calls).toEqual([["/journey/preface"]]);
  view.unmount();
});

test("a failed adult declaration marker cannot navigate on the published service snapshot and can retry", async () => {
  const journeyRuntime = runtime();
  jest.spyOn(journeyRuntime.adultDeclaration, "recordAdultDeclaration")
    .mockRejectedValueOnce(new Error("adult declaration marker failure"))
    .mockResolvedValue(undefined);
  const view = await openRoute(<AdultGateRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));

  expect(await screen.findByText("确认暂时无法保存，请重试。")).toBeTruthy();
  expect(journeyRuntime.service.getSnapshot()).toMatchObject({ ageConfirmed: true });
  expect(mockRouter.replace).not.toHaveBeenCalledWith("/journey/preface");

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));
  await waitFor(() => expect(mockRouter.replace.mock.calls).toEqual([["/journey/preface"]]));
  view.unmount();
});

test("a pending adult confirmation does not navigate after the route unmounts", async () => {
  const journeyRuntime = runtime();
  const savingDeclaration = deferred<void>();
  const saveActive = journeyRuntime.drafts.saveActive.bind(journeyRuntime.drafts);
  jest.spyOn(journeyRuntime.drafts, "saveActive").mockImplementation(async (draft) => {
    await savingDeclaration.promise;
    await saveActive(draft);
  });
  const view = await openRoute(<AdultGateRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));
  await waitFor(() => expect(journeyRuntime.drafts.saveActive).toHaveBeenCalledTimes(1));
  view.unmount();

  await act(async () => savingDeclaration.resolve());

  expect(journeyRuntime.service.getSnapshot()).toMatchObject({ ageConfirmed: true });
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

test("underage action opens the blocking route without writing a declaration", async () => {
  const journeyRuntime = runtime();
  const view = await openRoute(<AdultGateRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("button", { name: "我未满 18 岁" }));

  expect(mockRouter.replace).toHaveBeenCalledWith("/underage-exit");
  expect(journeyRuntime.service.getSnapshot()).toBeNull();
  view.unmount();
});

test("preface persists the chosen address after the adult declaration", async () => {
  const journeyRuntime = runtime();
  await journeyRuntime.service.confirmAdult();
  const originalId = journeyRuntime.service.getSnapshot()?.id;
  const view = await openRoute(<PrefaceRoute />, journeyRuntime);

  fireEvent.press(screen.getByRole("radio", { name: "妳｜明确称呼女性，更有书信感。" }));
  fireEvent.press(screen.getByRole("button", { name: "这样称呼我" }));

  await waitFor(() => expect(journeyRuntime.service.getSnapshot()).toMatchObject({
    id: originalId,
    addressPreference: "妳",
    ageConfirmed: true,
    prefaceRead: true,
    currentPage: "body-knowledge",
  }));
  expect(mockRouter.replace).toHaveBeenCalledWith("/journey/body-knowledge");
  view.unmount();
});

test("an already confirmed declaration skips forward to the preface", async () => {
  const journeyRuntime = runtime();
  await journeyRuntime.service.confirmAdult();
  const view = await openRoute(<AdultGateRoute />, journeyRuntime);

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/journey/preface"));
  expect(screen.queryByText("仅限已满 18 岁者")).toBeNull();
  view.unmount();
});
