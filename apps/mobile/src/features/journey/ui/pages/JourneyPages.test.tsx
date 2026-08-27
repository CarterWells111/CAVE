import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

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

test("Page 2 hydrates saved expectations, concerns, and the custom note", () => {
  const onContinue = jest.fn();
  render(<OvernightPage
    expectationOptions={[
      { id: "draft-rest", label: "好好休息" },
      { id: "draft-connect", label: "更亲近" }
    ]}
    concernOptions={[
      { id: "draft-pressure", label: "担心被催促" },
      { id: "draft-sleep", label: "睡不好" }
    ]}
    initialExpectationIds={["draft-rest"]}
    initialConcernIds={["draft-pressure"]}
    initialCustomNote="需要安静空间"
    onContinue={onContinue}
  />);

  expect(screen.getByRole("checkbox", { name: "好好休息" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("checkbox", { name: "担心被催促" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByDisplayValue("需要安静空间")).toBeTruthy();
  fireEvent.press(screen.getByText("更亲近"));
  fireEvent.press(screen.getByText("继续"));

  expect(onContinue).toHaveBeenCalledWith({
    expectationIds: ["draft-rest", "draft-connect"],
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

test("Page 4 exposes each current attitude visibly and accessibly without ranking", () => {
  render(<BehaviorAttitudesPage
    behaviors={[{ id: "draft-kissing", label: "亲吻" }]}
    currentAttitudes={{ "draft-kissing": "unsure" }}
    onSet={jest.fn()}
  />);

  expect(screen.getByText("当前选择：不确定")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "不确定" }).props.accessibilityState.checked).toBe(true);
  expect(screen.queryByText(/第\s*\d|排名|分数/u)).toBeNull();
});

test("Page 5 keeps cloud saving disabled and coming soon", () => {
  render(<ReflectionPage onComplete={jest.fn()} />);

  expect(screen.getByText("本机加密保存")).toBeTruthy();
  expect(screen.getByRole("button", { name: "云端保存（即将提供）" }).props.accessibilityState)
    .toEqual({ disabled: true });
});

test("Page 5 hydrates and edits reflection choices from catalog-backed props", () => {
  const onComplete = jest.fn();
  render(<ReflectionPage
    motivationOptions={[
      { id: "draft-curious", label: "好奇" },
      { id: "draft-connect", label: "想更亲近" }
    ]}
    comfortNeedOptions={[
      { id: "draft-privacy", label: "隐私" },
      { id: "draft-time", label: "有时间慢慢决定" }
    ]}
    initialMotivationIds={["draft-curious"]}
    initialComfortNeedIds={["draft-privacy"]}
    initialExpressionSupportNeeded={true}
    initialJournalSaveChoice="not-saved"
    onComplete={onComplete}
  />);

  expect(screen.getByRole("checkbox", { name: "好奇" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("checkbox", { name: "隐私" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("radio", { name: "需要表达支持" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("radio", { name: "不保存反思记录" }).props.accessibilityState.checked).toBe(true);

  fireEvent.press(screen.getByText("想更亲近"));
  fireEvent.press(screen.getByText("有时间慢慢决定"));
  fireEvent.press(screen.getByText("不需要表达支持"));
  fireEvent.press(screen.getByText("本机加密保存"));
  fireEvent.press(screen.getByText("完成反思"));

  expect(onComplete).toHaveBeenCalledWith({
    motivationIds: ["draft-curious", "draft-connect"],
    comfortNeedIds: ["draft-privacy", "draft-time"],
    expressionSupportNeeded: false,
    journalSaveChoice: "device"
  });
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

test("Page 7 hydrates and submits an editable user note", () => {
  const onUpdate = jest.fn();
  render(<ChecklistPage
    items={[{ id: "checklist:expression", status: "prepare-more", userNote: "先准备一句暂停表达", label: "表达支持" }]}
    onUpdate={onUpdate}
    onFinish={jest.fn()}
  />);

  const note = screen.getByDisplayValue("先准备一句暂停表达");
  expect(screen.getByLabelText("表达支持补充说明（checklist:expression）")).toBe(note);
  fireEvent.changeText(note, "先告诉对方我要慢一点");
  fireEvent.press(screen.getByText("已考虑"));

  expect(onUpdate).toHaveBeenCalledWith("checklist:expression", "considered", "先告诉对方我要慢一点");
});

test("Page 7 flushes an edited note before finishing without a status change", async () => {
  const onUpdate = jest.fn();
  const onFinish = jest.fn();
  render(<ChecklistPage
    items={[{ id: "checklist:expression", status: "prepare-more", userNote: "", label: "表达支持" }]}
    onUpdate={onUpdate}
    onFinish={onFinish}
  />);

  fireEvent.changeText(screen.getByPlaceholderText("补充说明（可选）"), "完成前保存这句");
  fireEvent.press(screen.getByText("完成回顾"));

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(onUpdate).toHaveBeenCalledWith("checklist:expression", "prepare-more", "完成前保存这句");
  expect(onUpdate.mock.invocationCallOrder[0]).toBeLessThan(onFinish.mock.invocationCallOrder[0]!);
});

test("Page 7 retains a rejected status-and-note update for a finish retry", async () => {
  const onUpdate = jest.fn()
    .mockRejectedValueOnce(new Error("write failed"))
    .mockResolvedValueOnce(undefined);
  const onFinish = jest.fn();
  render(<ChecklistPage
    items={[{ id: "checklist:expression", status: "prepare-more", userNote: "", label: "表达支持" }]}
    onUpdate={onUpdate}
    onFinish={onFinish}
  />);

  fireEvent.changeText(screen.getByPlaceholderText("补充说明（可选）"), "失败后仍要保存");
  fireEvent.press(screen.getByText("已考虑"));
  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  expect(onFinish).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("完成回顾"));

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(onUpdate).toHaveBeenNthCalledWith(2, "checklist:expression", "considered", "失败后仍要保存");
});

test("Page 7 persists a newer edit made while finish is awaiting an older write", async () => {
  let resolveOlderWrite: (() => void) | undefined;
  const olderWrite = new Promise<void>((resolve) => { resolveOlderWrite = resolve; });
  const onUpdate = jest.fn()
    .mockReturnValueOnce(olderWrite)
    .mockResolvedValueOnce(undefined);
  const onFinish = jest.fn();
  render(<ChecklistPage
    items={[{ id: "checklist:expression", status: "prepare-more", userNote: "", label: "表达支持" }]}
    onUpdate={onUpdate}
    onFinish={onFinish}
  />);
  const note = screen.getByPlaceholderText("补充说明（可选）");

  fireEvent.changeText(note, "较早的说明");
  fireEvent.press(screen.getByText("完成回顾"));
  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  fireEvent.changeText(note, "等待时更新的说明");
  resolveOlderWrite?.();

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(onUpdate).toHaveBeenNthCalledWith(2, "checklist:expression", "prepare-more", "等待时更新的说明");
  expect(onUpdate.mock.invocationCallOrder[1]).toBeLessThan(onFinish.mock.invocationCallOrder[0]!);
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

test("Page 8 exposes a structured clipboard failure as an accessible status", () => {
  render(<CommunicationCardPage
    fields={[]}
    pointTotal={0}
    copyState={{ status: "error", code: "clipboard-write-failed" }}
    onEdit={jest.fn()}
    onSave={jest.fn()}
    onCopy={jest.fn()}
  />);

  expect(screen.getByText("复制失败，请重试")).toBeTruthy();
  expect(screen.getByText("复制失败，请重试").props.accessibilityLiveRegion).toBe("assertive");
});

test("Page 8 shows clipboard pending state and disables duplicate copy actions", () => {
  render(<CommunicationCardPage
    fields={[]}
    pointTotal={0}
    copyState={{ status: "pending" }}
    onEdit={jest.fn()}
    onSave={jest.fn()}
    onCopy={jest.fn()}
  />);

  expect(screen.getByText("正在复制…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "复制当前卡片" }).props.accessibilityState.disabled).toBe(true);
});

test("Page 8 shows clipboard success state", () => {
  render(<CommunicationCardPage
    fields={[]}
    pointTotal={0}
    copyState={{ status: "success" }}
    onEdit={jest.fn()}
    onSave={jest.fn()}
    onCopy={jest.fn()}
  />);

  expect(screen.getByText("已复制")).toBeTruthy();
  expect(screen.getByText("已复制").props.accessibilityLiveRegion).toBe("polite");
});
