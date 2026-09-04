import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { AdultGatePage } from "./adult-gate-page";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

test("states the local adult self-declaration boundary without collecting identity data", () => {
  render(<AdultGatePage onConfirmAdult={jest.fn()} onUnderage={jest.fn()} />);

  expect(screen.getByRole("header", { name: "仅限已满 18 岁者" })).toBeTruthy();
  expect(screen.getByText(/本机作出自我声明/u)).toBeTruthy();
  expect(screen.getByText(/不是身份或年龄核验/u)).toBeTruthy();
  expect(screen.getByText(/不收集你的生日或证件/u)).toBeTruthy();
  expect(screen.getByText(/先保存在本机/u)).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
});

test("offers an underlined login link without confirming adulthood", () => {
  const onSignIn = jest.fn();
  const onConfirmAdult = jest.fn();
  render(<AdultGatePage onConfirmAdult={onConfirmAdult} onUnderage={jest.fn()} onSignIn={onSignIn} />);
  expect(screen.getByText("登录后保存现有选择")).toHaveStyle({ textDecorationLine: "underline" });
  fireEvent.press(screen.getByRole("link", { name: "登录后保存现有选择" }));
  expect(onSignIn).toHaveBeenCalledTimes(1);
  expect(onConfirmAdult).not.toHaveBeenCalled();
});

test("offers direct adult and underage actions without a declaration checkbox", async () => {
  const onConfirmAdult = jest.fn(async () => undefined);
  const onUnderage = jest.fn(async () => undefined);
  render(<AdultGatePage onConfirmAdult={onConfirmAdult} onUnderage={onUnderage} />);

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));
  await waitFor(() => expect(onConfirmAdult).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(
    screen.getByRole("button", { name: "我未满 18 岁" }).props.accessibilityState.disabled
  ).toBe(false));

  fireEvent.press(screen.getByRole("button", { name: "我未满 18 岁" }));
  await waitFor(() => expect(onUnderage).toHaveBeenCalledTimes(1));
});

test("locks both decisions while adult confirmation is pending", async () => {
  const pendingAdult = deferred<void>();
  const onConfirmAdult = jest.fn(() => pendingAdult.promise);
  const onUnderage = jest.fn(async () => undefined);
  render(<AdultGatePage onConfirmAdult={onConfirmAdult} onUnderage={onUnderage} />);

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));

  expect(screen.getByRole("button", { name: "正在继续…" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ busy: true, disabled: true }));
  expect(screen.getByRole("button", { name: "我未满 18 岁" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ disabled: true }));
  fireEvent.press(screen.getByRole("button", { name: "正在继续…" }));
  fireEvent.press(screen.getByRole("button", { name: "我未满 18 岁" }));

  expect(onConfirmAdult).toHaveBeenCalledTimes(1);
  expect(onUnderage).not.toHaveBeenCalled();
  await act(async () => pendingAdult.resolve());
});

test("shows the adult save error and unlocks both decisions for retry", async () => {
  const pendingAdult = deferred<void>();
  const onConfirmAdult = jest.fn(() => pendingAdult.promise);
  const onUnderage = jest.fn(async () => undefined);
  render(<AdultGatePage onConfirmAdult={onConfirmAdult} onUnderage={onUnderage} />);

  fireEvent.press(screen.getByRole("button", { name: "我已年满 18 岁，继续" }));
  await act(async () => pendingAdult.reject(new Error("private persistence failure")));

  expect(screen.getByText("确认暂时无法保存，请重试。")).toBeTruthy();
  expect(screen.queryByText("private persistence failure")).toBeNull();
  expect(screen.getByRole("button", { name: "我已年满 18 岁，继续" }).props.accessibilityState.disabled)
    .toBe(false);
  expect(screen.getByRole("button", { name: "我未满 18 岁" }).props.accessibilityState.disabled)
    .toBe(false);

  fireEvent.press(screen.getByRole("button", { name: "我未满 18 岁" }));
  await waitFor(() => expect(onUnderage).toHaveBeenCalledTimes(1));
});
