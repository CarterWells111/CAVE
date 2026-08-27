import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { startTransition, Suspense, type ReactElement, type ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { brand } from "../../../../config/brand";
import { theme } from "../../../../core/design/theme";

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

function PendingRender({ promise }: { promise: Promise<void> }): ReactNode {
  throw promise;
}

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

  expect(screen.getByRole("radio", { name: "亲吻：期待" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "亲吻：到时决定" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "亲吻：不确定" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "亲吻：这次不要" })).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "亲吻：暂时不回答" }));
  expect(onSet).toHaveBeenCalledWith("draft-kissing", "skip");
});

test("Page 4 exposes each current attitude visibly and accessibly without ranking", () => {
  render(<BehaviorAttitudesPage
    behaviors={[{ id: "draft-kissing", label: "亲吻" }]}
    currentAttitudes={{ "draft-kissing": "unsure" }}
    onSet={jest.fn()}
  />);

  expect(screen.getByText("当前选择：不确定")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "亲吻：不确定" }).props.accessibilityState.checked).toBe(true);
  expect(screen.queryByText(/第\s*\d|排名|分数/u)).toBeNull();
});

test("Page 5 keeps cloud saving disabled and coming soon", () => {
  render(<ReflectionPage onComplete={jest.fn()} />);

  expect(screen.getByText("本机加密保存")).toBeTruthy();
  expect(screen.getByRole("button", { name: "云端保存（即将提供）" }).props.accessibilityState)
    .toEqual(expect.objectContaining({ disabled: true }));
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
  fireEvent.press(screen.getByRole("radio", { name: "不需要表达支持" }));
  fireEvent.press(screen.getByText("本机加密保存"));
  fireEvent.press(screen.getByRole("button", { name: "完成反思并继续" }));

  expect(onComplete).toHaveBeenCalledWith({
    motivationIds: ["draft-curious", "draft-connect"],
    comfortNeedIds: ["draft-privacy", "draft-time"],
    expressionSupportNeeded: false,
    journalSaveChoice: "device"
  });
});

test("Page 6 submits the behavior, intent, phrase, and partner response chosen by the user", () => {
  const onComplete = jest.fn();
  render(<PresetPracticePage
    behaviors={[
      { id: "draft-kissing", label: "亲吻" },
      { id: "draft-penetrative-sex", label: "插入式性行为" }
    ]}
    branches={[
      { branch: "supportive", label: "对方愿意配合" },
      { branch: "disappointed-follow-up", label: "对方失望，需要再次表达" }
    ]}
    intents={[
      { intent: "slow-down", label: "放慢节奏", phraseId: "draft-phrase-slow-down", phrase: "我们可以慢一点吗？" },
      { intent: "stop-current-action", label: "停止当前行为", phraseId: "draft-phrase-stop-current", phrase: "我想停下现在这件事。" }
    ]}
    onComplete={onComplete}
  />);

  fireEvent.press(screen.getByText("插入式性行为"));
  fireEvent.press(screen.getByText("停止当前行为"));
  fireEvent.press(screen.getByText("对方失望，需要再次表达"));
  fireEvent.changeText(screen.getByDisplayValue("我想停下现在这件事。"), "现在先停下来。 ");
  fireEvent.press(screen.getByText("采用这句话"));

  expect(onComplete).toHaveBeenCalledWith({
    behaviorId: "draft-penetrative-sex",
    intent: "stop-current-action",
    phraseId: "draft-phrase-stop-current",
    editedPhrase: "现在先停下来。 ",
    branch: "disappointed-follow-up"
  });
});

test("Page 6 wires mirror practice and the fullscreen pause card to visible local states", () => {
  render(<PresetPracticePage
    behaviors={[{ id: "draft-kissing", label: "亲吻" }]}
    branches={[{ branch: "supportive", label: "对方愿意配合" }]}
    intents={[{ intent: "slow-down", label: "放慢节奏", phraseId: "draft-phrase-slow-down", phrase: "我们可以慢一点吗？" }]}
    onComplete={jest.fn()}
  />);

  expect(screen.getByText("预设对话 · 本地练习")).toBeTruthy();
  fireEvent.press(screen.getByText("开始对镜练习"));
  expect(screen.getByText("对镜练习中")).toBeTruthy();
  fireEvent.press(screen.getByText("结束对镜练习"));
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
  fireEvent.press(screen.getByRole("radio", { name: "表达支持：已考虑" }));
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
  expect(screen.getByLabelText("表达支持补充说明")).toBe(note);
  expect(screen.queryByLabelText(/checklist:/u)).toBeNull();
  fireEvent.changeText(note, "先告诉对方我要慢一点");
  fireEvent.press(screen.getByRole("radio", { name: "表达支持：已考虑" }));

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
  fireEvent.press(screen.getByRole("radio", { name: "表达支持：已考虑" }));
  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  expect(onFinish).not.toHaveBeenCalled();

  await waitFor(() => expect(
    screen.getByRole("button", { name: "完成回顾" }).props.accessibilityState.disabled
  ).toBe(false));
  fireEvent.press(screen.getByText("完成回顾"));

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(onUpdate).toHaveBeenNthCalledWith(2, "checklist:expression", "considered", "失败后仍要保存");
});

test("Page 7 blocks a newer edit while finish is awaiting an older write", async () => {
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
  expect(screen.getByPlaceholderText("补充说明（可选）").props.editable).toBe(false);
  fireEvent.changeText(note, "等待时更新的说明");
  resolveOlderWrite?.();

  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(onUpdate).toHaveBeenCalledWith("checklist:expression", "prepare-more", "较早的说明");
});

test("Page 7 blocks edits to every item while finish is persisting another item", async () => {
  let resolveFirstWrite: (() => void) | undefined;
  const firstWrite = new Promise<void>((resolve) => { resolveFirstWrite = resolve; });
  const onUpdate = jest.fn().mockReturnValueOnce(firstWrite);
  const onFinish = jest.fn();
  render(<ChecklistPage
    items={[
      { id: "checklist:expression", status: "prepare-more", userNote: "", label: "表达支持" },
      { id: "checklist:setting", status: "not-relevant", userNote: "原说明", label: "环境支持" }
    ]}
    onUpdate={onUpdate}
    onFinish={onFinish}
  />);
  const [firstNote, secondNote] = screen.getAllByPlaceholderText("补充说明（可选）");

  fireEvent.changeText(firstNote!, "完成前保存");
  fireEvent.press(screen.getByText("完成回顾"));
  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));

  expect(secondNote!.props.editable).toBe(false);
  fireEvent.changeText(secondNote!, "完成期间不应接收");
  expect(screen.getByDisplayValue("原说明")).toBe(secondNote);

  resolveFirstWrite?.();
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(onFinish).toHaveBeenCalledWith([
    { id: "checklist:expression", status: "prepare-more", userNote: "完成前保存", label: "表达支持" },
    { id: "checklist:setting", status: "not-relevant", userNote: "原说明", label: "环境支持" }
  ]);
});

test("Page 7 finish ignores checklist props from a suspended transition", async () => {
  const blockedRender = new Promise<void>(() => undefined);
  const onFinish = jest.fn();
  const view = render(
    <Suspense fallback={null}>
      <ChecklistPage
        items={[{ id: "visible", status: "considered", userNote: "可见", label: "可见项目" }]}
        onUpdate={jest.fn()}
        onFinish={onFinish}
      />
    </Suspense>
  );

  await act(async () => {
    startTransition(() => {
      view.rerender(
        <Suspense fallback={null}>
          <ChecklistPage
            items={[{ id: "suspended", status: "not-relevant", userNote: "未提交", label: "未提交项目" }]}
            onUpdate={jest.fn()}
            onFinish={onFinish}
          />
          <PendingRender promise={blockedRender} />
        </Suspense>
      );
    });
  });

  expect(screen.getByText("可见项目")).toBeTruthy();
  fireEvent.press(screen.getByText("完成回顾"));
  await waitFor(() => expect(onFinish).toHaveBeenCalledWith([
    { id: "visible", status: "considered", userNote: "可见", label: "可见项目" }
  ]));
  view.unmount();
});

test("Page 8 save ignores card fields from a suspended transition", async () => {
  const blockedRender = new Promise<void>(() => undefined);
  const onSave = jest.fn();
  const view = render(
    <Suspense fallback={null}>
      <CommunicationCardPage
        fields={[{ id: "visible", text: "可见内容", needsReview: false }]}
        pointTotal={0}
        onEdit={jest.fn()}
        onSave={onSave}
        onCopy={jest.fn()}
      />
    </Suspense>
  );

  await act(async () => {
    startTransition(() => {
      view.rerender(
        <Suspense fallback={null}>
          <CommunicationCardPage
            fields={[{ id: "suspended", text: "未提交内容", needsReview: true }]}
            pointTotal={0}
            onEdit={jest.fn()}
            onSave={onSave}
            onCopy={jest.fn()}
          />
          <PendingRender promise={blockedRender} />
        </Suspense>
      );
    });
  });

  expect(screen.getByDisplayValue("可见内容")).toBeTruthy();
  fireEvent.press(screen.getByText("本机保存"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith([
    { id: "visible", text: "可见内容", needsReview: false }
  ]));
  view.unmount();
});

test("Page 8 edits, saves, copies and shows the current card without adding a score", async () => {
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
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
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

  const errorStatus = screen.getByRole("alert");
  expect(errorStatus).toHaveAccessibleName("× 复制失败，请重试");
  expect(errorStatus).toHaveTextContent(/复制失败，请重试/u);
  expect(errorStatus.props.accessibilityLiveRegion).toBe("assertive");
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

  expect(screen.getByRole("button", { name: "正在复制…" }).props.accessibilityState.disabled).toBe(true);
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

  const successStatus = screen.getByLabelText("✓ 已复制");
  expect(successStatus.props.accessibilityLiveRegion).toBe("polite");
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
  expect(screen.getByRole("radio", { name: "需要表达支持" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("radio", { name: "不保存反思记录" }).props.accessibilityState.checked).toBe(true);
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
  render(<PresetPracticePage
    behaviors={[{ id: "kissing", label: "亲吻" }]}
    branches={[{ branch: "supportive", label: "支持" }]}
    intents={[{
      intent: "slow-down",
      label: "慢一点",
      phrase: "我们可以慢一点吗？",
      phraseId: "phrase-slow"
    }]}
    onComplete={jest.fn()}
  />);

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

test("Page 8 auto-persists a field edit and keeps a safe visible failure", async () => {
  const pending = deferred();
  const onEdit = jest.fn(() => pending.promise);
  render(<CommunicationCardPage
    fields={[{ id: "boundaries", needsReview: false, text: "请先问我" }]}
    onCopy={jest.fn()}
    onEdit={onEdit}
    onSave={jest.fn()}
    pointTotal={0}
  />);

  fireEvent.changeText(screen.getByLabelText("沟通卡字段：不希望"), "请先得到我的同意");
  expect(screen.getByLabelText("沟通卡字段：不希望").props.value).toBe("请先得到我的同意");
  expect(onEdit).toHaveBeenCalledTimes(1);

  expect(onEdit).toHaveBeenCalledWith("boundaries", "请先得到我的同意");

  await act(async () => { pending.reject(new Error("private field failure")); });
  expect(await screen.findByText("更改尚未保存，请重试。")).toBeTruthy();
  expect(screen.queryByText("private field failure")).toBeNull();
});

test("Page 7 completes with the latest visible items and avoids captured note state", async () => {
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
  await waitFor(() => expect(onFinish).toHaveBeenCalledWith([{
    id: "checklist:expression",
    label: "表达支持",
    status: "considered",
    userNote: "当前可见说明"
  }]));
});

test("Page 7 queues completion behind an update and allows retry after rejection", async () => {
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
  expect(screen.getByRole("button", { name: "完成回顾" }).props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByRole("button", { name: "完成回顾" }));
  expect(onFinish).not.toHaveBeenCalled();

  await act(async () => { pending.reject(new Error("private pending failure")); });
  expect(await screen.findByText("完成回顾失败，请重试。")).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "保存表达支持补充说明" }));
  });
  expect(onUpdate).toHaveBeenCalledTimes(2);
  fireEvent.press(screen.getByRole("button", { name: "完成回顾" }));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
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

test("Page 8 page actions receive the latest visible fields", async () => {
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

  fireEvent.changeText(screen.getByLabelText("沟通卡字段：不希望"), "当前可见表达");
  const visibleFields = [{ id: "boundaries", needsReview: true, text: "当前可见表达" }];
  fireEvent.press(screen.getByRole("button", { name: "本机保存" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(visibleFields));
  fireEvent.press(screen.getByRole("button", { name: "复制当前卡片" }));
  await waitFor(() => expect(onCopy).toHaveBeenCalledWith(visibleFields));
  fireEvent.press(screen.getByRole("button", { name: "完成旅程" }));

  await waitFor(() => expect(onFinish).toHaveBeenCalledWith(visibleFields));
});

test("Page 8 serializes page actions behind a field commit and retries the dirty edit", async () => {
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

  fireEvent.changeText(screen.getByLabelText("沟通卡字段：不希望"), "待提交表达");
  fireEvent.press(screen.getByRole("button", { name: "保存字段：不希望" }));
  expect(screen.getByRole("button", { name: "本机保存" }).props.accessibilityState.disabled).toBe(false);
  expect(screen.getByRole("button", { name: "复制当前卡片" }).props.accessibilityState.disabled).toBe(false);
  expect(screen.getByRole("button", { name: "完成旅程" }).props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByRole("button", { name: "本机保存" }));
  fireEvent.press(screen.getByRole("button", { name: "复制当前卡片" }));
  fireEvent.press(screen.getByRole("button", { name: "完成旅程" }));
  expect(onSave).not.toHaveBeenCalled();
  expect(onCopy).not.toHaveBeenCalled();
  expect(onFinish).not.toHaveBeenCalled();

  await act(async () => { pending.reject(new Error("private pending field failure")); });
  await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
});

test("Page 8 reconciles canonical props around dirty and committed fields", async () => {
  const edit = deferred();
  const onEdit = jest.fn(() => edit.promise);
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

  fireEvent.changeText(screen.getByLabelText("沟通卡字段：不希望"), "尚未提交的边界");
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

  expect(screen.getByLabelText("沟通卡字段：不希望").props.value).toBe("尚未提交的边界");
  expect(screen.getByLabelText("沟通卡字段：安心条件").props.value).toBe("安心新值");

  await act(async () => { edit.resolve(); });
  await waitFor(() => expect(onEdit).toHaveBeenCalledWith("boundaries", "尚未提交的边界"));
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
  expect(screen.getByLabelText("沟通卡字段：不希望").props.value).toBe("已确认服务端边界");
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

  fireEvent.press(screen.getByRole("button", { name: "保存字段：不希望" }));
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
  expect(screen.getByRole("button", { name: "完成旅程" }).props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByRole("button", { name: "完成旅程" }));
  expect(onFinish).not.toHaveBeenCalled();

  await act(async () => { pending.resolve(); });
  await waitFor(() => expect(onFinish).toHaveBeenCalledWith([]));
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
  await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
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

  const page6 = render(<PresetPracticePage
    behaviors={[{ id: "kissing", label: "亲吻" }]}
    branches={[{ branch: "supportive", label: "支持" }]}
    intents={[{
      intent: "pause-and-decide",
      label: "先暂停",
      phrase: "先暂停一下。",
      phraseId: "phrase-pause"
    }]}
    onComplete={jest.fn()}
  />);
  expect(screen.getByLabelText("练习表达").props.multiline).toBe(true);
  page6.unmount();

  render(<CommunicationCardPage
    fields={[{ id: "boundaries", needsReview: false, text: "请先问我" }]}
    onCopy={jest.fn()}
    onEdit={jest.fn()}
    onSave={jest.fn()}
    pointTotal={0}
  />);
  expect(screen.getByLabelText("沟通卡字段：不希望").props.multiline).toBe(true);
});

test("all eight pages use a theme-backed Card hierarchy with a reachable bottom primary action and delegate scrolling to the shell", () => {
  const pageCases: Array<{
    page: number;
    primaryAction: string;
    renderPage: () => ReactElement;
  }> = [
    {
      page: 1,
      primaryAction: "我已满18岁",
      renderPage: () => (
        <WelcomePage
          onAdult={jest.fn()}
          onOpenPreface={jest.fn()}
          onRestart={jest.fn()}
          onResume={jest.fn()}
          onUnderage={jest.fn()}
          resumeAvailable
        />
      )
    },
    {
      page: 2,
      primaryAction: "继续",
      renderPage: () => <OvernightPage concernOptions={[]} expectationOptions={[]} onContinue={jest.fn()} />
    },
    {
      page: 3,
      primaryAction: "继续",
      renderPage: () => (
        <BodyKnowledgePage
          cards={[]}
          onContinue={jest.fn()}
          onOpenDiagram={jest.fn()}
          onOpenSources={jest.fn()}
          onRead={jest.fn()}
        />
      )
    },
    {
      page: 4,
      primaryAction: "继续",
      renderPage: () => (
        <BehaviorAttitudesPage behaviors={[]} onContinue={jest.fn()} onSet={jest.fn()} />
      )
    },
    {
      page: 5,
      primaryAction: "完成反思并继续",
      renderPage: () => <ReflectionPage onComplete={jest.fn()} />
    },
    {
      page: 6,
      primaryAction: "采用这句话",
      renderPage: () => (
        <PresetPracticePage
          behaviors={[{ id: "kissing", label: "亲吻" }]}
          branches={[{ branch: "supportive", label: "支持" }]}
          intents={[{
            intent: "pause-and-decide",
            label: "先暂停",
            phrase: "先暂停一下。",
            phraseId: "phrase-pause"
          }]}
          onComplete={jest.fn()}
        />
      )
    },
    {
      page: 7,
      primaryAction: "完成回顾",
      renderPage: () => <ChecklistPage items={[]} onFinish={jest.fn()} onUpdate={jest.fn()} />
    },
    {
      page: 8,
      primaryAction: "完成旅程",
      renderPage: () => (
        <CommunicationCardPage
          fields={[]}
          onCopy={jest.fn()}
          onEdit={jest.fn()}
          onFinish={jest.fn()}
          onSave={jest.fn()}
          pointTotal={0}
        />
      )
    }
  ];

  for (const pageCase of pageCases) {
    const view = render(pageCase.renderPage());
    const content = screen.getByTestId(`page-${pageCase.page}-content`);
    const contentStyle = StyleSheet.flatten(content.props.style);
    const cards = screen.getAllByTestId(new RegExp(`^page-${pageCase.page}-card-`, "u"));

    expect(contentStyle.gap).toBe(theme.space.lg);
    expect(contentStyle.flexGrow).toBe(1);
    expect(cards.length).toBeGreaterThan(0);
    expect(StyleSheet.flatten(cards[0]?.props.style)).toEqual(expect.objectContaining({
      borderRadius: theme.radius.lg,
      padding: theme.space.lg
    }));
    expect(screen.getByTestId(`page-${pageCase.page}-primary-actions`)).toBeTruthy();
    expect(screen.getByRole("button", { name: pageCase.primaryAction })).toBeTruthy();
    expect(view.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);

    view.unmount();
  }
});

test("welcome renders the canonical brand and retains every entry action", () => {
  render(<WelcomePage
    onAdult={jest.fn()}
    onOpenPreface={jest.fn()}
    onRestart={jest.fn()}
    onResume={jest.fn()}
    onUnderage={jest.fn()}
    resumeAvailable
  />);

  expect(screen.getByText(brand.displayName)).toBeTruthy();
  expect(screen.getByText(brand.slogan)).toBeTruthy();
  for (const action of [
    "阅读能力与局限短笺",
    "我已满18岁",
    "我未满18岁",
    "继续本机旅程",
    "重新开始（需要确认）"
  ]) {
    expect(screen.getByRole("button", { name: action })).toBeTruthy();
  }
});

test("Pages 2 through 8 keep every required local and non-gating disclosure visible", () => {
  const cases: Array<{ copy: string; page: () => ReactElement }> = [
    {
      copy: "过夜不代表会发生性行为，也不代表任何事一定会发生。",
      page: () => <OvernightPage concernOptions={[]} expectationOptions={[]} onContinue={jest.fn()} />
    },
    {
      copy: "医学图示将在内容完善阶段替换",
      page: () => (
        <BodyKnowledgePage
          cards={[]}
          onOpenDiagram={jest.fn()}
          onOpenSources={jest.fn()}
          onRead={jest.fn()}
        />
      )
    },
    {
      copy: "每项都可独立选择，没有高低顺序",
      page: () => <BehaviorAttitudesPage behaviors={[]} onSet={jest.fn()} />
    },
    {
      copy: "反思记录只会保存在这台设备上；云端保存尚不可用。",
      page: () => <ReflectionPage onComplete={jest.fn()} />
    },
    {
      copy: "预设对话，不使用 AI",
      page: () => (
        <PresetPracticePage
          behaviors={[]}
          branches={[]}
          intents={[]}
          onComplete={jest.fn()}
        />
      )
    },
    {
      copy: "这不是需要全部勾选的通关表",
      page: () => <ChecklistPage items={[]} onFinish={jest.fn()} onUpdate={jest.fn()} />
    },
    {
      copy: "根据妳刚才的选择整理",
      page: () => (
        <CommunicationCardPage
          fields={[]}
          onCopy={jest.fn()}
          onEdit={jest.fn()}
          onSave={jest.fn()}
          pointTotal={0}
        />
      )
    }
  ];

  for (const testCase of cases) {
    const view = render(testCase.page());
    if (testCase.copy.startsWith("医学图示")) {
      fireEvent.press(screen.getByRole("button", { name: "主动展开医学图示" }));
    }
    expect(screen.getByText(testCase.copy)).toBeTruthy();
    view.unmount();
  }
});

test("long labels and multiline inputs remain flexible while journey controls own 44 point targets", () => {
  const longLabel = "这是一个会在小屏幕和大号字体下自然换行而不会被截断的很长期待选项标签";
  render(<OvernightPage
    concernOptions={[]}
    expectationOptions={[{ id: "long", label: longLabel }]}
    onContinue={jest.fn()}
  />);

  const longLabelText = screen.getByText(longLabel);
  const input = screen.getByLabelText("过夜情境可选补充");
  const choice = screen.getByRole("checkbox", { name: longLabel });
  const continueAction = screen.getByRole("button", { name: "继续" });
  const inputStyle = StyleSheet.flatten(input.props.style) ?? {};

  expect(longLabelText.props.numberOfLines).toBeUndefined();
  expect(StyleSheet.flatten(longLabelText.props.style).height).toBeUndefined();
  expect(input.props.numberOfLines).toBeUndefined();
  expect(inputStyle.height).toBeUndefined();
  expect(inputStyle.minHeight).toBe(theme.size.minimumTouchTarget);
  expect(StyleSheet.flatten(choice.props.style)).toEqual(expect.objectContaining({
    minHeight: theme.size.minimumTouchTarget,
    minWidth: theme.size.minimumTouchTarget
  }));
  expect(StyleSheet.flatten(continueAction.props.style)).toEqual(expect.objectContaining({
    minHeight: theme.size.minimumTouchTarget,
    minWidth: theme.size.minimumTouchTarget
  }));
});

test("visible journey results never add readiness, score, or percentage language and points reveal no sensitive input", () => {
  const sensitiveText = "只想留在本机的私密表达";
  render(<CommunicationCardPage
    fields={[{ id: "boundaries", needsReview: false, text: sensitiveText }]}
    onCopy={jest.fn()}
    onEdit={jest.fn()}
    onSave={jest.fn()}
    pointTotal={7}
  />);

  expect(screen.getByText("探索积分：7")).toBeTruthy();
  expect(screen.queryByText(/准备度|评分|百分比|readiness|score|percentage/iu)).toBeNull();
  expect(screen.queryByText(new RegExp(`探索积分.*${sensitiveText}`, "u"))).toBeNull();
});

test("Page 8 presents every communication-card section with stable Chinese labels while callbacks keep canonical IDs", async () => {
  const sections = [
    ["intentions", "期待"],
    ["boundaries", "不希望"],
    ["pace", "当时再感受"],
    ["comfort", "安心条件"],
    ["practical", "确认与暂停"],
    ["aftercare", "改变时表达"]
  ] as const;
  const onEdit = jest.fn();
  render(<CommunicationCardPage
    fields={sections.map(([id]) => ({ id, needsReview: false, text: `${id}-content` }))}
    onCopy={jest.fn()}
    onEdit={onEdit}
    onSave={jest.fn()}
    pointTotal={0}
  />);

  for (const [id, label] of sections) {
    expect(screen.getByRole("header", { name: label })).toBeTruthy();
    expect(screen.getByLabelText(`沟通卡字段：${label}`)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: `保存字段：${label}` }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(id, `${id}-content`));

    expect(screen.queryByRole("header", { name: id })).toBeNull();
    expect(screen.queryByLabelText(`沟通卡字段：${id}`)).toBeNull();
    expect(screen.queryByRole("button", { name: `保存字段：${id}` })).toBeNull();
  }
});
