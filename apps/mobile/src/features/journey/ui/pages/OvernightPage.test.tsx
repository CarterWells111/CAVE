import type { JourneyOption } from "@cave/content";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Animated, StyleSheet } from "react-native";

import * as guidedScroll from "../guided-scroll-screen";
import { OvernightPage } from "./OvernightPage";

afterEach(() => jest.restoreAllMocks());

const options = [
  { id: "expect-time", group: "expectation", label: "有更多时间待在一起", exclusive: false, order: 1 },
  { id: "expect-none", group: "expectation", label: "我还没有具体想象", exclusive: true, order: 2 },
  { id: "concern-space", group: "concern", label: "想保留一点自己的空间", exclusive: false, order: 3 },
  { id: "concern-none", group: "concern", label: "现在没有特别在意的", exclusive: true, order: 4 },
] as JourneyOption[];

async function openCard(testId: string, backTestId: string) {
  fireEvent.press(screen.getByTestId(testId));
  await waitFor(() => expect(screen.getByTestId(backTestId)).toBeTruthy());
}

test("guides only after each saved card is explicitly returned to the overview", async () => {
  const reveal = jest.fn();
  jest.spyOn(guidedScroll, "useJourneyGuidedScroll").mockReturnValue({ reveal });
  const onProgress = jest.fn(async () => undefined);
  render(<OvernightPage onContinue={jest.fn()} onProgress={onProgress} options={options} reducedMotion />);

  await openCard("overnight-card-front-expectations", "overnight-card-back-expectations");
  fireEvent.press(screen.getByRole("checkbox", { name: "有更多时间待在一起" }));
  await waitFor(() => expect(onProgress).toHaveBeenCalledTimes(2));
  expect(reveal).not.toHaveBeenCalled();
  const expectationReturn = screen.getByRole("button", { name: "带着这些感受继续" });
  await waitFor(() => expect(expectationReturn).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: false }),
  ));
  fireEvent.press(expectationReturn);
  await waitFor(() => expect(reveal).toHaveBeenCalledWith("overnight-concerns-heading"));

  await openCard("overnight-card-front-concerns", "overnight-card-back-concerns");
  fireEvent.press(screen.getByRole("checkbox", { name: "想保留一点自己的空间" }));
  await waitFor(() => expect(onProgress).toHaveBeenCalledTimes(4));
  expect(reveal).toHaveBeenCalledTimes(1);
  const concernReturn = screen.getByRole("button", { name: "带着这些感受继续" });
  await waitFor(() => expect(concernReturn).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: false }),
  ));
  fireEvent.press(concernReturn);
  await waitFor(() => expect(reveal).toHaveBeenLastCalledWith("overnight-final-continue"));

  expect(screen.getByTestId("journey-scroll-target-overnight-concerns-heading")).toBeTruthy();
  expect(screen.getByTestId("journey-scroll-target-overnight-final-continue")).toBeTruthy();
});

test("shows two flip-card fronts and a clearly named cross-page action", () => {
  render(<OvernightPage onContinue={jest.fn()} options={options} reducedMotion />);

  expect(screen.getByText("教育原则")).toBeTruthy();
  expect(screen.getByTestId("overnight-card-grid")).toBeTruthy();
  expect(within(screen.getByTestId("overnight-card-front-expectations")).getByText("你有一点期待的是……")).toBeTruthy();
  expect(within(screen.getByTestId("overnight-card-front-concerns")).getByText("你有一点在意的是……")).toBeTruthy();
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.getByRole("button", { name: "进入行为地图" })).toBeTruthy();

  const gridStyle = StyleSheet.flatten(screen.getByTestId("overnight-card-grid").props.style);
  const cardStyle = StyleSheet.flatten(screen.getByTestId("overnight-card-front-expectations").props.style);
  expect(gridStyle).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
  expect(cardStyle).toMatchObject({ minHeight: 156, width: "47.5%" });
});

test("saves selections immediately but stays on the card back until the user explicitly returns", async () => {
  let resolveSelection!: () => void;
  const onProgress = jest.fn()
    .mockResolvedValueOnce(undefined)
    .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSelection = resolve; }));
  render(
    <OvernightPage
      initialCustomNote="保留旧补充"
      onContinue={jest.fn()}
      onProgress={onProgress}
      options={options}
      reducedMotion
    />,
  );

  await openCard("overnight-card-front-expectations", "overnight-card-back-expectations");
  fireEvent.press(screen.getByRole("checkbox", { name: "有更多时间待在一起" }));

  expect(onProgress).toHaveBeenLastCalledWith({
    completed: false,
    concernIds: [],
    customNote: "保留旧补充",
    expectationIds: ["expect-time"],
    stage: "expectations",
  });
  expect(screen.getByTestId("overnight-card-back-expectations")).toBeTruthy();
  expect(screen.queryByTestId("overnight-card-grid")).toBeNull();
  resolveSelection();
  await waitFor(() => expect(screen.getByRole("button", { name: "带着这些感受继续" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: false }),
  ));
  expect(screen.getByTestId("overnight-card-back-expectations")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));
  await waitFor(() => expect(screen.getByTestId("overnight-card-grid")).toBeTruthy());
  expect(within(screen.getByTestId("overnight-card-front-expectations")).getByText("已选 1 个")).toBeTruthy();
});

test("lets an empty card return without creating a selection", async () => {
  const reveal = jest.fn();
  jest.spyOn(guidedScroll, "useJourneyGuidedScroll").mockReturnValue({ reveal });
  const onProgress = jest.fn().mockResolvedValue(undefined);
  render(<OvernightPage onContinue={jest.fn()} onProgress={onProgress} options={options} reducedMotion />);

  await openCard("overnight-card-front-concerns", "overnight-card-back-concerns");
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));

  await waitFor(() => expect(screen.getByTestId("overnight-card-grid")).toBeTruthy());
  expect(within(screen.getByTestId("overnight-card-front-concerns")).getByText("还没有选择")).toBeTruthy();
  expect(reveal).toHaveBeenCalledWith("overnight-final-continue");
});

test("guides after returning from an existing selection without changing it", async () => {
  const reveal = jest.fn();
  jest.spyOn(guidedScroll, "useJourneyGuidedScroll").mockReturnValue({ reveal });
  render(
    <OvernightPage
      initialExpectationIds={["expect-time"]}
      onContinue={jest.fn()}
      onProgress={jest.fn().mockResolvedValue(undefined)}
      options={options}
      reducedMotion
    />,
  );

  await openCard("overnight-card-front-expectations", "overnight-card-back-expectations");
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));

  await waitFor(() => expect(reveal).toHaveBeenCalledWith("overnight-concerns-heading"));
});

test("keeps a failed selection visible and blocks returning until the exact snapshot retry succeeds", async () => {
  const onNavigationLockChange = jest.fn();
  const onProgress = jest.fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("storage unavailable"))
    .mockResolvedValueOnce(undefined);
  render(
    <OvernightPage
      onContinue={jest.fn()}
      onNavigationLockChange={onNavigationLockChange}
      onProgress={onProgress}
      options={options}
      reducedMotion
    />,
  );

  await openCard("overnight-card-front-expectations", "overnight-card-back-expectations");
  fireEvent.press(screen.getByRole("checkbox", { name: "有更多时间待在一起" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("暂时无法保存，请重试。");
  expect(screen.getByRole("checkbox", { name: "有更多时间待在一起" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ checked: true, disabled: true }),
  );
  expect(screen.getByRole("button", { name: "带着这些感受继续" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: true }),
  );
  expect(onNavigationLockChange).toHaveBeenLastCalledWith(true);

  fireEvent.press(screen.getByRole("button", { name: "重试保存当前选择" }));
  await waitFor(() => expect(onProgress).toHaveBeenCalledTimes(3));
  expect(screen.getByTestId("overnight-card-back-expectations")).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: "带着这些感受继续" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ disabled: false }),
  ));
  expect(onNavigationLockChange).toHaveBeenLastCalledWith(false);
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));
  await waitFor(() => expect(screen.getByTestId("overnight-card-grid")).toBeTruthy());
});

test("restores VoiceOver focus only after the selected overview card remounts", async () => {
  const resolveFocusHandle = jest.fn((node: unknown) => node === null ? null : 42);
  render(
    <OvernightPage
      onContinue={jest.fn()}
      onProgress={jest.fn().mockResolvedValue(undefined)}
      options={options}
      reducedMotion
      resolveFocusHandle={resolveFocusHandle as never}
    />,
  );

  await openCard("overnight-card-front-expectations", "overnight-card-back-expectations");
  resolveFocusHandle.mockClear();
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));
  await waitFor(() => expect(screen.getByTestId("overnight-card-front-expectations")).toBeTruthy());
  await waitFor(() => expect(resolveFocusHandle).toHaveBeenCalled());
  expect(resolveFocusHandle.mock.calls.at(-1)?.[0]).not.toBeNull();
});

test("preserves exclusive choices on a card back", async () => {
  render(<OvernightPage onContinue={jest.fn()} options={options} reducedMotion />);
  await openCard("overnight-card-front-expectations", "overnight-card-back-expectations");
  fireEvent.press(screen.getByRole("checkbox", { name: "有更多时间待在一起" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "我还没有具体想象" }));

  expect(screen.getByRole("checkbox", { name: "有更多时间待在一起" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ checked: false }),
  );
  expect(screen.getByRole("checkbox", { name: "我还没有具体想象" })).toHaveProp(
    "accessibilityState", expect.objectContaining({ checked: true }),
  );
});

test("enters the behavior map only from the card overview with the current snapshot", async () => {
  const onContinue = jest.fn();
  render(
    <OvernightPage
      initialConcernIds={["concern-space"]}
      initialCustomNote="保留旧补充"
      initialExpectationIds={["expect-time"]}
      onContinue={onContinue}
      options={options}
      reducedMotion
    />,
  );

  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "进入行为地图" }));
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(onContinue).toHaveBeenCalledWith({
    concernIds: ["concern-space"],
    expectationIds: ["expect-time"],
    customNote: "保留旧补充",
  });
});

test("keeps shell navigation locked until a failed final snapshot is retried successfully", async () => {
  const onNavigationLockChange = jest.fn();
  const onContinue = jest.fn()
    .mockRejectedValueOnce(new Error("final write failed"))
    .mockResolvedValueOnce(undefined);
  render(
    <OvernightPage
      onContinue={onContinue}
      onNavigationLockChange={onNavigationLockChange}
      options={options}
      reducedMotion
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "进入行为地图" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/保存失败，请重试。/u);
  expect(onNavigationLockChange).toHaveBeenLastCalledWith(true);

  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "进入行为地图" }));
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(onContinue).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(onNavigationLockChange).toHaveBeenLastCalledWith(false));
});

test("opens the single official sources entry without exposing source metadata", () => {
  const onOpenSources = jest.fn();
  render(
    <OvernightPage
      onContinue={jest.fn()}
      onOpenSources={onOpenSources}
      options={options}
      reducedMotion
    />,
  );

  const entry = screen.getByRole("link", { name: "打开内界官网信息来源" });
  expect(entry).toHaveTextContent("查看完整信息来源");
  fireEvent.press(entry);
  expect(onOpenSources).toHaveBeenCalledTimes(1);
});

test("uses a flip animation unless reduced motion is requested", async () => {
  const timing = jest.spyOn(Animated, "timing");
  const first = render(<OvernightPage onContinue={jest.fn()} options={options} reducedMotion={false} />);
  await openCard("overnight-card-front-expectations", "overnight-card-back-expectations");
  expect(timing).toHaveBeenCalled();
  first.unmount();
  timing.mockClear();

  render(<OvernightPage onContinue={jest.fn()} options={options} reducedMotion />);
  await openCard("overnight-card-front-expectations", "overnight-card-back-expectations");
  expect(timing).not.toHaveBeenCalled();
  expect(StyleSheet.flatten(screen.getByTestId("overnight-card-fullscreen").props.style).transform).toBeUndefined();
  timing.mockRestore();
});
