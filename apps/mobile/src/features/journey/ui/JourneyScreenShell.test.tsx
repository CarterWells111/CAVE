import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BackHandler, PanResponder, StyleSheet, Text } from "react-native";

import { darkTheme as theme } from "../../../core/design/theme";
import {
  JourneyScreenShell,
  shouldClaimJourneyBackGesture,
  shouldCompleteJourneyBackGesture,
} from "./JourneyScreenShell";

const onExit = jest.fn();

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("claims only a deliberate horizontal drag that starts at the left edge", () => {
  expect(shouldClaimJourneyBackGesture({ dx: 16, dy: 4, startX: 24 })).toBe(true);
  expect(shouldClaimJourneyBackGesture({ dx: 16, dy: 4, startX: 25 })).toBe(false);
  expect(shouldClaimJourneyBackGesture({ dx: -80, dy: 0, startX: 0 })).toBe(false);
  expect(shouldClaimJourneyBackGesture({ dx: 16, dy: 12, startX: 0 })).toBe(false);
});

test("completes only after the claimed edge drag travels far enough", () => {
  expect(shouldCompleteJourneyBackGesture({ dx: 64, dy: 8, startX: 0 })).toBe(true);
  expect(shouldCompleteJourneyBackGesture({ dx: 63, dy: 8, startX: 0 })).toBe(false);
  expect(shouldCompleteJourneyBackGesture({ dx: 90, dy: 70, startX: 0 })).toBe(false);
});

test("routes a completed left-edge gesture through the shared back action", () => {
  const onBack = jest.fn();
  const create = jest.spyOn(PanResponder, "create");
  render(<JourneyScreenShell pageId="overnight" onBack={onBack} onExit={onExit} />);

  const config = create.mock.calls.at(-1)?.[0];
  const gesture = { dx: 72, dy: 8, x0: 12 } as never;
  expect(config?.onMoveShouldSetPanResponderCapture?.({} as never, gesture)).toBe(true);
  act(() => { config?.onPanResponderRelease?.({} as never, gesture); });

  expect(onBack).toHaveBeenCalledTimes(1);
  create.mockRestore();
});

test("routes Android hardware back through the shared action and consumes the first-page boundary", () => {
  const subscriptions: Array<() => boolean | null | undefined> = [];
  const addEventListener = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, listener) => {
    subscriptions.push(listener);
    return { remove: jest.fn() };
  });
  const onBack = jest.fn();
  const laterPage = render(
    <JourneyScreenShell pageId="overnight" onBack={onBack} onExit={onExit} />,
  );

  let consumed = false;
  act(() => { consumed = subscriptions.at(-1)?.() === true; });
  expect(consumed).toBe(true);
  expect(onBack).toHaveBeenCalledTimes(1);
  laterPage.unmount();

  render(<JourneyScreenShell pageId="body-knowledge" onExit={onExit} />);
  act(() => { consumed = subscriptions.at(-1)?.() === true; });
  expect(consumed).toBe(true);
  expect(onBack).toHaveBeenCalledTimes(1);
  addEventListener.mockRestore();
});

test.each([
  ["body-knowledge", 1],
  ["overnight", 2],
  ["behavior-map", 3],
  ["reflection", 4],
  ["preset-practice", 5],
  ["final-preparation", 6]
] as const)("renders %s as step %i of the six-page journey", (pageId, pageNumber) => {
  render(<JourneyScreenShell pageId={pageId} onExit={onExit} />);

  expect(screen.getByTestId(`journey-page-${pageId}`)).toBeTruthy();
  expect(screen.getByText(`${pageNumber} / 6`)).toBeTruthy();
  expect(screen.queryByText(/准备度|readiness|score|percentage/iu)).toBeNull();
});

test("numbers the first knowledge page and exposes journey options", () => {
  render(<JourneyScreenShell pageId="body-knowledge" onExit={onExit} />);

  expect(screen.getByText("1 / 6")).toBeTruthy();
  expect(screen.getByRole("button", { name: "旅程选项" })).toBeTruthy();
});

test.each([
  ["behavior-map", "行为地图与边界"],
  ["final-preparation", "我的沟通草稿"]
] as const)("names the canonical %s screen without legacy page titles", (pageId, title) => {
  render(<JourneyScreenShell pageId={pageId} onExit={onExit} />);

  expect(screen.getByRole("header", { name: title })).toBeTruthy();
  expect(screen.queryByText(/行前检查清单|沟通卡片/u)).toBeNull();
});

test("composes the shared 06A screen, card, progress and status primitives", () => {
  const source = readFileSync(join(__dirname, "JourneyScreenShell.tsx"), "utf8");

  expect(source).toContain('from "./guided-scroll-screen"');
  expect(source).toContain("<JourneyGuidedScrollScreen");
  expect(source).toContain('from "../../../core/ui/Card"');
  expect(source).toContain('from "../../../core/ui/ProgressHeader"');
  expect(source).toContain('from "../../../core/ui/StatusBanner"');
  expect(source).toContain('from "../../../core/design/theme-provider"');
  expect(source).toContain("useTheme()");
  expect(source).not.toContain("journey-ui-tokens");
  expect(source).not.toContain("SafeAreaView");
  expect(source).not.toContain("Platform.OS");
  expect(source).not.toContain("<ScrollView");
  expect(source).not.toContain("<Screen");
});

test("keeps one keyboard-aware vertical screen scroll for long content on small screens", () => {
  render(
    <JourneyScreenShell pageId="overnight" onBack={jest.fn()} onExit={onExit}>
      {Array.from({ length: 40 }, (_, index) => (
        <Text key={index}>{`long-content-${index}`}</Text>
      ))}
    </JourneyScreenShell>
  );

  expect(screen.getByTestId("journey-keyboard-avoiding")).toBeTruthy();
  expect(screen.getAllByTestId("journey-scroll")).toHaveLength(1);
  const scroll = screen.getByTestId("journey-scroll");
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(scroll.props.horizontal).toBe(false);
  expect(scroll.props.keyboardDismissMode).toBe("interactive");
  expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  expect(StyleSheet.flatten(screen.getByTestId("journey-scroll").props.contentContainerStyle)).toEqual(
    expect.objectContaining({
      flexGrow: 1,
      maxWidth: theme.size.readableContentMax,
      width: "100%"
    })
  );
  expect(screen.getByText("long-content-39")).toBeTruthy();
});

test("keeps the page title and header actions flexible for large text", () => {
  render(<JourneyScreenShell pageId="overnight" onBack={jest.fn()} onExit={onExit} />);

  const title = screen.getByRole("header", { name: "过夜期待与在意" });
  expect(title.props.numberOfLines).toBeUndefined();
  expect(title.props.ellipsizeMode).toBeUndefined();

  for (const label of ["返回上一步", "旅程选项"]) {
    const action = screen.getByRole("button", { name: label });
    const actionLabel = screen.getByText(label);
    expect(action).toHaveStyle({ minHeight: 44, minWidth: 44 });
    expect(actionLabel.props.numberOfLines).toBeUndefined();
    expect(actionLabel.props.ellipsizeMode).toBeUndefined();
  }
});

test("exposes working back and options actions on later pages", () => {
  const onBack = jest.fn();
  render(<JourneyScreenShell pageId="overnight" onBack={onBack} onExit={onExit} />);

  fireEvent.press(screen.getByRole("button", { name: "返回上一步" }));
  fireEvent.press(screen.getByRole("button", { name: "旅程选项" }));

  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onExit).toHaveBeenCalledTimes(1);
});

test("blocks every header navigation action while page persistence is locked", () => {
  const onBack = jest.fn();
  const onLockedExit = jest.fn();
  render(
    <JourneyScreenShell
      navigationLocked
      pageId="overnight"
      onBack={onBack}
      onExit={onLockedExit}
    />,
  );

  const back = screen.getByRole("button", { name: "返回上一步" });
  const exit = screen.getByRole("button", { name: "旅程选项" });
  expect(back).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  expect(exit).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  fireEvent.press(back);
  fireEvent.press(exit);
  expect(onBack).not.toHaveBeenCalled();
  expect(onLockedExit).not.toHaveBeenCalled();
});

test("renders the page title in a shared surface card", () => {
  render(<JourneyScreenShell pageId="reflection" onBack={jest.fn()} onExit={onExit} />);

  const titleCardStyle = StyleSheet.flatten(screen.getByTestId("journey-title-card").props.style);
  expect(titleCardStyle).toEqual(expect.objectContaining({
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border
  }));
});

test("keeps a runtime-injected notice as one accessible status with its custom label", () => {
  render(
    <JourneyScreenShell
      pageId="body-knowledge"
      onExit={onExit}
      runtimeNotice={{
        accessibilityLabel: "当前为 Expo Go 演示模式",
        message: "Expo Go 演示模式"
      }}
    />
  );

  expect(screen.getByText("Expo Go 演示模式")).toBeTruthy();
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status").props.accessibilityLabel).toBe("当前为 Expo Go 演示模式");
});

test.each(["resolve", "reject"] as const)(
  "ignores an old page back %s without releasing the current page operation",
  async (oldSettlement) => {
    const oldBack = deferred<void>();
    const currentBack = deferred<void>();
    const onOldBack = jest.fn(() => oldBack.promise);
    const onCurrentBack = jest.fn(() => currentBack.promise);
    const view = render(
      <JourneyScreenShell pageId="behavior-map" onBack={onOldBack} onExit={onExit} />
    );

    fireEvent.press(screen.getByRole("button", { name: "返回上一步" }));
    view.rerender(
      <JourneyScreenShell pageId="overnight" onBack={onCurrentBack} onExit={onExit} />
    );
    fireEvent.press(screen.getByRole("button", { name: "返回上一步" }));

    await act(async () => {
      if (oldSettlement === "resolve") oldBack.resolve();
      else oldBack.reject(new Error("obsolete back failure must stay hidden"));
      await oldBack.promise.catch(() => undefined);
    });

    expect(screen.queryByText("返回失败，请重试。")).toBeNull();
    expect(
      screen.getByRole("button", { name: "正在返回…" }).props.accessibilityState
    ).toEqual(expect.objectContaining({ busy: true, disabled: true }));
    fireEvent.press(screen.getByRole("button", { name: "正在返回…" }));
    expect(onCurrentBack).toHaveBeenCalledTimes(1);

    await act(async () => {
      currentBack.resolve();
      await currentBack.promise;
    });

    expect(
      screen.getByRole("button", { name: "返回上一步" }).props.accessibilityState
    ).toEqual(expect.objectContaining({ busy: false, disabled: false }));
  }
);

test.each(["resolve", "reject"] as const)(
  "invalidates a pending back operation when the shell unmounts before %s",
  async (settlement) => {
    const pendingBack = deferred<void>();
    const onBack = jest.fn(() => pendingBack.promise);
    const view = render(
      <JourneyScreenShell pageId="overnight" onBack={onBack} onExit={onExit} />
    );

    fireEvent.press(screen.getByRole("button", { name: "返回上一步" }));
    view.unmount();

    await act(async () => {
      if (settlement === "resolve") pendingBack.resolve();
      else pendingBack.reject(new Error("obsolete unmounted back failure"));
      await pendingBack.promise.catch(() => undefined);
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  }
);

test("keeps one safe back error status and allows retry without exposing the raw error", async () => {
  const failedBack = deferred<void>();
  const retriedBack = deferred<void>();
  const onBack = jest.fn()
    .mockReturnValueOnce(failedBack.promise)
    .mockReturnValueOnce(retriedBack.promise);
  render(<JourneyScreenShell pageId="overnight" onBack={onBack} onExit={onExit} />);

  fireEvent.press(screen.getByRole("button", { name: "返回上一步" }));
  await act(async () => {
    failedBack.reject(new Error("private storage internals"));
    await failedBack.promise.catch(() => undefined);
  });

  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByText("返回失败，请重试。")).toBeTruthy();
  expect(screen.queryByText(/private storage internals/iu)).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "返回上一步" }));
  expect(onBack).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("返回失败，请重试。")).toBeNull();
  expect(
    screen.getByRole("button", { name: "正在返回…" }).props.accessibilityState
  ).toEqual(expect.objectContaining({ busy: true, disabled: true }));

  await act(async () => {
    retriedBack.resolve();
    await retriedBack.promise;
  });

  expect(screen.getByRole("button", { name: "返回上一步" })).toBeTruthy();
  expect(screen.queryAllByRole("alert")).toHaveLength(0);
});
