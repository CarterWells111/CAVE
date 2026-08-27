import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { loadCatalog } from "@cave/content";
import { StyleSheet } from "react-native";

import { PresetPracticePage } from "./PresetPracticePage";

const catalog = loadCatalog().journey.practice;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function reachCompleted(onComplete = jest.fn()) {
  render(<PresetPracticePage behaviorOptions={[]} catalog={catalog} onComplete={onComplete} />);
  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("不说具体行为"));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("安静待一会儿"));
  fireEvent.press(screen.getByText("跳过不太理想的回应"));
}

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

test("runs the respectful deterministic path and returns the user's edited phrase", async () => {
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

  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    behaviorId: "behavior-hug",
    intent: "slow-down",
    phrase: "请先慢一点。",
    aftercareId: "quiet",
    completed: true
  })));
});

test("returns safely when mirror practice is skipped from phrase editing", () => {
  render(<PresetPracticePage behaviorOptions={[]} catalog={catalog} onComplete={jest.fn()} />);

  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("不说具体行为"));
  fireEvent.press(screen.getByText("还不知道接下来想怎样"));
  fireEvent.press(screen.getByText("先对着镜子说一遍"));
  fireEvent.press(screen.getByText("暂时跳过"));

  expect(screen.getByText("把需要说出来")).toBeTruthy();
  expect(screen.getByText("我还不知道接下来想怎样。可以先停下来，让我仔细感受一下吗？")).toBeTruthy();
});

test("excludes not-this-time behaviors and marks sensitive choices for fresh selection", () => {
  render(<PresetPracticePage
    behaviorOptions={[
      { id: "behavior-hug", label: "拥抱", attitude: "looking-forward", requiresFreshSelection: false },
      { id: "behavior-no", label: "这次不要的行为", attitude: "not-this-time", requiresFreshSelection: false },
      { id: "behavior-sensitive", label: "更具体的行为", attitude: "decide-in-moment", requiresFreshSelection: true },
    ]}
    catalog={catalog}
    onComplete={jest.fn()}
  />);

  fireEvent.press(screen.getByText("开始情境练习"));
  expect(screen.getByText("拥抱")).toBeTruthy();
  expect(screen.queryByText("这次不要的行为")).toBeNull();
  expect(screen.getByText("更具体的行为（需在本次练习中重新选择）")).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "更具体的行为（需在本次练习中重新选择）" }));
  expect(screen.getByText("此刻，你更接近哪一种需要？")).toBeTruthy();
});

test("asks for fresh consent before substitute hugging", () => {
  render(<PresetPracticePage behaviorOptions={[]} catalog={catalog} onComplete={jest.fn()} />);
  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("不说具体行为"));
  fireEvent.press(screen.getByText("想换一种亲近方式"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("如果双方都愿意，只抱一会儿"));

  expect(screen.getByText("现在可以抱你吗？")).toBeTruthy();
  expect(screen.getByText("停止原来的行为，不自动等于同意拥抱。")).toBeTruthy();
});

test("selects and edits an optional disappointed response before final completion", async () => {
  const onComplete = jest.fn();
  render(<PresetPracticePage behaviorOptions={[]} catalog={catalog} onComplete={onComplete} />);
  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("不说具体行为"));
  fireEvent.press(screen.getByText("想先暂停，再感受一下"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("保持一点距离"));
  fireEvent.press(screen.getByText("也练习一次不太理想的回应"));
  fireEvent.press(screen.getByText("可是我们刚刚不是还好好的吗？"));
  fireEvent.press(screen.getByRole("radio", { name: "我知道你可能失望，但我现在不想继续。" }));
  fireEvent.press(screen.getByText("改成我的说法"));
  fireEvent.changeText(screen.getByLabelText("我的可选回应"), "我现在要停下来。");
  fireEvent.press(screen.getByText("使用这句回应"));
  fireEvent.press(screen.getByText("完成这个分支"));
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("继续整理我的准备"));

  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    optionalBranch: "disappointed-but-stops",
    optionalResponse: "我现在要停下来。",
  })));
});

test("awaits final completion, blocks duplicates, reports failure, and permits retry", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const onComplete = jest.fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  reachCompleted(onComplete);

  const finish = screen.getByRole("button", { name: "继续整理我的准备" });
  fireEvent.press(finish);
  fireEvent.press(finish);
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(screen.getByText("正在保存练习…")).toBeTruthy();

  await act(async () => {
    first.reject(new Error("private failure"));
    await first.promise.catch(() => undefined);
  });
  expect(screen.getByText("保存练习失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private failure")).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "继续整理我的准备" }));
  expect(onComplete).toHaveBeenCalledTimes(2);
  await act(async () => {
    second.resolve();
    await second.promise;
  });
  await waitFor(() => expect(screen.queryByText("正在保存练习…")).toBeNull());
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
  expect(StyleSheet.flatten(start.props.style)).toEqual(expect.objectContaining({ minHeight: 52, minWidth: 44 }));
  expect(screen.getByText("6 / 7")).toBeTruthy();
});

test("keeps the editable phrase keyboard-friendly and text-scalable", () => {
  render(<PresetPracticePage behaviorOptions={[]} catalog={catalog} onComplete={jest.fn()} />);
  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("不说具体行为"));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("改成我的说法"));

  const input = screen.getByLabelText("我的表达句");
  expect(input).toHaveProp("multiline", true);
  expect(StyleSheet.flatten(input.props.style)).toEqual(expect.objectContaining({ minHeight: 112 }));
  expect(screen.getByText("把需要说出来").props.numberOfLines).toBeUndefined();
});
