import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Button } from "../../../../core/ui/Button";
import { darkTheme as theme } from "../../../../core/design/theme";
import type { JourneyAsyncState } from "../journey-ui-contracts";
import { JourneyAction } from "./JourneyAction";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

test("composes the core Button with semantic theme styles", () => {
  const { UNSAFE_getByType } = render(
    <JourneyAction label="继续" loadingLabel="正在继续…" onAction={jest.fn()} />
  );

  const primitive = UNSAFE_getByType(Button);
  const action = screen.getByRole("button", { name: "继续" });
  const source = readFileSync(join(__dirname, "JourneyAction.tsx"), "utf8");

  expect(primitive.props).toEqual(expect.objectContaining({ label: "继续", loading: false }));
  expect(action).toHaveStyle({
    borderWidth: theme.border.width,
    minWidth: theme.size.minimumTouchTarget
  });
  expect(StyleSheet.flatten(action.props.style).minHeight).toBeGreaterThanOrEqual(
    theme.size.minimumTouchTarget
  );
  expect(source).not.toContain("journey-ui-tokens");
  expect(source).not.toMatch(/journeyColors|journeyRadii|journeySizes|journeySpacing/u);
});

test("keeps a non-color pressed signal from the core Button", () => {
  render(<JourneyAction label="继续" loadingLabel="正在继续…" onAction={jest.fn()} />);
  const action = screen.getByRole("button", { name: "继续" });
  const defaultOpacity = action.props.style.opacity;

  fireEvent(action, "responderGrant", { nativeEvent: {}, persist: jest.fn() });

  expect(action.props.style.opacity).not.toBe(defaultOpacity);
});

test("maps selected role and caller state while keeping a visible non-color marker", () => {
  const { UNSAFE_getByType, UNSAFE_root } = render(
    <JourneyAction
      accessibilityLabel="选择继续"
      label="继续"
      loadingLabel="正在继续…"
      onAction={jest.fn()}
      role="radio"
      selected
      state={{ expanded: true }}
      testID="selected-action"
    />
  );

  const interactionNodes = UNSAFE_root.findAll(
    (node) => node.props.accessibilityRole !== undefined && typeof node.props.onPress === "function"
  );
  expect(interactionNodes).toHaveLength(1);
  expect(UNSAFE_getByType(Button).props).toEqual(
    expect.objectContaining({
      accessibilityLabel: "选择继续",
      role: "radio",
      selected: true,
      state: { expanded: true },
      testID: "selected-action"
    })
  );
  const action = screen.getByRole("radio", { name: "选择继续" });
  expect(action).toHaveProp(
    "accessibilityState",
    expect.objectContaining({
      busy: false,
      checked: true,
      disabled: false,
      expanded: true,
      selected: true
    })
  );
  fireEvent(action, "focus");
  expect(action.props.style.outlineColor).toBe(theme.color.focus);
  expect(action.props.style.outlineWidth).toBe(theme.border.focusWidth);
  expect(screen.getByText("✓ 已选中")).toBeTruthy();
});

test("uses a generic safe error without exposing a rejected promise", async () => {
  render(
    <JourneyAction
      label="保存"
      loadingLabel="正在保存…"
      onAction={async () => {
        throw new Error("private raw failure");
      }}
    />
  );

  fireEvent.press(screen.getByRole("button", { name: "保存" }));

  expect(await screen.findByText("操作失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private raw failure")).toBeNull();
});

test("keeps the core loading treatment while exposing busy and disabled semantics", () => {
  const { UNSAFE_getByType } = render(
    <JourneyAction
      actionState={{ status: "loading" }}
      label="保存"
      loadingLabel="正在保存…"
      onAction={jest.fn()}
    />
  );

  expect(UNSAFE_getByType(Button).props).toEqual(
    expect.objectContaining({ disabled: false, loading: true })
  );
  const action = screen.getByRole("button", { name: "正在保存…" });
  expect(action).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ busy: true, disabled: true })
  );
  expect(action.props.style.opacity).toBe(1);
});

test("prioritizes external loading over a previous internal error", async () => {
  const onAction = jest.fn(async () => {
    throw new Error("private raw failure");
  });
  const idle: JourneyAsyncState = { status: "idle" };
  const loading: JourneyAsyncState = { status: "loading" };
  const { rerender } = render(
    <JourneyAction
      actionState={idle}
      errorMessage="保存失败，请重试。"
      label="保存"
      loadingLabel="正在保存…"
      onAction={onAction}
    />
  );

  fireEvent.press(screen.getByRole("button", { name: "保存" }));
  expect(await screen.findByText("保存失败，请重试。")).toBeTruthy();

  rerender(
    <JourneyAction
      actionState={loading}
      errorMessage="保存失败，请重试。"
      label="保存"
      loadingLabel="正在保存…"
      onAction={onAction}
    />
  );

  expect(screen.queryByText("保存失败，请重试。")).toBeNull();
  expect(screen.getByRole("button", { name: "正在保存…" }).props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );

  rerender(
    <JourneyAction
      actionState={idle}
      errorMessage="保存失败，请重试。"
      label="保存"
      loadingLabel="正在保存…"
      onAction={onAction}
    />
  );
  expect(screen.queryByText("保存失败，请重试。")).toBeNull();
});

test("settles pending actions safely after unmount", async () => {
  const resolveAction = deferred<void>();
  const rejectAction = deferred<void>();
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

  const first = render(
    <JourneyAction
      label="保存"
      loadingLabel="正在保存…"
      onAction={() => resolveAction.promise}
    />
  );
  fireEvent.press(screen.getByRole("button", { name: "保存" }));
  first.unmount();
  await act(async () => resolveAction.resolve());

  const second = render(
    <JourneyAction
      label="保存"
      loadingLabel="正在保存…"
      onAction={() => rejectAction.promise}
    />
  );
  fireEvent.press(screen.getByRole("button", { name: "保存" }));
  second.unmount();
  await act(async () => rejectAction.reject(new Error("private raw failure")));

  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

test("settles synchronous actions inside the press event without warnings", () => {
  const onAction = jest.fn(() => undefined);
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  render(
    <JourneyAction
      label="保存"
      loadingLabel="正在保存…"
      onAction={onAction}
    />
  );

  fireEvent.press(screen.getByRole("button", { name: "保存" }));

  expect(onAction).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "保存" }).props.accessibilityState.busy).toBe(false);
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

test("guards duplicate presses until an asynchronous action settles", async () => {
  const pending = deferred<void>();
  const onAction = jest.fn(() => pending.promise);
  render(
    <JourneyAction
      label="保存"
      loadingLabel="正在保存…"
      onAction={onAction}
    />
  );

  fireEvent.press(screen.getByRole("button", { name: "保存" }));
  fireEvent.press(screen.getByRole("button", { name: "正在保存…" }));

  expect(onAction).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "正在保存…" }).props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );

  await act(async () => pending.resolve());
  expect(screen.getByRole("button", { name: "保存" }).props.accessibilityState.busy).toBe(false);
});
