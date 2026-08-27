import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

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
    .toEqual(expect.objectContaining({ disabled: true }));
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

test("Page 2 restores saved multi-select values and exposes checked state", () => {
  const onContinue = jest.fn();
  render(<OvernightPage
    concernOptions={[{ id: "pressure", label: "担心被催促" }]}
    expectationOptions={[{ id: "rest", label: "好好休息" }]}
    initialConcernIds={["pressure"]}
    initialCustomNote="需要安静空间"
    initialExpectationIds={["rest"]}
    onContinue={onContinue}
  />);

  expect(screen.getByRole("checkbox", { name: "好好休息" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("checkbox", { name: "担心被催促" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByDisplayValue("需要安静空间")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "继续" }));
  expect(onContinue).toHaveBeenCalledWith({
    concernIds: ["pressure"],
    customNote: "需要安静空间",
    expectationIds: ["rest"]
  });
});

test("Page 4 restores one non-ranked radio selection per behavior", () => {
  render(<BehaviorAttitudesPage
    behaviors={[{ id: "kissing", label: "亲吻" }]}
    initialAttitudes={{ kissing: "unsure" }}
    onContinue={jest.fn()}
    onSet={jest.fn()}
  />);

  expect(screen.getByRole("radio", { name: "亲吻：不确定" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("radio", { name: "亲吻：期待" }).props.accessibilityState.checked).toBe(false);
  expect(screen.queryByText(/准备度|readiness|score|percentage/iu)).toBeNull();
});

test("Page 5 restores multi-select, expression support, and local journal choices", () => {
  const onComplete = jest.fn();
  render(<ReflectionPage
    comfortNeedOptions={[{ id: "quiet", label: "安静空间" }]}
    initialComfortNeedIds={["quiet"]}
    initialExpressionSupportNeeded
    initialJournalSaveChoice="not-saved"
    initialMotivationIds={["curiosity"]}
    motivationOptions={[{ id: "curiosity", label: "了解自己" }]}
    onComplete={onComplete}
  />);

  expect(screen.getByRole("checkbox", { name: "了解自己" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("checkbox", { name: "安静空间" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("radio", { name: "我需要表达支持" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("radio", { name: "不另存为记录" }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "完成反思并继续" }));
  expect(onComplete).toHaveBeenCalledWith({
    comfortNeedIds: ["quiet"],
    expressionSupportNeeded: true,
    journalSaveChoice: "not-saved",
    motivationIds: ["curiosity"]
  });
});

test("Page 7 restores item status and notes with non-color selected state", () => {
  render(<ChecklistPage
    items={[{
      id: "checklist:expression",
      label: "表达支持",
      status: "prepare-more",
      userNote: "想先练习"
    }]}
    onFinish={jest.fn()}
    onUpdate={jest.fn()}
  />);

  expect(screen.getByRole("radio", { name: "表达支持：还想准备" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByText("已选择：还想准备")).toBeTruthy();
  expect(screen.getByLabelText("表达支持补充说明").props.value).toBe("想先练习");
});

test("Pages 3, 4 and 8 expose explicit continue or finish contracts", () => {
  const page3 = render(<BodyKnowledgePage
    cards={[]}
    onContinue={jest.fn()}
    onOpenDiagram={jest.fn()}
    onOpenSources={jest.fn()}
    onRead={jest.fn()}
  />);
  expect(screen.getByRole("button", { name: "继续" })).toBeTruthy();
  page3.unmount();

  const page4 = render(<BehaviorAttitudesPage
    behaviors={[]}
    onContinue={jest.fn()}
    onSet={jest.fn()}
  />);
  expect(screen.getByRole("button", { name: "继续" })).toBeTruthy();
  page4.unmount();

  render(<CommunicationCardPage
    fields={[]}
    onCopy={jest.fn()}
    onEdit={jest.fn()}
    onFinish={jest.fn()}
    onSave={jest.fn()}
    pointTotal={0}
  />);
  expect(screen.getByRole("button", { name: "完成旅程" })).toBeTruthy();
});

test("Page 6 explicitly discloses a preset conversation without AI", () => {
  render(<PresetPracticePage onComplete={jest.fn()} phrase="我们可以慢一点吗？" />);

  expect(screen.getByText("预设对话，不使用 AI")).toBeTruthy();
});

test("Page 8 keeps unavailable runtime capabilities and cloud visibly disabled", () => {
  render(<CommunicationCardPage
    capabilities={{
      canCopy: false,
      canPersistLocally: false,
      canShowFullscreen: false,
      cloudSaveAvailable: false
    }}
    fields={[]}
    onCopy={jest.fn()}
    onEdit={jest.fn()}
    onSave={jest.fn()}
    pointTotal={0}
    runtimeNotice={{ message: "Expo Go 中复制暂不可用" }}
  />);

  expect(screen.getByText("Expo Go 中复制暂不可用")).toBeTruthy();
  expect(screen.getByRole("button", { name: "本机保存" }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "复制当前卡片" }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "现场展示" }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "云端保存（即将提供）" }).props.accessibilityState.disabled).toBe(true);
});

function deferred() {
  let reject!: (reason?: unknown) => void;
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return { promise, reject, resolve };
}

test("Page 7 buffers a note until explicit save and guards an async failure", async () => {
  const pending = deferred();
  const onUpdate = jest.fn(() => pending.promise);
  render(<ChecklistPage
    items={[{
      id: "checklist:expression",
      label: "表达支持",
      status: "prepare-more",
      userNote: "想先练习"
    }]}
    onFinish={jest.fn()}
    onUpdate={onUpdate}
  />);

  fireEvent.changeText(screen.getByLabelText("表达支持补充说明"), "想先写下来");
  expect(screen.getByLabelText("表达支持补充说明").props.value).toBe("想先写下来");
  expect(onUpdate).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "保存表达支持补充说明" }));
  fireEvent.press(screen.getByRole("button", { name: "正在保存表达支持补充说明…" }));
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(onUpdate).toHaveBeenCalledWith("checklist:expression", "prepare-more", "想先写下来");
  expect(screen.getByRole("button", { name: "正在保存表达支持补充说明…" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ busy: true, disabled: true }));

  await act(async () => { pending.reject(new Error("private note failure")); });
  expect(await screen.findByText("保存补充说明失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private note failure")).toBeNull();
});

test("Page 8 buffers a field edit until explicit save and guards an async failure", async () => {
  const pending = deferred();
  const onEdit = jest.fn(() => pending.promise);
  render(<CommunicationCardPage
    fields={[{ id: "boundaries", needsReview: false, text: "请先问我" }]}
    onCopy={jest.fn()}
    onEdit={onEdit}
    onSave={jest.fn()}
    pointTotal={0}
  />);

  fireEvent.changeText(screen.getByLabelText("沟通卡字段：boundaries"), "请先得到我的同意");
  expect(screen.getByLabelText("沟通卡字段：boundaries").props.value).toBe("请先得到我的同意");
  expect(onEdit).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "保存字段：boundaries" }));
  fireEvent.press(screen.getByRole("button", { name: "正在保存字段：boundaries…" }));
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(onEdit).toHaveBeenCalledWith("boundaries", "请先得到我的同意");
  expect(screen.getByRole("button", { name: "正在保存字段：boundaries…" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ busy: true, disabled: true }));

  await act(async () => { pending.reject(new Error("private field failure")); });
  expect(await screen.findByText("保存字段失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private field failure")).toBeNull();
});

test("Page 7 completes with the latest visible items and avoids captured note state", () => {
  const onFinish = jest.fn();
  const onUpdate = jest.fn();
  render(<ChecklistPage
    items={[{
      id: "checklist:expression",
      label: "表达支持",
      status: "prepare-more",
      userNote: "旧说明"
    }]}
    onFinish={onFinish}
    onUpdate={onUpdate}
  />);

  const noteInput = screen.getByLabelText("表达支持补充说明");
  const consideredChoice = screen.getByRole("radio", { name: "表达支持：已考虑" });
  act(() => {
    fireEvent.changeText(noteInput, "当前可见说明");
    fireEvent.press(consideredChoice);
  });

  expect(onUpdate).toHaveBeenCalledWith("checklist:expression", "considered", "当前可见说明");
  fireEvent.press(screen.getByRole("button", { name: "完成回顾" }));
  expect(onFinish).toHaveBeenCalledWith([{
    id: "checklist:expression",
    label: "表达支持",
    status: "considered",
    userNote: "当前可见说明"
  }]);
});

test("Page 7 blocks completion while an update is pending and allows retry after rejection", async () => {
  const pending = deferred();
  const onFinish = jest.fn();
  const onUpdate = jest.fn()
    .mockImplementationOnce(() => pending.promise)
    .mockResolvedValueOnce(undefined);
  render(<ChecklistPage
    items={[{
      id: "checklist:expression",
      label: "表达支持",
      status: "prepare-more",
      userNote: ""
    }]}
    onFinish={onFinish}
    onUpdate={onUpdate}
  />);

  fireEvent.changeText(screen.getByLabelText("表达支持补充说明"), "待保存");
  fireEvent.press(screen.getByRole("button", { name: "保存表达支持补充说明" }));
  expect(screen.getByRole("button", { name: "完成回顾" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "完成回顾" }));
  expect(onFinish).not.toHaveBeenCalled();

  await act(async () => { pending.reject(new Error("private pending failure")); });
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "保存表达支持补充说明" }));
  });
  expect(onUpdate).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "完成回顾" }).props.accessibilityState.disabled).toBe(false);
});

test("Page 7 reconciles canonical props around dirty and committed items", async () => {
  const onUpdate = jest.fn().mockResolvedValue(undefined);
  const { rerender } = render(<ChecklistPage
    items={[
      { id: "expression", label: "表达支持", status: "prepare-more", userNote: "本机旧值" },
      { id: "logistics", label: "交通安排", status: "prepare-more", userNote: "交通旧值" }
    ]}
    onFinish={jest.fn()}
    onUpdate={onUpdate}
  />);

  fireEvent.changeText(screen.getByLabelText("表达支持补充说明"), "尚未提交的本机值");
  rerender(<ChecklistPage
    items={[
      { id: "expression", label: "表达支持", status: "considered", userNote: "过时服务端值" },
      { id: "logistics", label: "交通安排", status: "considered", userNote: "交通新值" }
    ]}
    onFinish={jest.fn()}
    onUpdate={onUpdate}
  />);

  expect(screen.getByLabelText("表达支持补充说明").props.value).toBe("尚未提交的本机值");
  expect(screen.getByLabelText("交通安排补充说明").props.value).toBe("交通新值");
  expect(screen.getByRole("radio", { name: "交通安排：已考虑" }).props.accessibilityState.checked).toBe(true);

  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "保存表达支持补充说明" }));
  });
  rerender(<ChecklistPage
    items={[
      { id: "expression", label: "表达支持", status: "considered", userNote: "已确认服务端值" },
      { id: "logistics", label: "交通安排", status: "considered", userNote: "交通新值" }
    ]}
    onFinish={jest.fn()}
    onUpdate={onUpdate}
  />);
  expect(screen.getByLabelText("表达支持补充说明").props.value).toBe("已确认服务端值");
  expect(screen.getByRole("radio", { name: "表达支持：已考虑" }).props.accessibilityState.checked).toBe(true);
});

test("Page 7 prevents reversed status commits for the same item", async () => {
  const first = deferred();
  const second = deferred();
  const onUpdate = jest.fn()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  render(<ChecklistPage
    items={[{ id: "expression", label: "表达支持", status: "prepare-more", userNote: "说明" }]}
    onFinish={jest.fn()}
    onUpdate={onUpdate}
  />);

  fireEvent.press(screen.getByRole("radio", { name: "表达支持：已考虑" }));
  expect(screen.getByRole("radio", { name: "表达支持：与我无关" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole("radio", { name: "表达支持：与我无关" }));
  expect(onUpdate).toHaveBeenCalledTimes(1);

  await act(async () => {
    second.resolve();
    first.resolve();
  });
  await act(async () => {
    fireEvent.press(screen.getByRole("radio", { name: "表达支持：与我无关" }));
  });
  expect(onUpdate).toHaveBeenCalledTimes(2);
  expect(onUpdate).toHaveBeenLastCalledWith("expression", "not-relevant", "说明");
  expect(screen.getByRole("radio", { name: "表达支持：与我无关" }).props.accessibilityState.checked).toBe(true);
});

test("Page 7 prevents a note commit from overtaking a status commit", async () => {
  const first = deferred();
  const second = deferred();
  const onUpdate = jest.fn()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  render(<ChecklistPage
    items={[{ id: "expression", label: "表达支持", status: "prepare-more", userNote: "旧说明" }]}
    onFinish={jest.fn()}
    onUpdate={onUpdate}
  />);

  fireEvent.press(screen.getByRole("radio", { name: "表达支持：已考虑" }));
  expect(screen.getByLabelText("表达支持补充说明").props.editable).toBe(false);
  expect(screen.getByRole("button", { name: "保存表达支持补充说明" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(screen.getByLabelText("表达支持补充说明"), "抢先说明");
  fireEvent.press(screen.getByRole("button", { name: "保存表达支持补充说明" }));
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("表达支持补充说明").props.value).toBe("旧说明");

  await act(async () => {
    second.resolve();
    first.resolve();
  });
  fireEvent.changeText(screen.getByLabelText("表达支持补充说明"), "后续说明");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "保存表达支持补充说明" }));
  });
  expect(onUpdate).toHaveBeenCalledTimes(2);
  expect(onUpdate).toHaveBeenLastCalledWith("expression", "considered", "后续说明");
});

test("Page 8 page actions receive the latest visible fields", () => {
  const onCopy = jest.fn();
  const onFinish = jest.fn();
  const onSave = jest.fn();
  render(<CommunicationCardPage
    fields={[{ id: "boundaries", needsReview: true, text: "旧表达" }]}
    onCopy={onCopy}
    onEdit={jest.fn()}
    onFinish={onFinish}
    onSave={onSave}
    pointTotal={0}
  />);

  fireEvent.changeText(screen.getByLabelText("沟通卡字段：boundaries"), "当前可见表达");
  const visibleFields = [{ id: "boundaries", needsReview: true, text: "当前可见表达" }];
  fireEvent.press(screen.getByRole("button", { name: "本机保存" }));
  fireEvent.press(screen.getByRole("button", { name: "复制当前卡片" }));
  fireEvent.press(screen.getByRole("button", { name: "完成旅程" }));

  expect(onSave).toHaveBeenCalledWith(visibleFields);
  expect(onCopy).toHaveBeenCalledWith(visibleFields);
  expect(onFinish).toHaveBeenCalledWith(visibleFields);
});

test("Page 8 blocks page actions while a field commit is pending and allows retry", async () => {
  const pending = deferred();
  const onCopy = jest.fn();
  const onEdit = jest.fn()
    .mockImplementationOnce(() => pending.promise)
    .mockResolvedValueOnce(undefined);
  const onFinish = jest.fn();
  const onSave = jest.fn();
  render(<CommunicationCardPage
    fields={[{ id: "boundaries", needsReview: false, text: "旧表达" }]}
    onCopy={onCopy}
    onEdit={onEdit}
    onFinish={onFinish}
    onSave={onSave}
    pointTotal={0}
  />);

  fireEvent.changeText(screen.getByLabelText("沟通卡字段：boundaries"), "待提交表达");
  fireEvent.press(screen.getByRole("button", { name: "保存字段：boundaries" }));
  expect(screen.getByRole("button", { name: "本机保存" }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "复制当前卡片" }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "完成旅程" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "本机保存" }));
  fireEvent.press(screen.getByRole("button", { name: "复制当前卡片" }));
  fireEvent.press(screen.getByRole("button", { name: "完成旅程" }));
  expect(onSave).not.toHaveBeenCalled();
  expect(onCopy).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();

  await act(async () => { pending.reject(new Error("private pending field failure")); });
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "保存字段：boundaries" }));
  });
  expect(onEdit).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "本机保存" }).props.accessibilityState.disabled).toBe(false);
  expect(screen.getByRole("button", { name: "复制当前卡片" }).props.accessibilityState.disabled).toBe(false);
  expect(screen.getByRole("button", { name: "完成旅程" }).props.accessibilityState.disabled).toBe(false);
});

test("Page 8 reconciles canonical props around dirty and committed fields", async () => {
  const onEdit = jest.fn().mockResolvedValue(undefined);
  const { rerender } = render(<CommunicationCardPage
    fields={[
      { id: "boundaries", needsReview: false, text: "边界旧值" },
      { id: "comfort", needsReview: true, text: "安心旧值" }
    ]}
    onCopy={jest.fn()}
    onEdit={onEdit}
    onSave={jest.fn()}
    pointTotal={0}
  />);

  fireEvent.changeText(screen.getByLabelText("沟通卡字段：boundaries"), "尚未提交的边界");
  rerender(<CommunicationCardPage
    fields={[
      { id: "boundaries", needsReview: false, text: "过时服务端边界" },
      { id: "comfort", needsReview: false, text: "安心新值" }
    ]}
    onCopy={jest.fn()}
    onEdit={onEdit}
    onSave={jest.fn()}
    pointTotal={0}
  />);

  expect(screen.getByLabelText("沟通卡字段：boundaries").props.value).toBe("尚未提交的边界");
  expect(screen.getByLabelText("沟通卡字段：comfort").props.value).toBe("安心新值");

  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "保存字段：boundaries" }));
  });
  rerender(<CommunicationCardPage
    fields={[
      { id: "boundaries", needsReview: false, text: "已确认服务端边界" },
      { id: "comfort", needsReview: false, text: "安心新值" }
    ]}
    onCopy={jest.fn()}
    onEdit={onEdit}
    onSave={jest.fn()}
    pointTotal={0}
  />);
  expect(screen.getByLabelText("沟通卡字段：boundaries").props.value).toBe("已确认服务端边界");
});

test("Page 8 blocks fullscreen and preserves a field error while a field commit is pending", async () => {
  const pending = deferred();
  render(<CommunicationCardPage
    fields={[{ id: "boundaries", needsReview: false, text: "待保存字段" }]}
    onCopy={jest.fn()}
    onEdit={jest.fn(() => pending.promise)}
    onSave={jest.fn()}
    pointTotal={0}
  />);

  fireEvent.press(screen.getByRole("button", { name: "保存字段：boundaries" }));
  expect(screen.getByRole("button", { name: "现场展示" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "现场展示" }));
  expect(screen.queryByRole("button", { name: "退出展示" })).toBeNull();

  await act(async () => { pending.reject(new Error("private field fullscreen failure")); });
  expect(await screen.findByText("保存字段失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private field fullscreen failure")).toBeNull();
});

test("Page 8 blocks fullscreen and preserves a save error while local save is pending", async () => {
  const pending = deferred();
  render(<CommunicationCardPage
    fields={[]}
    onCopy={jest.fn()}
    onEdit={jest.fn()}
    onSave={jest.fn(() => pending.promise)}
    pointTotal={0}
  />);

  fireEvent.press(screen.getByRole("button", { name: "本机保存" }));
  expect(screen.getByRole("button", { name: "现场展示" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "现场展示" }));
  expect(screen.queryByRole("button", { name: "退出展示" })).toBeNull();

  await act(async () => { pending.reject(new Error("private save fullscreen failure")); });
  expect(await screen.findByText("本机保存失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private save fullscreen failure")).toBeNull();
});

test("Page 8 prevents finish from overtaking local save", async () => {
  const pending = deferred();
  const onFinish = jest.fn();
  render(<CommunicationCardPage
    fields={[]}
    onCopy={jest.fn()}
    onEdit={jest.fn()}
    onFinish={onFinish}
    onSave={jest.fn(() => pending.promise)}
    pointTotal={0}
  />);

  fireEvent.press(screen.getByRole("button", { name: "本机保存" }));
  expect(screen.getByRole("button", { name: "完成旅程" }).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByRole("button", { name: "完成旅程" }));
  expect(onFinish).not.toHaveBeenCalled();

  await act(async () => { pending.resolve(); });
  fireEvent.press(screen.getByRole("button", { name: "完成旅程" }));
  expect(onFinish).toHaveBeenCalledWith([]);
});

test("Page 8 disables a pending copy action, prevents duplicates, and exposes a safe error", async () => {
  const pending = deferred();
  const onCopy = jest.fn(() => pending.promise);
  render(<CommunicationCardPage
    fields={[]}
    onCopy={onCopy}
    onEdit={jest.fn()}
    onSave={jest.fn()}
    pointTotal={0}
  />);

  fireEvent.press(screen.getByRole("button", { name: "复制当前卡片" }));
  fireEvent.press(screen.getByRole("button", { name: "正在复制…" }));
  expect(onCopy).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "正在复制…" }).props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );

  await act(async () => { pending.reject(new Error("private raw failure")); });
  expect(await screen.findByText("复制失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private raw failure")).toBeNull();
});

test("Page actions render externally injected loading and error feedback", () => {
  const { rerender } = render(<OvernightPage
    actionState={{ status: "loading", message: "正在保存选择…" }}
    concernOptions={[]}
    expectationOptions={[]}
    onContinue={jest.fn()}
  />);

  expect(screen.getByRole("button", { name: "正在继续…" }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByText("正在保存选择…")).toBeTruthy();

  rerender(<OvernightPage
    actionState={{ status: "error", message: "保存失败，请重试。" }}
    concernOptions={[]}
    expectationOptions={[]}
    onContinue={jest.fn()}
  />);
  expect(screen.getByText("保存失败，请重试。")).toBeTruthy();
});

test("labels text inputs and gives choices at least a 44 point touch target", () => {
  const page2 = render(<OvernightPage
    concernOptions={[]}
    expectationOptions={[{ id: "rest", label: "好好休息" }]}
    onContinue={jest.fn()}
  />);
  expect(screen.getByLabelText("过夜情境可选补充").props.multiline).toBe(true);
  const choiceStyle = StyleSheet.flatten(screen.getByRole("checkbox", { name: "好好休息" }).props.style);
  expect(choiceStyle).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
  page2.unmount();

  const page6 = render(<PresetPracticePage onComplete={jest.fn()} phrase="先暂停一下。" />);
  expect(screen.getByLabelText("练习表达").props.multiline).toBe(true);
  page6.unmount();

  render(<CommunicationCardPage
    fields={[{ id: "boundaries", needsReview: false, text: "请先问我" }]}
    onCopy={jest.fn()}
    onEdit={jest.fn()}
    onSave={jest.fn()}
    pointTotal={0}
  />);
  expect(screen.getByLabelText("沟通卡字段：boundaries").props.multiline).toBe(true);
});
