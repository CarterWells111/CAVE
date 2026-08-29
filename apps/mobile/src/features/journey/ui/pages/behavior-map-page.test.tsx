import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";

import * as guidedScroll from "../guided-scroll-screen";
import { BehaviorMapPage } from "./behavior-map-page";

afterEach(() => jest.restoreAllMocks());

const completeBaseAttitudes = {
  "behavior-hug": "looking-forward",
  "draft-kissing": "familiar-enjoyed",
  "behavior-same-bed": "decide-in-moment",
  "behavior-my-nudity": "unsure",
  "behavior-partner-nudity": "not-this-time",
  "behavior-over-clothes-touch": "skip",
  "behavior-direct-touch": "skip",
} as const;

async function openCard(frontTestId: string, backTestId: string) {
  fireEvent.press(screen.getByTestId(frontTestId));
  await waitFor(() => expect(screen.getByTestId(backTestId)).toBeTruthy());
}

test("reveals a full-screen card action once after the first answer", async () => {
  const reveal = jest.fn();
  jest.spyOn(guidedScroll, "useJourneyGuidedScroll").mockReturnValue({ reveal });
  render(<BehaviorMapPage onComplete={jest.fn()} onSetAttitude={jest.fn()} reducedMotion />);
  await openCard("behavior-card-front-behavior-hug", "behavior-card-back-behavior-hug");

  fireEvent.press(screen.getByRole("radio", { name: "拥抱或依偎：我还没想清楚" }));
  fireEvent.press(screen.getByRole("radio", { name: "拥抱或依偎：这不是我这次想要的" }));

  expect(reveal).toHaveBeenCalledTimes(1);
  expect(reveal).toHaveBeenCalledWith("behavior-map-active-action");
  expect(screen.getByTestId("journey-scroll-target-behavior-map-active-action")).toBeTruthy();
});

test("renders all base actions as an independent two-column card grid", () => {
  render(<BehaviorMapPage onComplete={jest.fn()} onSetAttitude={jest.fn()} reducedMotion />);

  expect(screen.getByTestId("behavior-card-grid")).toBeTruthy();
  expect(screen.getAllByText("点击选择")).toHaveLength(7);
  expect(screen.getByText("更多具体行为")).toBeTruthy();
  expect(screen.getByText("添加一个我在意的行为")).toBeTruthy();
  expect(screen.queryByText("每一种靠近，都可以有不同答案")).toBeNull();
  expect(screen.queryByTestId("behavior-map-scroll")).toBeNull();

  const gridStyle = StyleSheet.flatten(screen.getByTestId("behavior-card-grid").props.style);
  const cardStyle = StyleSheet.flatten(screen.getByTestId("behavior-card-front-behavior-hug").props.style);
  expect(gridStyle).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
  expect(cardStyle).toMatchObject({ minHeight: 156, width: "47.5%" });
  expect(screen.getByText("拥抱或依偎").props.numberOfLines).toBeUndefined();
});

test("opens one card and offers all six non-ranked answers", async () => {
  const onCardVisibilityChange = jest.fn();
  render(
    <BehaviorMapPage
      onCardVisibilityChange={onCardVisibilityChange}
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
      reducedMotion
    />,
  );

  await openCard("behavior-card-front-behavior-hug", "behavior-card-back-behavior-hug");

  expect(screen.queryByTestId("behavior-card-grid")).toBeNull();
  expect(screen.getByText("对于拥抱或依偎，此刻的你更接近哪种感觉？")).toBeTruthy();
  expect(screen.getAllByRole("radio", { name: /^拥抱或依偎：/u })).toHaveLength(6);
  expect(screen.getByRole("radio", { name: "拥抱或依偎：我已经习惯 / 我享受这类亲密行为" })).toBeTruthy();
  expect(screen.getByText("期待不代表已经答应，到了当时仍然需要彼此确认。")).toBeTruthy();
  expect(screen.getByText("熟悉或享受过，不代表这一次已经同意；仍然可以根据当下的感受重新决定。")).toBeTruthy();
  expect(screen.getByText("可以等到那一刻，再听听自己的感觉。")).toBeTruthy();
  expect(screen.getByText("不确定也是一个完整的答案。")).toBeTruthy();
  expect(screen.getByText("你不需要为这个答案补充理由。")).toBeTruthy();
  expect(screen.getByText("可以先留白，之后再回来看看。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "带着这些感受继续" })).toBeTruthy();
  expect(onCardVisibilityChange).toHaveBeenCalledWith(true);
});

test("keeps a selection local until save, then returns to the updated card front", async () => {
  const onSetAttitude = jest.fn();
  const onCardVisibilityChange = jest.fn();
  render(
    <BehaviorMapPage
      onCardVisibilityChange={onCardVisibilityChange}
      onComplete={jest.fn()}
      onSetAttitude={onSetAttitude}
      reducedMotion
    />,
  );
  await openCard("behavior-card-front-behavior-hug", "behavior-card-back-behavior-hug");

  fireEvent.press(screen.getByRole("radio", { name: "拥抱或依偎：我已经习惯 / 我享受这类亲密行为" }));
  expect(onSetAttitude).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));

  await waitFor(() => expect(onSetAttitude).toHaveBeenCalledWith("behavior-hug", "familiar-enjoyed"));
  await waitFor(() => expect(screen.getByTestId("behavior-card-grid")).toBeTruthy());
  expect(screen.getByText("已选择：我已经习惯 / 我享受这类亲密行为")).toBeTruthy();
  expect(screen.getByText("点击修改")).toBeTruthy();
  expect(onCardVisibilityChange).toHaveBeenLastCalledWith(false);
});

test("restores VoiceOver focus to the card trigger after saving", async () => {
  const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(jest.fn());
  render(<BehaviorMapPage onComplete={jest.fn()} onSetAttitude={jest.fn()} reducedMotion resolveFocusHandle={() => 42} />);
  await openCard("behavior-card-front-behavior-hug", "behavior-card-back-behavior-hug");
  fireEvent.press(screen.getByRole("radio", { name: "拥抱或依偎：我还没想清楚" }));
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));

  await waitFor(() => expect(screen.getByTestId("behavior-card-grid")).toBeTruthy());
  await waitFor(() => expect(focus.mock.calls.length).toBeGreaterThanOrEqual(2));
  expect(focus).toHaveBeenLastCalledWith(42);
  focus.mockRestore();
});

test("restores a saved answer on edit without treating it as current consent", async () => {
  render(
    <BehaviorMapPage
      initialAttitudes={{ "behavior-hug": "familiar-enjoyed" }}
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
      reducedMotion
    />,
  );

  expect(screen.getByText("已选择：我已经习惯 / 我享受这类亲密行为")).toBeTruthy();
  await openCard("behavior-card-front-behavior-hug", "behavior-card-back-behavior-hug");
  expect(screen.getByRole("radio", { name: "拥抱或依偎：我已经习惯 / 我享受这类亲密行为" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
});

test("stays on the card back when persistence fails and supports retry", async () => {
  const onSetAttitude = jest.fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(undefined);
  render(<BehaviorMapPage onComplete={jest.fn()} onSetAttitude={onSetAttitude} reducedMotion />);
  await openCard("behavior-card-front-behavior-hug", "behavior-card-back-behavior-hug");

  fireEvent.press(screen.getByRole("radio", { name: "拥抱或依偎：我还没想清楚" }));
  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/暂时无法保存，请重试。/u);
  expect(screen.getByTestId("behavior-card-back-behavior-hug")).toBeTruthy();
  expect(screen.getByText("不确定也是一个完整的答案。")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));
  await waitFor(() => expect(onSetAttitude).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByTestId("behavior-card-grid")).toBeTruthy());
});

test("shows the page continuation only after all seven base cards have answers", () => {
  const onComplete = jest.fn();
  const { unmount } = render(
    <BehaviorMapPage onComplete={onComplete} onSetAttitude={jest.fn()} reducedMotion />,
  );
  expect(screen.queryByRole("button", { name: "完成这些卡牌，继续整理感受" })).toBeNull();

  unmount();
  render(
    <BehaviorMapPage
      initialAttitudes={completeBaseAttitudes}
      onComplete={onComplete}
      onSetAttitude={jest.fn()}
      reducedMotion
    />,
  );
  fireEvent.press(screen.getByRole("button", { name: "完成这些卡牌，继续整理感受" }));
  expect(onComplete).toHaveBeenCalledWith({ participated: true });
});

test("gates sensitive details, then adds two independent cards after explicit consent", async () => {
  const onSetSensitiveContentConsent = jest.fn();
  render(
    <BehaviorMapPage
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
      onSetSensitiveContentConsent={onSetSensitiveContentConsent}
      reducedMotion
    />,
  );

  expect(screen.queryByText("口腔与私密部位的接触")).toBeNull();
  await openCard("behavior-card-front-behavior-map-more", "behavior-card-back-more");
  fireEvent.press(screen.getByRole("button", { name: "了解内容后再决定" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "我知道接下来会看到更具体的健康教育内容，并愿意继续" }));
  fireEvent.press(screen.getByRole("button", { name: "我了解，继续查看" }));

  await waitFor(() => expect(onSetSensitiveContentConsent).toHaveBeenCalledWith(true));
  await waitFor(() => expect(screen.getByTestId("behavior-card-grid")).toBeTruthy());
  expect(screen.getByTestId("behavior-card-front-behavior-oral-genital-contact")).toBeTruthy();
  expect(screen.getByTestId("behavior-card-front-draft-penetrative-sex")).toBeTruthy();
});

test("does not expose sensitive cards when declining and retries failed consent persistence", async () => {
  const onSetSensitiveContentConsent = jest.fn()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValueOnce(undefined);
  render(
    <BehaviorMapPage
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
      onSetSensitiveContentConsent={onSetSensitiveContentConsent}
      reducedMotion
    />,
  );
  await openCard("behavior-card-front-behavior-map-more", "behavior-card-back-more");

  fireEvent.press(screen.getByRole("button", { name: "这次不查看" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByTestId("behavior-card-back-more")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "这次不查看" }));

  await waitFor(() => expect(onSetSensitiveContentConsent).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByTestId("behavior-card-grid")).toBeTruthy());
  expect(screen.queryByTestId("behavior-card-front-behavior-oral-genital-contact")).toBeNull();
});

test("adds a trimmed custom behavior as a normal editable card", async () => {
  const onAddCustomBehavior = jest.fn();
  render(
    <BehaviorMapPage
      createCustomBehaviorId={() => "custom-gentle-touch"}
      onAddCustomBehavior={onAddCustomBehavior}
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
      reducedMotion
    />,
  );
  await openCard("behavior-card-front-behavior-map-custom", "behavior-card-back-add-custom");

  fireEvent.changeText(screen.getByLabelText("我在意的自定义行为"), "  轻轻触碰手臂  ");
  fireEvent.press(screen.getByRole("button", { name: "添加到卡牌" }));

  await waitFor(() => expect(onAddCustomBehavior).toHaveBeenCalledWith({
    id: "custom-gentle-touch",
    label: "轻轻触碰手臂",
  }));
  await waitFor(() => expect(screen.getByTestId("behavior-card-front-custom-gentle-touch")).toBeTruthy());
});

test("uses the flip animation unless reduced motion is requested", async () => {
  const timing = jest.spyOn(Animated, "timing");
  render(<BehaviorMapPage onComplete={jest.fn()} onSetAttitude={jest.fn()} reducedMotion={false} />);
  await openCard("behavior-card-front-behavior-hug", "behavior-card-back-behavior-hug");
  expect(timing).toHaveBeenCalled();
  timing.mockRestore();
});

test("switches behavior card content directly without rotateY or timing calls in reduced-motion mode", async () => {
  const timing = jest.spyOn(Animated, "timing");
  render(<BehaviorMapPage onComplete={jest.fn()} onSetAttitude={jest.fn()} reducedMotion />);
  await openCard("behavior-card-front-behavior-hug", "behavior-card-back-behavior-hug");

  expect(timing).not.toHaveBeenCalled();
  expect(StyleSheet.flatten(screen.getByTestId("behavior-card-fullscreen").props.style).transform).toBeUndefined();
  timing.mockRestore();
});
