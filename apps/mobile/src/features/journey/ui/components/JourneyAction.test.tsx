import { act, fireEvent, render, screen } from "@testing-library/react-native";

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
