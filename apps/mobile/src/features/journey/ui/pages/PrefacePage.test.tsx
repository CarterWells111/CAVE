import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as guidedScroll from "../guided-scroll-screen";
import { PrefacePage } from "./preface-page";

afterEach(() => jest.restoreAllMocks());

test("reveals the enabled continue action after choosing a form of address", () => {
  const reveal = jest.fn();
  jest.spyOn(guidedScroll, "useJourneyGuidedScroll").mockReturnValue({ reveal });
  render(<PrefacePage onContinue={jest.fn()} />);

  fireEvent.press(screen.getByRole("radio", { name: "你｜日常、自然，不限定性别。" }));
  fireEvent.press(screen.getByRole("radio", { name: "妳｜明确称呼女性，更有书信感。" }));

  expect(reveal).toHaveBeenCalledWith("preface-continue");
  expect(reveal).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("journey-scroll-target-preface-continue")).toBeTruthy();
});

test("mounts the preface inside the shared guided scroll screen", () => {
  const route = readFileSync(join(__dirname, "../../../../../app/journey/preface.tsx"), "utf8");
  expect(route).toContain("JourneyGuidedScrollScreen");
  expect(route).not.toContain("<Screen>");
});

test("requires a chosen form of address before saving it", async () => {
  const onContinue = jest.fn(async () => undefined);
  render(<PrefacePage onContinue={onContinue} />);

  expect(screen.getByRole("header", { name: "开始前，想告诉你" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "这样称呼我" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: true }),
  );
  fireEvent.press(screen.getByRole("radio", { name: "妳｜明确称呼女性，更有书信感。" }));
  fireEvent.press(screen.getByRole("button", { name: "这样称呼我" }));
  await waitFor(() => expect(onContinue).toHaveBeenCalledWith("妳"));
});

test("explains account persistence and hides the login link when it is not available", () => {
  render(<PrefacePage onContinue={jest.fn()} />);
  expect(screen.getByText(/登录后会保存到账号/u)).toBeTruthy();
  expect(screen.queryByRole("link", { name: "登录后保存现有选择" })).toBeNull();
});

test("saves a selection immediately but waits for continue to advance", async () => {
  const onChoose = jest.fn(async () => undefined);
  const onContinue = jest.fn();
  const onSignIn = jest.fn();
  render(<PrefacePage onChoose={onChoose} onContinue={onContinue} onSignIn={onSignIn} />);
  fireEvent.press(screen.getByRole("radio", { name: "妳｜明确称呼女性，更有书信感。" }));
  await waitFor(() => expect(onChoose).toHaveBeenCalledWith("妳"));
  expect(onContinue).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("link", { name: "登录后保存现有选择" })).toHaveProp("accessibilityState", { disabled: false }));
  fireEvent.press(screen.getByRole("link", { name: "登录后保存现有选择" }));
  expect(onSignIn).toHaveBeenCalledTimes(1);
});
