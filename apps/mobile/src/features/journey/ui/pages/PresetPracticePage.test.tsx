import { fireEvent, render, screen } from "@testing-library/react-native";
import { loadCatalog } from "@cave/content";

import { PresetPracticePage } from "./PresetPracticePage";

const catalog = loadCatalog().journey.practice;

test("always identifies the experience as preset and never implies AI or recording", () => {
  render(<PresetPracticePage behaviorOptions={[{ id: "behavior-hug", label: "拥抱" }]} catalog={catalog} onComplete={jest.fn()} />);

  expect(screen.getByText("预设对话，不使用 AI")).toBeTruthy();
  expect(screen.queryByText(/正在生成|输入中|麦克风/u)).toBeNull();
  fireEvent.press(screen.getByText("先对着镜子说一遍"));
  expect(screen.getByText("这次练习不会录音，也不会识别你说了什么。")).toBeTruthy();
  expect(screen.queryByText(/音量|波形/u)).toBeNull();
  fireEvent.press(screen.getByText("我说过一遍了"));
  expect(screen.getByText("这次想用哪一种靠近来练习？")).toBeTruthy();
});

test("runs the respectful deterministic path and returns the user's edited phrase", () => {
  const onComplete = jest.fn();
  render(<PresetPracticePage behaviorOptions={[{ id: "behavior-hug", label: "拥抱" }]} catalog={catalog} onComplete={onComplete} />);

  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("拥抱"));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("改成我的说法"));
  fireEvent.changeText(screen.getByLabelText("我的表达句"), "请先慢一点。");
  fireEvent.press(screen.getByText("就用这句话"));
  expect(screen.getByText("一种尊重边界的回应")).toBeTruthy();
  fireEvent.press(screen.getByText("安静待一会儿"));
  fireEvent.press(screen.getByText("跳过不太理想的回应"));
  fireEvent.press(screen.getByText("继续整理我的准备"));

  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    behaviorId: "behavior-hug",
    intent: "slow-down",
    phrase: "请先慢一点。",
    aftercareId: "quiet",
    completed: true
  }));
});

test("ends ordinary practice at the safety branch and only offers explicit support actions", () => {
  render(<PresetPracticePage
    behaviorOptions={[{ id: "behavior-hug", label: "拥抱" }]}
    catalog={catalog}
    onComplete={jest.fn()}
    onCopySupportNumber={jest.fn()}
    onOpenSources={jest.fn()}
  />);

  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("不说具体行为"));
  fireEvent.press(screen.getByText("不想继续正在发生的事"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("结束这个夜晚的亲密接触"));
  fireEvent.press(screen.getByText("也练习一次不太理想的回应"));
  fireEvent.press(screen.getByText("对方仍在说服、继续触碰或阻止离开"));

  expect(screen.getByText("这不是因为你没有说清楚")).toBeTruthy();
  expect(screen.getByText("110")).toBeTruthy();
  expect(screen.queryByText(/继续说服|暂停卡|自动拨号/u)).toBeNull();
  expect(screen.getByText("结束这次练习")).toBeTruthy();
});

test("uses full-width flexible actions and semantic controls for large text layouts", () => {
  render(<PresetPracticePage behaviorOptions={[]} catalog={catalog} onComplete={jest.fn()} />);
  const start = screen.getByRole("button", { name: "开始情境练习" });
  expect(start.props.accessibilityState.disabled).toBe(false);
  expect(screen.getByText("6 / 7")).toBeTruthy();
});
