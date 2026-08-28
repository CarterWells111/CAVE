import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";

import { ReflectionPage, type ReflectionPageProps } from "./reflection-page";

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
  expect(screen.queryByText("记录会保存在哪里？")).toBeNull();
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

test("allows continuing with no completed cards and strips unconfirmed journal text", () => {
  const onComplete = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
  renderPage({
    initialValue: { journalPromptId: "journal-hesitation", journalSaveChoice: "not-saved", journalText: "不应持久化" },
    onComplete,
  });
  fireEvent.press(screen.getByRole("button", { name: "带着这些发现去练习" }));

  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    journalSaveChoice: "not-saved",
    journalText: "",
  }));
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
