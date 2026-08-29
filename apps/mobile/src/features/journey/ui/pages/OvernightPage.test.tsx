import type { JourneyOption, JourneySource } from "@cave/content";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import * as guidedScroll from "../guided-scroll-screen";
import { OvernightPage } from "./OvernightPage";

afterEach(() => jest.restoreAllMocks());

const options = [
  { id: "expect-time", group: "expectation", label: "有更多时间待在一起", exclusive: false },
  { id: "expect-none", group: "expectation", label: "我还没有具体想象", exclusive: true },
  { id: "concern-space", group: "concern", label: "想保留一点自己的空间", exclusive: false },
  { id: "concern-none", group: "concern", label: "现在没有特别在意的", exclusive: true },
] as JourneyOption[];

const source = {
  id: "SRC-003",
  title: "Consent 101",
  organization: "RAINN",
  accessedAt: "2026-08-27",
  publicationOrReviewDate: "2026-05-31 更新",
  url: "https://example.test/consent",
  sourceType: "EDU",
  appliesTo: "同意原则",
  verificationStatus: "source_verified",
} satisfies JourneySource;

test("reveals each stage action only on the first choice and follows the confirmed stage", () => {
  const reveal = jest.fn();
  jest.spyOn(guidedScroll, "useJourneyGuidedScroll").mockReturnValue({ reveal });
  render(<OvernightPage onContinue={jest.fn()} options={options} />);

  fireEvent.press(screen.getByRole("checkbox", { name: "有更多时间待在一起" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "我还没有具体想象" }));
  expect(reveal).toHaveBeenCalledTimes(1);
  expect(reveal).toHaveBeenLastCalledWith("overnight-expectations-continue");

  fireEvent.press(screen.getByRole("button", { name: "继续看看我的在意" }));
  expect(reveal).toHaveBeenLastCalledWith("overnight-concerns-heading");
  fireEvent.press(screen.getByRole("checkbox", { name: "想保留一点自己的空间" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "现在没有特别在意的" }));
  expect(reveal).toHaveBeenLastCalledWith("overnight-final-continue");
  expect(reveal).toHaveBeenCalledTimes(3);

  expect(screen.getByTestId("journey-scroll-target-overnight-concerns-heading")).toBeTruthy();
  expect(screen.getByTestId("journey-scroll-target-overnight-final-continue")).toBeTruthy();
});

test("moves from expectations to concerns, preserves edits, and enforces exclusive choices", () => {
  const onContinue = jest.fn();
  render(<OvernightPage consentSource={source} onContinue={onContinue} options={options} />);

  expect(screen.getByText("想到这次过夜，你有一点期待的是……")).toBeTruthy();
  expect(screen.queryByText("同时，你也有一些在意的是……")).toBeNull();
  fireEvent.press(screen.getByRole("checkbox", { name: "有更多时间待在一起" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "我还没有具体想象" }));
  expect(screen.getByRole("checkbox", { name: "有更多时间待在一起" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ checked: false }),
  );
  fireEvent.press(screen.getByRole("button", { name: "继续看看我的在意" }));

  expect(screen.getByText("同时，你也有一些在意的是……")).toBeTruthy();
  expect(screen.getByText("我还没有具体想象")).toBeTruthy();
  fireEvent.press(screen.getByRole("checkbox", { name: "想保留一点自己的空间" }));
  fireEvent.press(screen.getByRole("button", { name: "修改期待" }));
  expect(screen.getByRole("checkbox", { name: "我还没有具体想象" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ checked: true }),
  );
  fireEvent.press(screen.getByRole("button", { name: "继续看看我的在意" }));
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));
  expect(onContinue).toHaveBeenCalledWith({
    concernIds: ["concern-space"], expectationIds: ["expect-none"], customNote: "",
  });
});

test("moves accessibility focus to the concern question when the stage changes", async () => {
  const focusSpy = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus");
  render(<OvernightPage onContinue={jest.fn()} options={options} />);
  fireEvent.press(screen.getByRole("button", { name: "继续看看我的在意" }));
  await waitFor(() => expect(focusSpy).toHaveBeenCalled());
  focusSpy.mockRestore();
});

test("resumes directly into concerns and exposes consent source metadata without opening automatically", () => {
  const onSourceAction = jest.fn();
  render(
    <OvernightPage
      consentSource={source}
      initialConcernIds={["concern-space"]}
      initialExpectationIds={["expect-time"]}
      initialStage="concerns"
      onContinue={jest.fn()}
      onSourceAction={onSourceAction}
      options={options}
    />,
  );
  expect(screen.getByText("同时，你也有一些在意的是……")).toBeTruthy();
  expect(screen.getByText("有更多时间待在一起")).toBeTruthy();
  expect(onSourceAction).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "同意原则与来源" }));
  expect(screen.getByText("RAINN")).toBeTruthy();
  expect(screen.getByText("2026-05-31 更新 · 访问于 2026-08-27")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "在浏览器中打开" }));
  expect(onSourceAction).toHaveBeenCalledWith(source);
});

test("optional note remains keyboard-scroll friendly and all controls meet touch minimums", () => {
  render(<OvernightPage onContinue={jest.fn()} options={options} />);
  fireEvent.press(screen.getByRole("button", { name: "继续看看我的在意" }));
  expect(screen.getByLabelText("这个夜晚的可选补充")).toHaveStyle({ minHeight: 120 });
  expect(screen.getByRole("button", { name: "带着这些感受继续" })).toHaveStyle({ minHeight: 52, minWidth: 44 });
});

test("failed continuation stays recoverable instead of becoming a dead end", async () => {
  render(<OvernightPage initialStage="concerns" onContinue={jest.fn().mockRejectedValue(new Error("offline"))} options={options} />);
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));
  await waitFor(() => expect(screen.getByText("保存失败，请重试。")).toBeTruthy());
  expect(screen.getByRole("button", { name: "带着这些感受继续" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: false }),
  );
});

test("does not advance or hide a failed stage write and permits retry", async () => {
  const onStageChange = jest.fn()
    .mockRejectedValueOnce(new Error("storage unavailable"))
    .mockResolvedValueOnce(undefined);
  render(<OvernightPage onContinue={jest.fn()} onStageChange={onStageChange} options={options} />);

  fireEvent.press(screen.getByRole("button", { name: "继续看看我的在意" }));
  await waitFor(() => expect(screen.getByText("阶段暂时无法保存，请重试。")).toBeTruthy());
  expect(screen.getByText("想到这次过夜，你有一点期待的是……")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "继续看看我的在意" }));
  expect(await screen.findByText("同时，你也有一些在意的是……")).toBeTruthy();
});
