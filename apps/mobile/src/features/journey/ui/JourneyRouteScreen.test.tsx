import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, BackHandler, Text } from "react-native";

import { createJourneyDraft, type JourneyDraft, type JourneyPageId } from "../domain/types";
import { JourneyAction } from "./components/JourneyAction";
import { JourneyRouteScreen } from "./JourneyRouteScreen";
import { useJourneyStepBack } from "./journey-step-back";

const mockReplace = jest.fn();
const mockRuntime = {
  snapshot: null as JourneyDraft | null,
  service: {
    getSnapshot: jest.fn<JourneyDraft | null, []>(() => null),
    navigateTo: jest.fn<Promise<void>, [JourneyPageId]>(async () => undefined),
    resetJourney: jest.fn(async () => undefined)
  },
  controller: {},
  restart: jest.fn(async () => undefined),
  runAndRefresh: jest.fn(async <T,>(action: () => Promise<T>) => action())
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace })
}));

jest.mock("../runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => mockRuntime
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRuntime.snapshot = null;
  mockRuntime.service.getSnapshot.mockImplementation(() => mockRuntime.snapshot);
  mockRuntime.service.navigateTo.mockImplementation(async () => undefined);
  mockRuntime.runAndRefresh.mockImplementation(async <T,>(action: () => Promise<T>) => action());
  mockRuntime.restart.mockResolvedValue(undefined);
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createUnlockedDraft(currentPage: JourneyPageId): JourneyDraft {
  return {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    addressPreference: "你",
    prefaceRead: true,
    currentPage,
    overnight: { stage: "concerns", resumeStage: "concerns" },
    readKnowledgeCardIds: [
      "draft-knowledge-body-signals",
      "draft-knowledge-consent",
      "draft-knowledge-health"
    ],
    explicitContentConsent: false,
    behaviorAttitudes: {
      "behavior-hug": "skip",
      "draft-kissing": "skip",
      "behavior-same-bed": "skip",
      "behavior-my-nudity": "skip",
      "behavior-partner-nudity": "skip",
      "behavior-over-clothes-touch": "skip",
      "behavior-direct-touch": "skip"
    },
    journalSaveChoice: "not-saved",
    journal: { text: "", saveChoice: "not-saved" },
    practice: { completed: true, mirrorRehearsed: true },
    pointEventKeys: ["progress:overnight-complete:v1"]
  };
}

function createWelcomedDraft(currentPage: JourneyPageId = "body-knowledge"): JourneyDraft {
  return {
    ...createJourneyDraft({ id: "journey-demo", now: "now" }),
    ageConfirmed: true,
    addressPreference: "你",
    prefaceRead: true,
    currentPage,
  };
}

function RegisteredStep({ active = true, disabled = false }: { active?: boolean; disabled?: boolean }) {
  useJourneyStepBack({
    active,
    disabled,
    onBack: internalStepBack,
  });
  return <Text>registered-step</Text>;
}

const internalStepBack = jest.fn();

test("prefers the registered internal step over the previous journey page", async () => {
  mockRuntime.snapshot = createUnlockedDraft("reflection");
  render(
    <JourneyRouteScreen pageId="reflection">
      {() => <RegisteredStep />}
    </JourneyRouteScreen>,
  );

  fireEvent.press(await screen.findByRole("button", { name: "返回上一步" }));

  expect(internalStepBack).toHaveBeenCalledTimes(1);
  expect(mockRuntime.service.navigateTo).not.toHaveBeenCalled();
});

test("keeps a registered internal step from falling through while it is disabled", async () => {
  mockRuntime.snapshot = createUnlockedDraft("reflection");
  render(
    <JourneyRouteScreen pageId="reflection">
      {() => <RegisteredStep disabled />}
    </JourneyRouteScreen>,
  );

  const back = await screen.findByRole("button", { name: "返回上一步" });
  expect(back).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  fireEvent.press(back);

  expect(internalStepBack).not.toHaveBeenCalled();
  expect(mockRuntime.service.navigateTo).not.toHaveBeenCalled();
});

test("locks route back while a page-level operation is busy without an internal step", async () => {
  mockRuntime.snapshot = createUnlockedDraft("reflection");
  render(
    <JourneyRouteScreen pageId="reflection">
      {() => <RegisteredStep active={false} disabled />}
    </JourneyRouteScreen>,
  );

  const back = await screen.findByRole("button", { name: "返回上一步" });
  expect(back).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  fireEvent.press(back);

  expect(mockRuntime.service.navigateTo).not.toHaveBeenCalled();
});

test("consumes system back at the first formal journey page without leaving it", () => {
  const subscriptions: Array<() => boolean | null | undefined> = [];
  const addEventListener = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, listener) => {
    subscriptions.push(listener);
    return { remove: jest.fn() };
  });
  mockRuntime.snapshot = createWelcomedDraft();
  render(
    <JourneyRouteScreen pageId="body-knowledge">
      {() => <Text>body-knowledge</Text>}
    </JourneyRouteScreen>,
  );

  act(() => { subscriptions.at(-1)?.(); });

  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockRuntime.service.navigateTo).not.toHaveBeenCalled();
  addEventListener.mockRestore();
});

test("redirects an unconfirmed visitor before rendering an adult-only page", async () => {
  render(
    <JourneyRouteScreen pageId="overnight">
      {() => <Text>protected-form</Text>}
    </JourneyRouteScreen>
  );

  expect(screen.queryByText("protected-form")).toBeNull();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/journey/welcome"));
});

test("renders active snapshot state and persists back navigation before replacing", async () => {
  mockRuntime.snapshot = createUnlockedDraft("reflection");

  render(
    <JourneyRouteScreen pageId="reflection">
      {({ snapshot }) => <Text>{snapshot?.id}</Text>}
    </JourneyRouteScreen>
  );

  expect(screen.getByText("journey-1")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "返回上一步" }));

  await waitFor(() => {
    expect(mockRuntime.service.navigateTo).toHaveBeenCalledWith("behavior-map");
    expect(mockReplace).toHaveBeenCalledWith("/journey/behavior-map");
  });
  expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(1);
});

test("opens journey options and exits to the four-tab home without deleting the active draft", async () => {
  mockRuntime.snapshot = createUnlockedDraft("reflection");

  render(
    <JourneyRouteScreen pageId="reflection">
      {({ snapshot }) => <Text>{snapshot?.id}</Text>}
    </JourneyRouteScreen>
  );

  fireEvent.press(screen.getByRole("button", { name: "旅程选项" }));
  expect(screen.getByRole("header", { name: "旅程选项" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "退出旅程" }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)"));
  expect(mockRuntime.service.resetJourney).not.toHaveBeenCalled();
  expect(mockRuntime.service.navigateTo).not.toHaveBeenCalled();
  expect(mockRuntime.runAndRefresh).not.toHaveBeenCalled();
  expect(mockRuntime.snapshot?.id).toBe("journey-1");
});

test("keeps route navigation unavailable while the page reports an unpersisted snapshot", () => {
  mockRuntime.snapshot = createUnlockedDraft("overnight");
  render(
    <JourneyRouteScreen navigationLocked pageId="overnight">
      {() => <Text>overnight-content</Text>}
    </JourneyRouteScreen>,
  );

  const back = screen.getByRole("button", { name: "返回上一步" });
  const exit = screen.getByRole("button", { name: "旅程选项" });
  expect(back).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  expect(exit).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  fireEvent.press(back);
  fireEvent.press(exit);
  expect(mockRuntime.runAndRefresh).not.toHaveBeenCalled();
  expect(screen.queryByRole("header", { name: "旅程选项" })).toBeNull();
});

test("replaces the options back action with five progress destinations", async () => {
  mockRuntime.snapshot = createWelcomedDraft();

  render(
    <JourneyRouteScreen pageId="body-knowledge">
      {() => <Text>body-knowledge</Text>}
    </JourneyRouteScreen>
  );

  fireEvent.press(screen.getByRole("button", { name: "旅程选项" }));
  expect(screen.getByRole("header", { name: "旅程进度" })).toBeTruthy();
  expect(screen.getByText("完成 18+ 成年确认、称呼和须知后，可以直接前往任意一页。跳过不会自动填写内容。")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "返回上一步" })).toBeNull();
  const destinations = [
    "1/5 身体与安全知识（当前页）",
    "2/5 过夜期待与在意",
    "3/5 行为地图与边界",
    "4/5 你随时可以改变主意",
    "5/5 我的沟通草稿",
  ];
  for (const label of destinations) {
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  }
  expect(screen.getByRole("button", { name: destinations[0]! })).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: true }),
  );

  fireEvent.press(screen.getByRole("button", { name: destinations[4]! }));
  await waitFor(() => {
    expect(mockRuntime.service.navigateTo).toHaveBeenCalledWith("final-preparation");
    expect(mockReplace).toHaveBeenCalledWith("/journey/final-preparation");
  });
});

test("keeps progress options open with a retryable generic error when persistence fails", async () => {
  mockRuntime.snapshot = createWelcomedDraft();
  mockRuntime.service.navigateTo
    .mockRejectedValueOnce(new Error("private database path"))
    .mockResolvedValueOnce(undefined);
  render(
    <JourneyRouteScreen pageId="body-knowledge">
      {() => <Text>body-knowledge</Text>}
    </JourneyRouteScreen>,
  );

  fireEvent.press(screen.getByRole("button", { name: "旅程选项" }));
  const target = screen.getByRole("button", { name: "5/5 我的沟通草稿" });
  fireEvent.press(target);
  fireEvent.press(target);

  expect(await screen.findByRole("alert")).toHaveTextContent("暂时无法切换旅程进度，请重试。");
  expect(screen.queryByText("private database path")).toBeNull();
  expect(mockRuntime.service.navigateTo).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalledWith("/journey/final-preparation");

  fireEvent.press(screen.getByRole("button", { name: "5/5 我的沟通草稿" }));
  await waitFor(() => expect(mockRuntime.service.navigateTo).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/journey/final-preparation"));
});

test("keeps an unresolved progress jump modal and suppresses late navigation after unmount", async () => {
  const pendingJump = deferred<void>();
  mockRuntime.snapshot = createWelcomedDraft();
  mockRuntime.service.navigateTo.mockReturnValueOnce(pendingJump.promise);
  const view = render(
    <JourneyRouteScreen pageId="body-knowledge">
      {() => <Text>body-knowledge</Text>}
    </JourneyRouteScreen>,
  );

  fireEvent.press(screen.getByRole("button", { name: "旅程选项" }));
  fireEvent.press(screen.getByRole("button", { name: "5/5 我的沟通草稿" }));

  expect(screen.queryByRole("button", { name: "关闭旅程选项" })).toBeNull();
  expect(screen.getByRole("button", { name: "5/5 我的沟通草稿" })).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ busy: true, disabled: true }),
  );
  view.unmount();
  await act(async () => pendingJump.resolve());

  expect(mockReplace).not.toHaveBeenCalledWith("/journey/final-preparation");
});

test("requires confirmation before restarting and hides a local deletion failure", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  mockRuntime.snapshot = createUnlockedDraft("reflection");
  mockRuntime.restart.mockRejectedValueOnce(new Error("private database failure"));
  render(
    <JourneyRouteScreen pageId="reflection">{() => <Text>reflection</Text>}</JourneyRouteScreen>,
  );

  fireEvent.press(screen.getByRole("button", { name: "旅程选项" }));
  fireEvent.press(screen.getByRole("button", { name: "重新开始" }));
  expect(mockRuntime.restart).not.toHaveBeenCalled();
  const destructive = alert.mock.calls[0]?.[2]?.find(({ style }) => style === "destructive");
  await act(async () => { destructive?.onPress?.(); });

  expect(await screen.findByText("重新开始失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private database failure")).toBeNull();
  expect(mockReplace).not.toHaveBeenCalledWith("/journey/welcome");
  alert.mockRestore();
});

test("does not replace the root with a late forward navigation after exit", async () => {
  const pendingForward = deferred<void>();
  mockRuntime.snapshot = createUnlockedDraft("overnight");
  mockRuntime.service.navigateTo.mockReturnValueOnce(pendingForward.promise);

  render(
    <JourneyRouteScreen pageId="overnight">
      {({ goTo }) => (
        <JourneyAction
          label="next-page"
          loadingLabel="正在继续…"
          onAction={() => goTo("behavior-map")}
          testID="next-page"
        />
      )}
    </JourneyRouteScreen>
  );

  fireEvent.press(screen.getByTestId("next-page"));
  fireEvent.press(screen.getByRole("button", { name: "旅程选项" }));
  fireEvent.press(screen.getByRole("button", { name: "退出旅程" }));
  await act(async () => pendingForward.resolve());

  expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  expect(mockReplace).not.toHaveBeenCalledWith("/journey/behavior-map");
  expect(mockRuntime.service.resetJourney).not.toHaveBeenCalled();
});

test("does not replace the route when a deferred back navigation resolves after unmount", async () => {
  const pendingBack = deferred<void>();
  mockRuntime.snapshot = createUnlockedDraft("reflection");
  mockRuntime.service.navigateTo.mockReturnValueOnce(pendingBack.promise);

  const view = render(
    <JourneyRouteScreen pageId="reflection">
      {() => <Text>reflection-content</Text>}
    </JourneyRouteScreen>
  );

  fireEvent.press(screen.getByRole("button", { name: "返回上一步" }));
  view.unmount();
  await act(async () => pendingBack.resolve());

  expect(mockReplace).not.toHaveBeenCalledWith("/journey/behavior-map");
});

test("keeps back navigation busy, blocks duplicates, and hides rejection details", async () => {
  const pendingBack = deferred<void>();
  mockRuntime.snapshot = createUnlockedDraft("reflection");
  mockRuntime.runAndRefresh.mockReturnValueOnce(pendingBack.promise);

  render(
    <JourneyRouteScreen pageId="reflection">
      {() => <Text>reflection-content</Text>}
    </JourneyRouteScreen>
  );

  const back = screen.getByRole("button", { name: "返回上一步" });
  fireEvent.press(back);
  fireEvent.press(back);

  expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(1);
  expect(screen.getByText("正在返回…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "正在返回…" }).props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );

  await act(async () => { pendingBack.reject(new Error("private back failure")); });
  expect(await screen.findByText("返回失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private back failure")).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "返回上一步" })).toBeTruthy());

  fireEvent.press(screen.getByRole("button", { name: "返回上一步" }));
  await waitFor(() => expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(2));
  expect(mockRuntime.service.navigateTo).toHaveBeenCalledWith("behavior-map");
});

test("keeps forward navigation busy, handles rejection safely, and retries", async () => {
  const pendingForward = deferred<void>();
  mockRuntime.snapshot = createUnlockedDraft("overnight");
  mockRuntime.runAndRefresh.mockReturnValueOnce(pendingForward.promise);

  render(
    <JourneyRouteScreen pageId="overnight">
      {({ goTo }) => (
        <JourneyAction
          errorMessage="继续失败，请重试。"
          label="next-page"
          loadingLabel="正在继续…"
          onAction={() => goTo("behavior-map")}
          testID="next-page"
        />
      )}
    </JourneyRouteScreen>
  );

  const next = screen.getByTestId("next-page");
  fireEvent.press(next);
  fireEvent.press(next);
  expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(1);
  expect(screen.getByText("正在继续…")).toBeTruthy();
  expect(screen.getByTestId("next-page").props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );

  await act(async () => { pendingForward.reject(new Error("private forward failure")); });
  expect(await screen.findByText("继续失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private forward failure")).toBeNull();

  fireEvent.press(screen.getByTestId("next-page"));
  await waitFor(() => {
    expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(2);
    expect(mockRuntime.service.navigateTo).toHaveBeenCalledWith("behavior-map");
    expect(mockReplace).toHaveBeenCalledWith("/journey/behavior-map");
  });
});
