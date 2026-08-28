import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { WelcomePage } from "./WelcomePage";

test("adult confirmation leads to address preference then the preface without numeric progress", async () => {
  const onAdult = jest.fn();
  render(<WelcomePage onAdult={onAdult} onUnderage={jest.fn()} resumeAvailable={false} />);

  expect(screen.queryByText(/\/ 7/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "我已满 18 岁，开始探索" }));
  expect(screen.getByTestId("welcome-address-sheet")).toHaveProp("accessibilityViewIsModal", true);
  expect(screen.getByRole("button", { name: "这样称呼我" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: true }),
  );

  fireEvent.press(screen.getByRole("radio", { name: "妳｜明确称呼女性，更有书信感。" }));
  fireEvent.press(screen.getByRole("button", { name: "这样称呼我" }));
  await waitFor(() => expect(screen.getByText("开始前，想告诉妳")).toBeTruthy());
  expect(screen.getByText(/这不是为了让妳表现得更大胆/u)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "先跳过" }));
  await waitFor(() => {
    expect(onAdult).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("开始前，想告诉妳")).toBeNull();
  });
});

test("failed adult continuation stays on the preface and can be retried", async () => {
  const onAdult = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  render(<WelcomePage onAdult={onAdult} onUnderage={jest.fn()} resumeAvailable={false} />);
  fireEvent.press(screen.getByRole("button", { name: "我已满 18 岁，开始探索" }));
  fireEvent.press(screen.getByRole("radio", { name: "你｜日常、自然，不限定性别。" }));
  fireEvent.press(screen.getByRole("button", { name: "这样称呼我" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "我知道了，开始探索" })).toBeTruthy());
  fireEvent.press(screen.getByRole("button", { name: "我知道了，开始探索" }));
  await waitFor(() => expect(screen.getByText("暂时无法开始，请重试。")).toBeTruthy());
  fireEvent.press(screen.getByRole("button", { name: "我知道了，开始探索" }));
  await waitFor(() => {
    expect(onAdult).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("开始前，想告诉你")).toBeNull();
  });
});

test("underage choice stays in a safe terminal until explicit exit", () => {
  const onUnderage = jest.fn();
  render(<WelcomePage onAdult={jest.fn()} onUnderage={onUnderage} resumeAvailable={false} />);

  fireEvent.press(screen.getByRole("button", { name: "我未满 18 岁" }));
  expect(screen.getByText("这个版本暂时只为成年人设计。你可以先离开，照顾好自己的节奏。")).toBeTruthy();
  expect(onUnderage).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "我已满 18 岁，开始探索" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "退出体验" }));
  expect(onUnderage).toHaveBeenCalledTimes(1);
});

test("resume and restart actions remain available without blocking a fresh start", () => {
  render(
    <WelcomePage
      onAdult={jest.fn()}
      onRestart={jest.fn()}
      onResume={jest.fn()}
      onUnderage={jest.fn()}
      resumeAvailable
    />,
  );
  expect(screen.getByRole("button", { name: "继续本机旅程" })).toHaveStyle({ minHeight: 48, minWidth: 44 });
  expect(screen.getByRole("button", { name: "重新开始（需要确认）" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "我已满 18 岁，开始探索" })).toBeTruthy();
});
