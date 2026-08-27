import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { BehaviorMapPage } from "./behavior-map-page";

const completeBaseAttitudes = {
  "behavior-hug": "looking-forward",
  "draft-kissing": "decide-in-moment",
  "behavior-same-bed": "unsure",
  "behavior-my-nudity": "not-this-time",
  "behavior-partner-nudity": "skip",
  "behavior-over-clothes-touch": "skip",
  "behavior-direct-touch": "skip",
} as const;

test("renders the nine catalog map points as equal, non-ranked 44-point controls", () => {
  render(<BehaviorMapPage onComplete={jest.fn()} onSetAttitude={jest.fn()} />);

  const points = screen.getAllByRole("radio", { name: /行为地图，第 \d 项，共 9 项/u });
  expect(points).toHaveLength(9);
  for (const point of points) {
    expect(StyleSheet.flatten(point.props.style)).toEqual(expect.objectContaining({
      minHeight: 44,
      minWidth: 44,
    }));
  }
  expect(screen.getByTestId("behavior-map-scroll")).toHaveProp("horizontal", true);
  expect(screen.getByText("这些点没有先后高低，只是陪你一次看清一种感受。")).toBeTruthy();
  expect(screen.queryByText(/准备度|排名|分数|百分比|readiness|score/iu)).toBeNull();
});

test("uses the five catalog attitudes and saves the selected behavior without hierarchy", () => {
  const onSetAttitude = jest.fn();
  render(<BehaviorMapPage onComplete={jest.fn()} onSetAttitude={onSetAttitude} />);

  expect(screen.getByRole("radio", { name: "拥抱或依偎：我有些期待" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "拥抱或依偎：我想留到当时再感受" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "拥抱或依偎：我还没想清楚" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "拥抱或依偎：这不是我这次想要的" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "拥抱或依偎：暂时不回答" })).toBeTruthy();

  fireEvent.press(screen.getByRole("radio", { name: "拥抱或依偎：我有些期待" }));

  expect(onSetAttitude).toHaveBeenCalledWith("behavior-hug", "looking-forward");
  expect(screen.getByText("期待不代表已经答应，到了当时仍然需要彼此确认。")).toBeTruthy();
  expect(screen.getByText("当前选择：我有些期待")).toBeTruthy();
});

test("restores saved answers and changes the active point without implying progress", () => {
  render(
    <BehaviorMapPage
      initialAttitudes={{
        "behavior-hug": "looking-forward",
        "draft-kissing": "decide-in-moment",
        "behavior-same-bed": "unsure",
      }}
      initialPointId="behavior-map-same-bed"
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
    />,
  );

  fireEvent.press(screen.getByRole("radio", { name: "行为地图，第 3 项，共 9 项：同床" }));

  expect(screen.getByText("对于睡在同一张床上，此刻的你更接近哪种感觉？")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "睡在同一张床上：我还没想清楚" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
  expect(screen.getByText("当前选择：我还没想清楚")).toBeTruthy();
});

test("adds a trimmed custom behavior through an explicit labelled input", () => {
  const onAddCustomBehavior = jest.fn();
  render(
    <BehaviorMapPage
      createCustomBehaviorId={() => "custom-gentle-touch"}
      initialAttitudes={completeBaseAttitudes}
      initialPointId="behavior-map-custom"
      initialSensitiveContentConsent={false}
      onAddCustomBehavior={onAddCustomBehavior}
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
    />,
  );

  fireEvent.press(screen.getByRole("radio", { name: "行为地图，第 9 项，共 9 项：添加一个我在意的行为" }));
  fireEvent.changeText(screen.getByLabelText("我在意的自定义行为"), "  轻轻触碰手臂  ");
  fireEvent.press(screen.getByRole("button", { name: "添加这个行为" }));

  expect(onAddCustomBehavior).toHaveBeenCalledWith({ id: "custom-gentle-touch", label: "轻轻触碰手臂" });
  expect(screen.getByText("对于轻轻触碰手臂，此刻的你更接近哪种感觉？")).toBeTruthy();
});

test("shows non-color loading and error feedback and blocks duplicate saves", async () => {
  let rejectSave!: (reason?: unknown) => void;
  const onSetAttitude = jest.fn(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
  render(<BehaviorMapPage onComplete={jest.fn()} onSetAttitude={onSetAttitude} />);

  const choice = screen.getByRole("radio", { name: "拥抱或依偎：我还没想清楚" });
  fireEvent.press(choice);
  fireEvent.press(choice);
  expect(onSetAttitude).toHaveBeenCalledTimes(1);
  expect(screen.getByText("正在更新")).toBeTruthy();

  rejectSave(new Error("offline"));
  await waitFor(() => expect(screen.getByText("操作失败，请重试。")).toBeTruthy());
});

test("reports participation on completion without deriving a score from answers", () => {
  const onComplete = jest.fn();
  render(
    <BehaviorMapPage
      initialAttitudes={completeBaseAttitudes}
      initialPointId="behavior-map-custom"
      initialSensitiveContentConsent={false}
      onComplete={onComplete}
      onSetAttitude={jest.fn()}
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));

  expect(onComplete).toHaveBeenCalledWith({ participated: true });
  expect(screen.queryByText(/\+\d|分数|准备度|完成率/u)).toBeNull();
});

test("keeps future items unavailable and requires every base item to have an explicit answer", () => {
  const onComplete = jest.fn();
  render(<BehaviorMapPage onComplete={onComplete} onSetAttitude={jest.fn()} />);

  expect(screen.getByRole("radio", { name: "行为地图，第 3 项，共 9 项：同床" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  expect(screen.getByRole("button", { name: "记录这个感受，继续" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  expect(screen.queryByRole("button", { name: "带着这些感受继续" })).toBeNull();

  fireEvent.press(screen.getByRole("radio", { name: "拥抱或依偎：暂时不回答" }));
  fireEvent.press(screen.getByRole("button", { name: "记录这个感受，继续" }));

  expect(screen.getByText("对于接吻，此刻的你更接近哪种感觉？")).toBeTruthy();
  expect(onComplete).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "返回上一项" })).toBeTruthy();
});

test("gates sensitive details behind learn, explicit confirmation, and a persistence callback", async () => {
  const onSetSensitiveContentConsent = jest.fn();
  render(
    <BehaviorMapPage
      initialAttitudes={completeBaseAttitudes}
      initialPointId="behavior-map-more"
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
      onSetSensitiveContentConsent={onSetSensitiveContentConsent}
    />,
  );

  expect(screen.queryByText("口腔与私密部位的接触")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "了解内容后再决定" }));
  expect(screen.getByRole("checkbox", { name: "我选择查看这些具体行为" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "确认并查看" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));

  fireEvent.press(screen.getByRole("checkbox", { name: "我选择查看这些具体行为" }));
  fireEvent.press(screen.getByRole("button", { name: "确认并查看" }));
  await waitFor(() => expect(onSetSensitiveContentConsent).toHaveBeenCalledWith(true));
  expect(screen.getByText("口腔与私密部位的接触")).toBeTruthy();
  expect(screen.getByRole("button", { name: "继续到自定义行为" })).toBeTruthy();
});

test("lets the user decline sensitive details and persists that explicit choice", async () => {
  const onSetSensitiveContentConsent = jest.fn();
  render(
    <BehaviorMapPage
      initialAttitudes={completeBaseAttitudes}
      initialPointId="behavior-map-more"
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
      onSetSensitiveContentConsent={onSetSensitiveContentConsent}
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "这次不查看" }));

  await waitFor(() => expect(onSetSensitiveContentConsent).toHaveBeenCalledWith(false));
  expect(screen.getByText("添加一个我在意的行为")).toBeTruthy();
  expect(screen.queryByText("口腔与私密部位的接触")).toBeNull();
});

test("keeps a declined sensitive-content decision usable when navigating back", async () => {
  render(
    <BehaviorMapPage
      initialAttitudes={completeBaseAttitudes}
      initialPointId="behavior-map-more"
      onComplete={jest.fn()}
      onSetAttitude={jest.fn()}
      onSetSensitiveContentConsent={jest.fn()}
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "这次不查看" }));
  await waitFor(() => expect(screen.getByText("添加一个我在意的行为")).toBeTruthy());
  fireEvent.press(screen.getByRole("button", { name: "返回上一项" }));

  expect(screen.getByText("你选择了这次不查看具体行为。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "继续到自定义行为" })).toBeTruthy();
});
