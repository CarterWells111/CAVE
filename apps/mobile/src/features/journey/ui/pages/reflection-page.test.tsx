import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ScrollView, StyleSheet } from "react-native";

import { ReflectionPage } from "./reflection-page";

test("uses catalog motivations and opens the non-judgmental disappointment reflection", () => {
  render(<ReflectionPage onComplete={jest.fn()} />);

  expect(screen.getByRole("checkbox", { name: "我自己有所期待" })).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "我不希望对方失望" })).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "暂时不回答" })).toBeTruthy();
  expect(screen.queryByText("如果暂时不用担心对方会不会失望，你此刻还想靠近吗？")).toBeNull();

  fireEvent.press(screen.getByRole("checkbox", { name: "我不希望对方失望" }));

  expect(screen.getByText("顾及对方的感受，并不意味着你做错了什么。你仍然可以放慢、暂停或改变主意。")).toBeTruthy();
  expect(screen.getByText("如果暂时不用担心对方会不会失望，你此刻还想靠近吗？")).toBeTruthy();
  expect(screen.getAllByRole("radio", { name: /^如果不用担心失望：/u })).toHaveLength(5);
  expect(screen.queryByText(/\d+\s*分|准备度[:：]\s*\d|正确动机/u)).toBeNull();
});

test("shows a distinct refusal-safety response without diagnosing danger", () => {
  render(<ReflectionPage onComplete={jest.fn()} />);

  fireEvent.press(screen.getByRole("radio", { name: "拒绝或离开：我担心对方会有不好的反应" }));

  expect(screen.getByText("如果说不、暂停或离开让你感到害怕，可以先把自己的安全和空间放在前面。你不需要马上作出关于亲密行为的决定。")).toBeTruthy();
  expect(screen.getByText("这不代表系统已经判断现实中正在发生危险。")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "拒绝或离开：我担心对方会有不好的反应" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
});

test("captures expression difficulty, comfort clarity, selections, and a multiline note", () => {
  const onComplete = jest.fn();
  render(<ReflectionPage onComplete={onComplete} />);

  fireEvent.press(screen.getByRole("radio", { name: "表达变化：我可能需要一句更容易说出口的话" }));
  expect(screen.getByText("下一步会给你几句可以直接使用、也可以修改的表达。")).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "安心清晰度：我大致知道" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "希望每次变化前先问我" }));
  fireEvent.changeText(screen.getByLabelText("安心条件补充"), "先问我，再慢一点");
  fireEvent.press(screen.getByRole("button", { name: "带着这些发现去练习" }));

  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    comfortClarity: "mostly-clear",
    comfortNeedIds: ["comfort-ask-before-change"],
    comfortNote: "先问我，再慢一点",
    expressionDifficulty: "needs-phrase",
  }));
  expect(screen.getByLabelText("安心条件补充")).toHaveProp("multiline", true);
});

test("states local journal limits honestly and keeps cloud visibly unavailable", () => {
  render(<ReflectionPage onComplete={jest.fn()} />);

  expect(screen.getByText("只保存在这台设备")).toBeTruthy();
  expect(screen.getByText("记录不会上传到云端。更换设备、删除 App 或清除数据后，可能无法找回。")).toBeTruthy();
  expect(screen.getByText("如果其他人能够打开你的设备和 CAVE，也可能看到这些记录。")).toBeTruthy();
  expect(screen.getByRole("button", { name: "同时保存到云端｜后续版本" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  expect(screen.queryByText(/端到端加密|绝对私密|永久删除/u)).toBeNull();
  expect(screen.getByLabelText("给此刻留一句话")).toHaveProp("multiline", true);
});

test("restores an interrupted reflection and submits the complete local-only payload", () => {
  const onComplete = jest.fn();
  render(
    <ReflectionPage
      initialValue={{
        motivationIds: ["motivation-avoid-disappointment"],
        pressureWithoutDisappointment: "slow-down",
        refusalSafety: "difficult-but-possible",
        expressionDifficulty: "not-ready",
        comfortClarity: "need-space",
        comfortNeedIds: ["comfort-no-pressure-after-pause"],
        comfortNote: "需要自己的空间",
        journalPromptId: "journal-hesitation",
        journalText: "我还想慢一点",
        journalSaveChoice: "not-saved",
      }}
      onComplete={onComplete}
    />,
  );

  expect(screen.getByRole("checkbox", { name: "我不希望对方失望" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
  expect(screen.getByRole("radio", { name: "如果不用担心失望：也许想，但希望慢一点" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
  expect(screen.getByDisplayValue("需要自己的空间")).toBeTruthy();
  expect(screen.getByDisplayValue("我还想慢一点")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "暂时不保存" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));

  fireEvent.press(screen.getByRole("button", { name: "带着这些发现去练习" }));
  expect(onComplete).toHaveBeenCalledWith({
    motivationIds: ["motivation-avoid-disappointment"],
    pressureWithoutDisappointment: "slow-down",
    refusalSafety: "difficult-but-possible",
    expressionDifficulty: "not-ready",
    comfortClarity: "need-space",
    comfortNeedIds: ["comfort-no-pressure-after-pause"],
    comfortNote: "需要自己的空间",
    journalPromptId: "journal-hesitation",
    journalText: "我还想慢一点",
    journalSaveChoice: "not-saved",
  });
});

test("keeps page content text-scalable, shell-scrollable, and controls at least 44 points", () => {
  render(<ReflectionPage onComplete={jest.fn()} />);

  expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
  const refusal = screen.getByRole("radio", { name: "拒绝或离开：可以" });
  expect(StyleSheet.flatten(refusal.props.style)).toEqual(expect.objectContaining({
    minHeight: expect.any(Number),
    minWidth: 44,
  }));
  expect(StyleSheet.flatten(refusal.props.style).minHeight).toBeGreaterThanOrEqual(44);
  expect(screen.getByText("你准备了多少，不代表你做得好不好").props.numberOfLines).toBeUndefined();
});

test("exposes visible loading and error states for the final local action", async () => {
  const onComplete = jest.fn(() => Promise.reject(new Error("save failed")));
  render(<ReflectionPage onComplete={onComplete} />);

  fireEvent.press(screen.getByRole("button", { name: "带着这些发现去练习" }));
  expect(screen.getByText("正在保存这些发现…")).toBeTruthy();
  await waitFor(() => expect(screen.getByText("保存反思失败，请重试。")).toBeTruthy());
});
