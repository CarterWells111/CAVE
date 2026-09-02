import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { loadCatalog } from "@cave/content";
import { StyleSheet } from "react-native";

import * as guidedScroll from "../guided-scroll-screen";
import { JourneyStepBackHarness } from "../journey-step-back.test-utils";
import { PresetPracticePage } from "./PresetPracticePage";

afterEach(() => jest.restoreAllMocks());

const catalog = loadCatalog().journey.practice;

test("keeps each replacement stage card visible with the nearest correction", async () => {
  const reveal = jest.fn();
  jest.spyOn(guidedScroll, "useJourneyGuidedScroll").mockReturnValue({ reveal });
  render(<PresetPracticePage catalog={catalog} onComplete={jest.fn()} />);

  fireEvent.press(screen.getByText("开始情境练习"));
  await waitFor(() => expect(reveal).toHaveBeenLastCalledWith("practice-stage-need", { mode: "nearest" }));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  await waitFor(() => expect(reveal).toHaveBeenLastCalledWith("practice-stage-editable-phrase", { mode: "nearest" }));
  fireEvent.press(screen.getByText("先对着镜子说一遍"));
  await waitFor(() => expect(reveal).toHaveBeenLastCalledWith("practice-stage-mirror", { mode: "nearest" }));
  expect(screen.getByTestId("journey-scroll-target-practice-stage-mirror")).toBeTruthy();
});

beforeEach(() => {
  jest.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function reachCompleted(
  onComplete = jest.fn(),
  callbacks: { onAddToPreparation?: jest.Mock; onPracticeAgain?: jest.Mock } = {},
) {
  render(<PresetPracticePage catalog={catalog} onComplete={onComplete} {...callbacks} />);
  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("继续"));
  fireEvent.press(screen.getByText("安静待一会儿"));
  fireEvent.press(screen.getByText("跳过不太理想的回应"));
}

test("always identifies the experience as preset and never implies AI or recording", () => {
  render(<PresetPracticePage catalog={catalog} onComplete={jest.fn()} />);

  expect(screen.getByText("预设对话，不使用 AI")).toBeTruthy();
  expect(screen.getByText("改变主意，也属于过程")).toBeTruthy();
  expect(screen.getByText("暂停不需要道歉。")).toBeTruthy();
  expect(screen.getByText("练习前灵感")).toBeTruthy();
  expect(screen.queryByText(/正在生成|输入中|麦克风/u)).toBeNull();
  expect(screen.getAllByRole("button")).toHaveLength(1);
  fireEvent.press(screen.getByText("开始情境练习"));
  expect(screen.queryByText("改变主意，也属于过程")).toBeNull();
  expect(screen.queryByText("这次想用哪一种靠近来练习？")).toBeNull();
  expect(screen.getByText("你和对方正在按照已经商量好的方式亲近。开始时，这是你愿意的。")).toBeTruthy();
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("先对着镜子说一遍"));
  expect(screen.getByText("这次练习不会录音、不会请求麦克风权限，也不会识别你说了什么。")).toBeTruthy();
  expect(screen.getByText("我感觉现在推进得有点快，我有些不安心。我们可以慢慢来吗？")).toBeTruthy();
  expect(screen.queryByText(/音量|波形/u)).toBeNull();
  fireEvent.press(screen.getByText("我说过一遍了"));
  expect(screen.getByText("把需要说出来")).toBeTruthy();
});

test("runs the respectful deterministic path and returns the user's edited phrase", async () => {
  const onComplete = jest.fn();
  render(<PresetPracticePage catalog={catalog} onComplete={onComplete} />);

  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("改成我的说法"));
  fireEvent.changeText(screen.getByLabelText("我的表达句"), "请先慢一点。");
  fireEvent.press(screen.getByText("就用这句话"));
  expect(screen.getByText("一种尊重边界的回应")).toBeTruthy();
  expect(screen.queryByText("停下来以后，此刻的你更想怎样？")).toBeNull();
  fireEvent.press(screen.getByText("继续"));
  fireEvent.press(screen.getByText("安静待一会儿"));
  fireEvent.press(screen.getByText("跳过不太理想的回应"));
  fireEvent.press(screen.getByText("继续"));
  fireEvent.press(screen.getByText("继续整理我的准备"));

  await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
    behaviorId: null,
    intent: "slow-down",
    phrase: "请先慢一点。",
    aftercareId: "quiet",
    completed: true
  })));
});

test("uses a typed standalone scenario intent when the practice starts", () => {
  render(
    <PresetPracticePage
      catalog={catalog}
      initialIntent="pause-and-decide"
      onComplete={jest.fn()}
    />,
  );

  fireEvent.press(screen.getByText("开始情境练习"));

  expect(screen.getByText("把需要说出来")).toBeTruthy();
  expect(screen.getByText("我现在感觉有些不对，可以先休息一下，过一会儿再决定要不要继续吗？")).toBeTruthy();
  expect(screen.queryByText("此刻，你更接近哪一种需要？")).toBeNull();
});

test("finishes standalone practice without claiming persistence or awarding an echo", async () => {
  const onComplete = jest.fn();
  render(
    <PresetPracticePage
      catalog={catalog}
      context="standalone"
      onComplete={onComplete}
    />,
  );

  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("继续"));
  fireEvent.press(screen.getByText("安静待一会儿"));
  fireEvent.press(screen.getByText("跳过不太理想的回应"));
  fireEvent.press(screen.getByRole("button", { name: "继续" }));
  fireEvent.press(screen.getByRole("button", { name: "完成本次练习" }));

  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  expect(screen.getByText("本次练习已完成，内容不会保存。")).toBeTruthy();
  expect(screen.queryByText(/已保存练习|正在保存练习|\+1 回响/u)).toBeNull();
});

test("returns safely when mirror practice is skipped from phrase editing", () => {
  render(<PresetPracticePage catalog={catalog} onComplete={jest.fn()} />);

  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("还不知道接下来想怎样"));
  fireEvent.press(screen.getByText("先对着镜子说一遍"));
  fireEvent.press(screen.getByText("暂时跳过"));

  expect(screen.getByText("把需要说出来")).toBeTruthy();
  expect(screen.getByText("我还不知道接下来想怎样。可以先停下来，让我仔细感受一下吗？")).toBeTruthy();
});

test("returns through phrase editing, mirror practice, and the actual visited stages", () => {
  render(
    <JourneyStepBackHarness>
      <PresetPracticePage catalog={catalog} onComplete={jest.fn()} />
    </JourneyStepBackHarness>,
  );

  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("改成我的说法"));
  expect(screen.getByLabelText("我的表达句")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "测试返回上一步" }));
  expect(screen.queryByLabelText("我的表达句")).toBeNull();

  fireEvent.press(screen.getByText("先对着镜子说一遍"));
  expect(screen.getByText("这次练习不会录音、不会请求麦克风权限，也不会识别你说了什么。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "测试返回上一步" }));
  expect(screen.queryByText("这次练习不会录音、不会请求麦克风权限，也不会识别你说了什么。")).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "测试返回上一步" }));
  expect(screen.getByText("此刻，你更接近哪一种需要？")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "测试返回上一步" }));
  expect(screen.getByText("改变主意，也属于过程")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "测试返回上一步" })).toBeNull();
});

test("returns from completion actions to review before the preceding practice stage", () => {
  render(
    <JourneyStepBackHarness>
      <PresetPracticePage catalog={catalog} onComplete={jest.fn()} />
    </JourneyStepBackHarness>,
  );
  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("继续"));
  fireEvent.press(screen.getByText("安静待一会儿"));
  fireEvent.press(screen.getByText("跳过不太理想的回应"));
  fireEvent.press(screen.getByText("继续"));
  expect(screen.getByText("接下来，你可以")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "测试返回上一步" }));
  expect(screen.getByText("这次练习回看")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "测试返回上一步" }));
  expect(screen.getByText("可选练习")).toBeTruthy();
});

test("starts with the generic scenario without loading or requesting a specific behavior", () => {
  render(<PresetPracticePage catalog={catalog} onComplete={jest.fn()} />);

  fireEvent.press(screen.getByText("开始情境练习"));
  expect(screen.queryByText("这次想用哪一种靠近来练习？")).toBeNull();
  expect(screen.getByText("你和对方正在按照已经商量好的方式亲近。开始时，这是你愿意的。")).toBeTruthy();
  expect(screen.getByText("过了一会儿，你发现自己的感受有了变化。")).toBeTruthy();
  expect(screen.getByText("感受发生变化，不需要一个足够充分的理由。")).toBeTruthy();
  expect(screen.getByText("此刻，你更接近哪一种需要？")).toBeTruthy();
});

test("asks for fresh consent before substitute hugging", () => {
  render(<PresetPracticePage catalog={catalog} onComplete={jest.fn()} />);
  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("想换一种亲近方式"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("继续"));
  fireEvent.press(screen.getByText("如果双方都愿意，只抱一会儿"));

  expect(screen.getByText("现在可以抱你吗？")).toBeTruthy();
  expect(screen.getByText("停止原来的行为，不自动等于同意拥抱。")).toBeTruthy();
});

test("selects and edits an optional disappointed response before final completion", async () => {
  const onComplete = jest.fn();
  render(<PresetPracticePage catalog={catalog} onComplete={onComplete} />);
  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("想先暂停，再感受一下"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("继续"));
  fireEvent.press(screen.getByText("保持一点距离"));
  fireEvent.press(screen.getByText("也练习一次不太理想的回应"));
  expect(screen.getByText("可是我们刚刚不是还好好的吗？")).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "我知道你可能失望，但我现在不想继续。" }));
  fireEvent.press(screen.getByText("改成我的说法"));
  fireEvent.changeText(screen.getByLabelText("我的可选回应"), "我现在要停下来。");
  fireEvent.press(screen.getByText("使用这句回应"));
  fireEvent.press(screen.getByText("完成这个分支"));
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("继续"));
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
  fireEvent.press(screen.getByText("继续"));

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
  const onOpenSources = jest.fn();
  render(<PresetPracticePage
    catalog={catalog}
    onComplete={jest.fn()}
    onCopySupportNumber={jest.fn()}
    onOpenSources={onOpenSources}
  />);

  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("不想继续正在发生的事"));
  fireEvent.press(screen.getByText("就用这句话"));
  fireEvent.press(screen.getByText("继续"));
  fireEvent.press(screen.getByText("结束这个夜晚的亲密接触"));
  fireEvent.press(screen.getByText("也练习一次不太理想的回应"));
  expect(screen.queryByText("对方仍在说服、继续触碰或阻止离开。")).toBeNull();
  fireEvent.press(screen.getByRole("radio", { name: "我现在不想解释，请先给我一点空间。" }));
  fireEvent.press(screen.getByText("继续练习对方施压"));
  expect(screen.getByText("再试一下就好了。你是不是不喜欢我了？")).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "我已经说了要停。请不要继续。" }));
  fireEvent.press(screen.getByText("对方仍在说服、继续触碰或阻止离开"));

  expect(screen.getByText("这不是因为你没有说清楚")).toBeTruthy();
  expect(screen.getByText("110")).toBeTruthy();
  expect(screen.queryByText(/继续说服|暂停卡|自动拨号/u)).toBeNull();
  const sourcesEntry = screen.getByRole("button", { name: "打开内界官网信息来源" });
  expect(sourcesEntry).toHaveTextContent("查看完整信息来源");
  fireEvent.press(sourcesEntry);
  expect(onOpenSources).toHaveBeenCalledTimes(1);
  expect(screen.getByText("结束这次练习")).toBeTruthy();
});

test("shows completion review, feelings, preparation action, honest retry state, and one echo", async () => {
  const onComplete = jest.fn();
  const onAddToPreparation = jest.fn();
  reachCompleted(onComplete, { onAddToPreparation });

  expect(screen.getByText("我注意到的需要：整体推进得有点快")).toBeTruthy();
  expect(screen.getByText(/我想使用的话：/u)).toBeTruthy();
  expect(screen.getByText("停下来以后，我更想：安静待一会儿")).toBeTruthy();
  fireEvent.press(screen.getByRole("checkbox", { name: "还是有些紧张" }));
  expect(screen.queryByText("先停一下，我需要一点时间。")).toBeNull();
  fireEvent.press(screen.getByRole("checkbox", { name: "可能需要更短一句" }));
  expect(screen.getByText("先停一下，我需要一点时间。")).toBeTruthy();
  fireEvent.press(screen.getByText("继续"));
  expect(screen.queryByRole("button", { name: /暂不可用/u })).toBeNull();
  expect(screen.queryByRole("button", { name: "再练习一个情境" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "把这句话加入准备清单" }));
  await waitFor(() => expect(onAddToPreparation).toHaveBeenCalledWith(expect.any(String)));
  fireEvent.press(screen.getByRole("button", { name: "继续整理我的准备" }));
  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  expect(screen.getAllByText("+1 回响｜你完成了一次表达练习")).toHaveLength(1);
});

test("uses full-width flexible actions and semantic controls for large text layouts", () => {
  render(<PresetPracticePage catalog={catalog} onComplete={jest.fn()} />);
  const start = screen.getByRole("button", { name: "开始情境练习" });
  expect(start.props.accessibilityState.disabled).toBe(false);
  expect(StyleSheet.flatten(start.props.style)).toEqual(expect.objectContaining({ minHeight: 52, minWidth: 44 }));
  expect(screen.queryByText("6 / 7")).toBeNull();
});

test("keeps the editable phrase keyboard-friendly and text-scalable", () => {
  render(<PresetPracticePage catalog={catalog} onComplete={jest.fn()} />);
  fireEvent.press(screen.getByText("开始情境练习"));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  fireEvent.press(screen.getByText("改成我的说法"));

  const input = screen.getByLabelText("我的表达句");
  expect(input).toHaveProp("multiline", true);
  expect(StyleSheet.flatten(input.props.style)).toEqual(expect.objectContaining({ minHeight: 112 }));
  expect(screen.getByText("把需要说出来").props.numberOfLines).toBeUndefined();
});

test("reveals only when the visible practice step changes", async () => {
  const reveal = jest.fn();
  jest.spyOn(guidedScroll, "useJourneyGuidedScroll").mockReturnValue({ reveal });
  render(<PresetPracticePage catalog={catalog} onComplete={jest.fn()} />);
  expect(reveal).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("开始情境练习"));
  await waitFor(() => expect(reveal).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText("整体推进得有点快"));
  await waitFor(() => expect(reveal).toHaveBeenCalledTimes(2));

  fireEvent.press(screen.getByText("改成我的说法"));
  fireEvent.changeText(screen.getByLabelText("我的表达句"), "请慢一点。 ");
  expect(reveal).toHaveBeenCalledTimes(2);

  fireEvent.press(screen.getByText("先对着镜子说一遍"));
  await waitFor(() => expect(reveal).toHaveBeenCalledTimes(3));
  fireEvent.press(screen.getByText("暂时跳过"));
  await waitFor(() => expect(reveal).toHaveBeenCalledTimes(4));
});
