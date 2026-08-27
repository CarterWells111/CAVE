import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { BehaviorMapPage } from "./behavior-map-page";

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
      initialAttitudes={{ "behavior-same-bed": "unsure" }}
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
      initialAttitudes={{ "behavior-hug": "not-this-time" }}
      onComplete={onComplete}
      onSetAttitude={jest.fn()}
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "带着这些感受继续" }));

  expect(onComplete).toHaveBeenCalledWith({ participated: true });
  expect(screen.queryByText(/\+\d|分数|准备度|完成率/u)).toBeNull();
});
