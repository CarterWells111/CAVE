import { fireEvent, render, screen } from "@testing-library/react-native";

import {
  BodyKnowledgePage,
  BehaviorAttitudesPage,
  ChecklistPage,
  CommunicationCardPage,
  OvernightPage,
  PresetPracticePage,
  ReflectionPage,
  WelcomePage
} from "./JourneyPages";

test("Page 1 confirms adulthood, keeps the preface optional, and never asks for a birthday", () => {
  const onAdult = jest.fn();
  const onUnderage = jest.fn();
  render(<WelcomePage onAdult={onAdult} onOpenPreface={jest.fn()} onUnderage={onUnderage} resumeAvailable />);

  fireEvent.press(screen.getByText("我已满18岁"));
  fireEvent.press(screen.getByText("我未满18岁"));

  expect(onAdult).toHaveBeenCalledTimes(1);
  expect(onUnderage).toHaveBeenCalledTimes(1);
  expect(screen.getByText("继续本机旅程")).toBeTruthy();
  expect(screen.queryByText(/生日|出生日期/u)).toBeNull();
});

test("Page 3 keeps the draft medical diagram collapsed until requested and exposes sources", () => {
  const onRead = jest.fn();
  render(<BodyKnowledgePage
    cards={[{ id: "draft-knowledge-consent", title: "同意可以改变", sourceIds: ["draft-source-consent"] }]}
    onRead={onRead}
    onOpenDiagram={jest.fn()}
    onOpenSources={jest.fn()}
  />);

  expect(screen.queryByText("医学图示将在内容完善阶段替换")).toBeNull();
  fireEvent.press(screen.getByText("主动展开医学图示"));
  expect(screen.getByText("医学图示将在内容完善阶段替换")).toBeTruthy();
  fireEvent.press(screen.getByText("标记已读：同意可以改变"));
  expect(onRead).toHaveBeenCalledWith("draft-knowledge-consent");
});

test("Page 2 keeps expectations and concerns separate and accepts an optional note", () => {
  const onContinue = jest.fn();
  render(<OvernightPage
    expectationOptions={[{ id: "draft-rest", label: "好好休息" }]}
    concernOptions={[{ id: "draft-pressure", label: "担心被催促" }]}
    onContinue={onContinue}
  />);
  fireEvent.press(screen.getByText("好好休息"));
  fireEvent.press(screen.getByText("担心被催促"));
  fireEvent.changeText(screen.getByPlaceholderText("可选补充"), "需要安静空间");
  fireEvent.press(screen.getByText("继续"));

  expect(onContinue).toHaveBeenCalledWith({
    expectationIds: ["draft-rest"],
    concernIds: ["draft-pressure"],
    customNote: "需要安静空间"
  });
});

test("Page 4 offers all five non-ranked attitudes per behavior", () => {
  const onSet = jest.fn();
  render(<BehaviorAttitudesPage behaviors={[{ id: "draft-kissing", label: "亲吻" }]} onSet={onSet} />);

  expect(screen.getByText("期待")).toBeTruthy();
  expect(screen.getByText("到时决定")).toBeTruthy();
  expect(screen.getByText("不确定")).toBeTruthy();
  expect(screen.getByText("这次不要")).toBeTruthy();
  fireEvent.press(screen.getByText("暂时不回答"));
  expect(onSet).toHaveBeenCalledWith("draft-kissing", "skip");
});

test("Page 5 keeps cloud saving disabled and coming soon", () => {
  render(<ReflectionPage onComplete={jest.fn()} />);

  expect(screen.getByText("本机加密保存")).toBeTruthy();
  expect(screen.getByRole("button", { name: "云端保存（即将提供）" }).props.accessibilityState)
    .toEqual({ disabled: true });
});

test("Page 6 is visibly scripted and offers mirror practice plus a fullscreen pause card", () => {
  render(<PresetPracticePage
    phrase="我们可以慢一点吗？"
    onComplete={jest.fn()}
  />);

  expect(screen.getByText("预设对话 · 本地练习")).toBeTruthy();
  expect(screen.getByText("对镜练习")).toBeTruthy();
  fireEvent.press(screen.getByText("打开暂停卡"));
  expect(screen.getByText("暂停一下，我需要先感受和决定。")).toBeTruthy();
});

test("Page 7 is an editable review rather than a pass/fail checklist", () => {
  const onUpdate = jest.fn();
  render(<ChecklistPage
    items={[{ id: "checklist:expression", status: "prepare-more", userNote: "", label: "表达支持" }]}
    onUpdate={onUpdate}
    onFinish={jest.fn()}
  />);

  expect(screen.getByText("这不是需要全部勾选的通关表")).toBeTruthy();
  fireEvent.press(screen.getByText("已考虑"));
  expect(onUpdate).toHaveBeenCalledWith("checklist:expression", "considered", "");
});

test("Page 8 edits, saves, copies and shows the current card without adding a score", () => {
  const onSave = jest.fn();
  const onCopy = jest.fn();
  render(<CommunicationCardPage
    fields={[{ id: "boundaries", text: "请先问我", needsReview: true }]}
    pointTotal={25}
    onEdit={jest.fn()}
    onSave={onSave}
    onCopy={onCopy}
  />);

  expect(screen.getByText("根据妳刚才的选择整理")).toBeTruthy();
  expect(screen.getByText("需要复核")).toBeTruthy();
  fireEvent.press(screen.getByText("本机保存"));
  fireEvent.press(screen.getByText("复制当前卡片"));
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onCopy).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText("现场展示"));
  expect(screen.queryByText("本机保存")).toBeNull();
  expect(screen.getByText("请先问我")).toBeTruthy();
  expect(screen.queryByText(/准备度|score|percentage/iu)).toBeNull();
});
