import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";

import * as guidedScroll from "../guided-scroll-screen";
import { ReflectionPage, type ReflectionPageProps } from "./reflection-page";

afterEach(() => jest.restoreAllMocks());

function renderPage(overrides: Partial<ReflectionPageProps> = {}) {
  const props: ReflectionPageProps = {
    onComplete: jest.fn(async () => undefined),
    onSave: jest.fn(async () => undefined),
    reducedMotion: true,
    ...overrides,
  };
  render(<ReflectionPage {...props} />);
  return props;
}

async function openCard(title: string, cardId: string) {
  fireEvent.press(screen.getByRole("button", { name: new RegExp(`^${title}`, "u") }));
  expect(await screen.findByTestId(`reflection-card-back-${cardId}`)).toBeTruthy();
  await waitFor(() => expect(screen.getByTestId("reflection-card-fullscreen"))
    .toHaveProp("accessibilityState", expect.objectContaining({ busy: false })));
}

test("reveals the active card action only after the first answer", async () => {
  const reveal = jest.fn();
  jest.spyOn(guidedScroll, "useJourneyGuidedScroll").mockReturnValue({ reveal });
  renderPage();
  await openCard("我能说不、暂停或离开吗", "safety");

  fireEvent.press(screen.getByRole("radio", { name: "拒绝或离开：可以" }));
  fireEvent.press(screen.getByRole("radio", { name: "拒绝或离开：我还不确定" }));

  expect(reveal).toHaveBeenCalledTimes(1);
  expect(reveal).toHaveBeenCalledWith("reflection-card-active-action");
  expect(screen.getByTestId("journey-scroll-target-reflection-card-active-action")).toBeTruthy();
});

test("renders exactly five ordered fronts with a full-width final card and no Page 4 review", () => {
  renderPage();

  const titles = [
    "靠近我的动力",
    "我能说不、暂停或离开吗",
    "我能表达变化吗",
    "什么让我更安心",
    "给此刻留一句话",
  ];
  expect(screen.getAllByText("尚未记录")).toHaveLength(5);
  for (const title of titles) expect(screen.getByText(title)).toBeTruthy();
  expect(screen.getByText("你准备了多少，不代表你做得好不好。")).toBeTruthy();
  expect(screen.getByText("答案可以随时改变；这里不会生成分数或准备度结论。")).toBeTruthy();
  expect(screen.queryByText("这是你刚才留下的答案")).toBeNull();
  expect(StyleSheet.flatten(screen.getByTestId("reflection-card-front-motivation").props.style).width).toBe("47.5%");
  expect(StyleSheet.flatten(screen.getByTestId("reflection-card-front-journal").props.style).width).toBe("100%");
  expect(screen.getByRole("button", { name: "带着这些发现去练习" })).toBeTruthy();
});

test("saves a motivation card only after confirmation and then marks its front recorded", async () => {
  const onSave = jest.fn(async () => undefined);
  const onCardVisibilityChange = jest.fn();
  renderPage({ onCardVisibilityChange, onSave });
  await openCard("靠近我的动力", "motivation");

  expect(screen.queryByText("如果暂时不用担心对方会不会失望，你此刻还想靠近吗？")).toBeNull();
  fireEvent.press(screen.getByRole("checkbox", { name: "我不希望对方失望" }));
  expect(screen.getByText("如果暂时不用担心对方会不会失望，你此刻还想靠近吗？")).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "如果不用担心失望：也许想，但希望慢一点" }));
  fireEvent.press(screen.getByRole("button", { name: "保存这张卡并返回" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    motivationIds: ["motivation-avoid-disappointment"],
    pressureWithoutDisappointment: "slow-down",
  })));
  await waitFor(() => expect(screen.getByText("已留下反思 · 点击修改")).toBeTruthy());
  expect(onCardVisibilityChange).toHaveBeenNthCalledWith(1, true);
  expect(onCardVisibilityChange).toHaveBeenLastCalledWith(false);
});

test("cancels an unconfirmed edit and restores the saved card value", async () => {
  const onSave = jest.fn(async () => undefined);
  renderPage({ initialValue: { refusalSafety: "can" }, onSave });
  await openCard("我能说不、暂停或离开吗", "safety");
  fireEvent.press(screen.getByRole("radio", { name: "拒绝或离开：我还不确定" }));
  fireEvent.press(screen.getByText("暂不记录，返回所有卡牌"));
  await waitFor(() => expect(screen.getByTestId("reflection-card-grid")).toBeTruthy());
  expect(onSave).not.toHaveBeenCalled();

  await openCard("我能说不、暂停或离开吗", "safety");
  expect(screen.getByRole("radio", { name: "拒绝或离开：可以" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
  expect(screen.getByRole("radio", { name: "拒绝或离开：我还不确定" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ checked: false }));
});

test("keeps the card open and exposes retry feedback when an immediate save fails", async () => {
  const onSave = jest.fn(async () => { throw new Error("disk full"); });
  renderPage({ onSave });
  await openCard("我能表达变化吗", "expression");
  fireEvent.press(screen.getByRole("radio", { name: "表达变化：我可能需要一句更容易说出口的话" }));
  expect(screen.getByText("下一步会给你几句可以直接使用、也可以修改的表达。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "保存这张卡并返回" }));

  expect(await screen.findByText("保存反思失败，请重试。")).toBeTruthy();
  expect(screen.getByTestId("reflection-card-back-expression")).toBeTruthy();
  expect(screen.queryByTestId("reflection-card-grid")).toBeNull();
});

test("keeps all comfort fields on one optional card and saves actual content", async () => {
  const onSave = jest.fn(async () => undefined);
  renderPage({ onSave });
  await openCard("什么让我更安心", "comfort");
  fireEvent.press(screen.getByRole("radio", { name: "安心清晰度：我大致知道" }));
  fireEvent.press(screen.getByRole("checkbox", { name: "希望每次变化前先问我" }));
  fireEvent.changeText(screen.getByLabelText("安心条件补充"), "先问我，再慢一点");
  fireEvent.press(screen.getByRole("button", { name: "保存这张卡并返回" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    comfortClarity: "mostly-clear",
    comfortNeedIds: ["comfort-ask-before-change"],
    comfortNote: "先问我，再慢一点",
  })));
  await waitFor(() => expect(screen.getByTestId("reflection-card-grid")).toBeTruthy());
});

test("asks before local journal persistence and can disable future notices", async () => {
  const onSave = jest.fn(async () => undefined);
  const onSetJournalSaveNotice = jest.fn(async () => undefined);
  renderPage({ onSave, onSetJournalSaveNotice });
  await openCard("给此刻留一句话", "journal");
  fireEvent.changeText(screen.getByLabelText("给此刻留一句话"), "我想记住这句话");
  fireEvent.press(screen.getByRole("button", { name: "保存这句话并返回" }));

  expect(screen.getByText("记录会保存在哪里？")).toBeTruthy();
  expect(screen.getByRole("button", { name: "同时保存到云端｜后续版本" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  const preference = screen.getByRole("checkbox", { name: "以后默认保存在本机，不再显示此提示" });
  expect(preference).toHaveProp("accessibilityState", expect.objectContaining({ checked: false }));
  fireEvent.press(preference);
  fireEvent.press(screen.getByRole("button", { name: "确认只保存在这台设备" }));

  await waitFor(() => expect(onSetJournalSaveNotice).toHaveBeenCalledWith(false));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    journalSaveChoice: "device",
    journalText: "我想记住这句话",
  })));
  await waitFor(() => expect(screen.getByTestId("reflection-card-grid")).toBeTruthy());
});

test("skips the local journal notice when the device preference is disabled", async () => {
  const onSave = jest.fn(async () => undefined);
  renderPage({ onSave, showLocalJournalSaveNotice: false });
  await openCard("给此刻留一句话", "journal");
  fireEvent.changeText(screen.getByLabelText("给此刻留一句话"), "直接保存在本机");
  fireEvent.press(screen.getByRole("button", { name: "保存这句话并返回" }));

  await waitFor(() => expect(onSave).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByTestId("reflection-card-grid")).toBeTruthy());
  await waitFor(() => expect(screen.queryByText("记录会保存在哪里？")).toBeNull());
});

test("clears one saved card after explicit confirmation and persists the empty field", async () => {
  const onSave = jest.fn(async () => undefined);
  renderPage({ initialValue: { refusalSafety: "can" }, onSave });
  await openCard("我能说不、暂停或离开吗", "safety");
  fireEvent.press(screen.getByText("清除此卡的记录"));
  expect(screen.getByText("清除此卡的记录？")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "确认清除此卡的记录" }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ refusalSafety: null })));
  await waitFor(() => expect(screen.getAllByText("尚未记录")).toHaveLength(5));
});

test("keeps standalone reflection session-only and never submits journal text", async () => {
  const onComplete = jest.fn();
  const onSave = jest.fn();
  renderPage({ onComplete, onSave, storageMode: "session-only" });
  await openCard("给此刻留一句话", "journal");

  expect(screen.getByText("仅用于本次回顾，离开后内容会清除。")).toBeTruthy();
  expect(screen.queryByText("确认只保存在这台设备")).toBeNull();
  fireEvent.changeText(screen.getByLabelText("给此刻留一句话"), "不应传出当前页面");
  fireEvent.press(screen.getByRole("button", { name: "保存这句话并返回" }));
  await waitFor(() => expect(screen.getByTestId("reflection-card-grid")).toBeTruthy());
  fireEvent.press(screen.getByRole("button", { name: "完成本次回顾" }));

  expect(onSave).not.toHaveBeenCalled();
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    journalSaveChoice: "not-saved",
    journalText: "",
  }));
  expect(onComplete.mock.calls[0]?.[0]).not.toHaveProperty("journalPromptId");
});

test("restores an interrupted reflection and submits the complete local-only payload", () => {
  const onComplete = jest.fn();
  renderPage({
    initialValue: {
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
    },
    onComplete,
  });

  fireEvent.press(screen.getByRole("button", { name: "带着这些发现去练习" }));
  expect(onComplete).toHaveBeenCalledWith({
    motivationIds: ["motivation-avoid-disappointment"],
    pressureWithoutDisappointment: "slow-down",
    refusalSafety: "difficult-but-possible",
    expressionDifficulty: "not-ready",
    comfortClarity: "need-space",
    comfortNeedIds: ["comfort-no-pressure-after-pause"],
    comfortNote: "需要自己的空间",
    journalText: "",
    journalSaveChoice: "not-saved",
  });
});

test("edits a prior behavior attitude without replacing the five reflection cards", async () => {
  const onEditBehaviorAttitude = jest.fn();
  renderPage({
    behaviorAnswers: [
      { attitude: "not-this-time", behaviorId: "direct", behaviorLabel: "直接触摸" },
      { attitude: "looking-forward", behaviorId: "hug", behaviorLabel: "拥抱或依偎" },
      { attitude: "unsure", behaviorId: "kiss", behaviorLabel: "接吻" },
    ],
    onEditBehaviorAttitude,
  });

  expect(screen.getByText("这是你刚才留下的答案")).toBeTruthy();
  expect(screen.getAllByText("尚未记录")).toHaveLength(5);
  fireEvent.press(screen.getByRole("button", { name: "修改拥抱或依偎的答案" }));
  expect(screen.getAllByRole("radio", { name: /^修改拥抱或依偎：/u })).toHaveLength(6);
  fireEvent.press(screen.getByRole("radio", { name: "修改拥抱或依偎：我还没想清楚" }));

  await waitFor(() => expect(onEditBehaviorAttitude).toHaveBeenCalledWith("hug", "unsure"));
  expect(screen.queryByText("正在修改：拥抱或依偎")).toBeNull();
  expect(screen.getByText("此页的其他反思仍保留在当前页面。")).toBeTruthy();
});

test("offers safety, journal, and practice phrase callbacks inside flipped cards", async () => {
  const onOpenComfort = jest.fn();
  const onOpenJournal = jest.fn();
  const onUsePracticePhrase = jest.fn();
  renderPage({ onOpenComfort, onOpenJournal, onUsePracticePhrase });

  await openCard("我能说不、暂停或离开吗", "safety");
  fireEvent.press(screen.getByRole("radio", { name: "拒绝或离开：我担心对方会有不好的反应" }));
  fireEvent.press(screen.getByRole("button", { name: "看看什么能让我更安心" }));
  fireEvent.press(screen.getByRole("button", { name: "先回到我的记录里" }));
  expect(onOpenComfort).toHaveBeenCalledTimes(1);
  expect(onOpenJournal).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText("暂不记录，返回所有卡牌"));
  await waitFor(() => expect(screen.getByTestId("reflection-card-grid")).toBeTruthy());

  await openCard("我能表达变化吗", "expression");
  fireEvent.press(screen.getByRole("radio", { name: "表达变化：我现在还不太敢表达" }));
  fireEvent.press(screen.getByRole("button", { name: "把这句话带到练习里" }));
  expect(onUsePracticePhrase).toHaveBeenCalledWith("先停一下，我现在需要一点时间。");
});

test("offers the conditional slow-down phrase without overwriting prior answers", async () => {
  const onUsePracticePhrase = jest.fn();
  renderPage({ onUsePracticePhrase });
  await openCard("靠近我的动力", "motivation");
  fireEvent.press(screen.getByRole("checkbox", { name: "我不希望对方失望" }));
  fireEvent.press(screen.getByRole("radio", { name: "如果不用担心失望：也许想，但希望慢一点" }));

  fireEvent.press(screen.getByRole("button", { name: "把这句慢下来带到练习里" }));
  expect(onUsePracticePhrase).toHaveBeenCalledWith(
    "我愿意试试看，但想慢慢来。我说“慢一点”或“停下”时，请马上停下来。",
  );
});

test("allows continuing with no completed cards and strips unconfirmed journal text", async () => {
  const onComplete = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
  renderPage({
    initialValue: { journalPromptId: "journal-hesitation", journalSaveChoice: "not-saved", journalText: "不应持久化" },
    onComplete,
  });
  fireEvent.press(screen.getByRole("button", { name: "带着这些发现去练习" }));

  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    journalSaveChoice: "not-saved",
    journalText: "",
  })));
  await waitFor(() => expect(screen.getByRole("button", { name: "带着这些发现去练习" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ busy: false })));
  expect(onComplete.mock.calls[0]?.[0]).not.toHaveProperty("journalPromptId");
});

test("announces a reduced-motion flip and keeps the immersive card control touch-safe", async () => {
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(jest.fn());
  renderPage();
  await openCard("我能说不、暂停或离开吗", "safety");

  await waitFor(() => expect(announce).toHaveBeenCalledWith("我能说不、暂停或离开吗，已展开"));
  const choice = screen.getByRole("radio", { name: "拒绝或离开：可以" });
  expect(StyleSheet.flatten(choice.props.style)).toEqual(expect.objectContaining({ minHeight: 44, minWidth: 44 }));
  announce.mockRestore();
});

test("switches reflection card content directly without rotateY or timing calls in reduced-motion mode", async () => {
  const timing = jest.spyOn(Animated, "timing");
  renderPage();
  await openCard("我能表达变化吗", "expression");

  expect(timing).not.toHaveBeenCalled();
  expect(StyleSheet.flatten(screen.getByTestId("reflection-card-fullscreen").props.style).transform).toBeUndefined();
  timing.mockRestore();
});

test("returns VoiceOver focus to the originating reflection card", async () => {
  const focus = jest.spyOn(AccessibilityInfo, "setAccessibilityFocus").mockImplementation(jest.fn());
  renderPage({ resolveFocusHandle: () => 42 });
  await openCard("我能表达变化吗", "expression");

  fireEvent.press(screen.getByRole("button", { name: "暂不记录，返回所有卡牌" }));
  await waitFor(() => expect(screen.getByTestId("reflection-card-grid")).toBeTruthy());
  await waitFor(() => expect(focus).toHaveBeenLastCalledWith(42));
  focus.mockRestore();
});

test("uses two rotateY stages in each direction when motion is enabled", async () => {
  const timing = jest.spyOn(Animated, "timing");
  renderPage({ reducedMotion: false });
  await openCard("我能表达变化吗", "expression");

  expect(timing).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({ toValue: 90 }));
  expect(timing).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ toValue: 0 }));
  fireEvent.press(screen.getByRole("button", { name: "暂不记录，返回所有卡牌" }));
  await waitFor(() => expect(screen.getByTestId("reflection-card-grid")).toBeTruthy());
  expect(timing).toHaveBeenNthCalledWith(3, expect.anything(), expect.objectContaining({ toValue: 90 }));
  expect(timing).toHaveBeenNthCalledWith(4, expect.anything(), expect.objectContaining({ toValue: 0 }));
  timing.mockRestore();
});
