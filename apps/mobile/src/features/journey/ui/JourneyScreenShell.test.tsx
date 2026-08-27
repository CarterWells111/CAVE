import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StyleSheet, Text } from "react-native";

import { brand } from "../../../config/brand";
import { theme } from "../../../core/design/theme";
import { JourneyScreenShell } from "./JourneyScreenShell";

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

test.each([
  ["welcome", 1],
  ["overnight", 2],
  ["body-knowledge", 3],
  ["behavior-attitudes", 4],
  ["reflection", 5],
  ["preset-practice", 6],
  ["checklist", 7],
  ["communication-card", 8]
] as const)("renders %s as page %i without readiness language", (pageId, pageNumber) => {
  render(<JourneyScreenShell pageId={pageId} onExit={onExit} />);

  expect(screen.getByTestId(`journey-page-${pageId}`)).toBeTruthy();
  expect(screen.getByText(`第 ${pageNumber} 页，共 8 页`)).toBeTruthy();
  expect(screen.queryByText(/准备度|readiness|score|percentage/iu)).toBeNull();
});

test("composes the shared 06A screen, card, progress and status primitives", () => {
  const source = readFileSync(join(__dirname, "JourneyScreenShell.tsx"), "utf8");

  expect(source).toContain('from "../../../core/ui/Screen"');
  expect(source).toContain('from "../../../core/ui/Card"');
  expect(source).toContain('from "../../../core/ui/ProgressHeader"');
  expect(source).toContain('from "../../../core/ui/StatusBanner"');
  expect(source).toContain('from "../../../core/design/theme"');
  expect(source).toContain('from "../../../config/brand"');
  expect(source).not.toContain("journey-ui-tokens");
  expect(source).not.toContain("SafeAreaView");
  expect(source).not.toContain("Platform.OS");
  expect(source).not.toContain("<ScrollView");
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

  for (const label of ["返回上一页", "退出旅程"]) {
    const action = screen.getByRole("button", { name: label });
    const actionLabel = screen.getByText(label);
    expect(action).toHaveStyle({ minHeight: 44, minWidth: 44 });
    expect(actionLabel.props.numberOfLines).toBeUndefined();
    expect(actionLabel.props.ellipsizeMode).toBeUndefined();
  }
});

test("uses the canonical brand in the welcome title and keeps symmetric header slots", () => {
  render(<JourneyScreenShell pageId="welcome" onExit={onExit} />);

  expect(screen.getByRole("header", { name: `欢迎来到${brand.displayName}` })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "返回上一页" })).toBeNull();
  expect(screen.getByRole("button", { name: "退出旅程" })).toBeTruthy();
  expect(screen.getByTestId("progress-leading-slot")).toHaveStyle({ flex: 1 });
  expect(screen.getByTestId("progress-trailing-slot")).toHaveStyle({ flex: 1 });
});

test("exposes working back and exit actions on later pages", () => {
  const onBack = jest.fn();
  render(<JourneyScreenShell pageId="overnight" onBack={onBack} onExit={onExit} />);

  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  fireEvent.press(screen.getByRole("button", { name: "退出旅程" }));

  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onExit).toHaveBeenCalledTimes(1);
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
      pageId="welcome"
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
      <JourneyScreenShell pageId="overnight" onBack={onOldBack} onExit={onExit} />
    );

    fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
    view.rerender(
      <JourneyScreenShell pageId="body-knowledge" onBack={onCurrentBack} onExit={onExit} />
    );
    fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));

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
      screen.getByRole("button", { name: "返回上一页" }).props.accessibilityState
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

    fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
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

  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  await act(async () => {
    failedBack.reject(new Error("private storage internals"));
    await failedBack.promise.catch(() => undefined);
  });

  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByText("返回失败，请重试。")).toBeTruthy();
  expect(screen.queryByText(/private storage internals/iu)).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  expect(onBack).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("返回失败，请重试。")).toBeNull();
  expect(
    screen.getByRole("button", { name: "正在返回…" }).props.accessibilityState
  ).toEqual(expect.objectContaining({ busy: true, disabled: true }));

  await act(async () => {
    retriedBack.resolve();
    await retriedBack.promise;
  });

  expect(screen.getByRole("button", { name: "返回上一页" })).toBeTruthy();
  expect(screen.queryAllByRole("alert")).toHaveLength(0);
});
