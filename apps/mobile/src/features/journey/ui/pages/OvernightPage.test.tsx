import type { JourneyOption, JourneySource } from "@cave/content";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { OvernightPage } from "./OvernightPage";

const options = [
  { id: "expect-time", group: "expectation", label: "有更多时间待在一起", exclusive: false, order: 1 },
  { id: "expect-none", group: "expectation", label: "我还没有具体想象", exclusive: true, order: 2 },
  { id: "concern-space", group: "concern", label: "想保留一点自己的空间", exclusive: false, order: 3 },
  { id: "concern-none", group: "concern", label: "现在没有特别在意的", exclusive: true, order: 4 },
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

test("fills the collapsed view with education, two summaries, footer guidance, and continuation", () => {
  render(<OvernightPage consentSource={source} onContinue={jest.fn()} options={options} />);

  expect(screen.queryByText("这个夜晚，我们会一起待到明天")).toBeNull();
  expect(screen.getByText("教育原则")).toBeTruthy();
  expect(screen.getByText("一起过夜，不代表任何事情必须发生。")).toBeTruthy();
  expect(screen.getByText("想象一个可能的晚上：你和正在靠近的人商量好，会在同一个空间待到明天。")).toBeTruthy();
  expect(screen.queryByText(/也许是聊天、看电影/u)).toBeNull();

  const expectation = screen.getByRole("button", { name: "你有一点期待的是……，点击展开" });
  const concern = screen.getByRole("button", { name: "你有一点在意的是……，点击展开" });
  expect(expectation.props.accessibilityState).toEqual(expect.objectContaining({ expanded: false }));
  expect(concern.props.accessibilityState).toEqual(expect.objectContaining({ expanded: false }));
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.getByText("这些感受可以同时被留下，不需要现在整理成一个确定答案。", { exact: false })).toBeTruthy();
  expect(screen.getByRole("link", { name: "同意原则与来源" })).toHaveStyle({ minHeight: 44 });
  expect(screen.getByRole("button", { name: "带着这些感受继续" })).toHaveStyle({ minHeight: 52, minWidth: 44 });
  expect(StyleSheet.flatten(screen.getByTestId("page-2-content").props.style)).toEqual(
    expect.objectContaining({ flexGrow: 1 }),
  );
});

test("allows both panels to expand, summarizes selections, and restores education when both collapse", () => {
  const onContinue = jest.fn();
  render(
    <OvernightPage
      consentSource={source}
      initialCustomNote="保留旧补充"
      onContinue={onContinue}
      options={options}
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "你有一点期待的是……，点击展开" }));
  expect(screen.queryByText("教育原则")).toBeNull();
  fireEvent.press(screen.getByRole("checkbox", { name: "有更多时间待在一起" }));

  fireEvent.press(screen.getByRole("button", { name: "你有一点在意的是……，点击展开" }));
  expect(screen.getByRole("checkbox", { name: "有更多时间待在一起" })).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "想保留一点自己的空间" })).toBeTruthy();
  fireEvent.press(screen.getByRole("checkbox", { name: "想保留一点自己的空间" }));

  fireEvent.press(screen.getByRole("button", { name: "你有一点期待的是……，已选 1 个 · 点开修改" }));
  expect(screen.queryByText("教育原则")).toBeNull();
  expect(screen.getByRole("button", { name: "你有一点期待的是……，已选 1 个 · 点开修改" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ expanded: false }));

  fireEvent.press(screen.getByRole("button", { name: "你有一点在意的是……，已选 1 个 · 点开修改" }));
  expect(screen.getByText("教育原则")).toBeTruthy();
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));
  expect(onContinue).toHaveBeenCalledWith({
    concernIds: ["concern-space"],
    expectationIds: ["expect-time"],
    customNote: "保留旧补充",
  });
});

test("preserves exclusive choices inside each accordion", () => {
  render(<OvernightPage initialStage="concerns" onContinue={jest.fn()} options={options} />);
  fireEvent.press(screen.getByRole("button", { name: "你有一点期待的是……，点击展开" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "有更多时间待在一起" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "我还没有具体想象" }));

  expect(screen.getByRole("checkbox", { name: "有更多时间待在一起" })).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ checked: false }),
  );
  expect(screen.getByRole("checkbox", { name: "我还没有具体想象" })).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ checked: true }),
  );
});

test("opens the consent source from the persistent footer link", () => {
  const onSourceAction = jest.fn();
  render(
    <OvernightPage
      consentSource={source}
      onContinue={jest.fn()}
      onSourceAction={onSourceAction}
      options={options}
    />,
  );

  fireEvent.press(screen.getByRole("link", { name: "同意原则与来源" }));
  expect(screen.getByText("RAINN")).toBeTruthy();
  expect(screen.getByText("2026-05-31 更新 · 访问于 2026-08-27")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "在浏览器中打开" }));
  expect(onSourceAction).toHaveBeenCalledWith(source);
});

test("does not advance a stage after a failed atomic snapshot write and permits retry", async () => {
  const onProgress = jest.fn()
    .mockRejectedValueOnce(new Error("storage unavailable"))
    .mockResolvedValueOnce(undefined);
  render(<OvernightPage onContinue={jest.fn()} onProgress={onProgress} options={options} />);

  fireEvent.press(screen.getByRole("button", { name: "你有一点期待的是……，点击展开" }));
  await waitFor(() => expect(screen.getByText("暂时无法保存，请重试。")).toBeTruthy());
  expect(screen.getByText("教育原则")).toBeTruthy();
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

  fireEvent.press(screen.getByRole("button", { name: "你有一点期待的是……，点击展开" }));
  expect(await screen.findByRole("checkbox", { name: "有更多时间待在一起" })).toBeTruthy();
  expect(screen.queryByText("教育原则")).toBeNull();
  expect(onProgress).toHaveBeenNthCalledWith(1, {
    completed: false,
    concernIds: [],
    customNote: "",
    expectationIds: [],
    stage: "expectations",
  });
  expect(onProgress).toHaveBeenCalledTimes(2);
});

test("persists each selection snapshot before navigation", async () => {
  const onProgress = jest.fn(async () => undefined);
  render(<OvernightPage initialStage="concerns" onContinue={jest.fn()} onProgress={onProgress} options={options} />);

  fireEvent.press(screen.getByRole("button", { name: "你有一点期待的是……，点击展开" }));
  await screen.findByRole("checkbox", { name: "有更多时间待在一起" });
  fireEvent.press(screen.getByRole("checkbox", { name: "有更多时间待在一起" }));

  await waitFor(() => expect(onProgress).toHaveBeenCalledWith({
    completed: false,
    concernIds: [],
    customNote: "",
    expectationIds: ["expect-time"],
    stage: "expectations",
  }));
});

test("failed continuation stays recoverable instead of becoming a dead end", async () => {
  render(<OvernightPage onContinue={jest.fn().mockRejectedValue(new Error("offline"))} options={options} />);
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));
  await waitFor(() => expect(screen.getByText("保存失败，请重试。")).toBeTruthy());
  expect(screen.getByRole("button", { name: "带着这些感受继续" })).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: false }),
  );
});
