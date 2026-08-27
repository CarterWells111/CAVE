import { fireEvent, render, screen } from "@testing-library/react-native";

import { PracticeHubScreen } from "./PracticeHubScreen";

test("always identifies local preset practice and opens only user-selected scenarios", () => {
  const onStartScenario = jest.fn();
  render(<PracticeHubScreen
    onStartPractice={jest.fn()}
    onStartScenario={onStartScenario}
    scenarios={[{ id: "pause", title: "练习说暂停", statusLabel: "本地预设" }]}
  />);
  expect(screen.getByText("预设对话，不使用 AI")).toBeTruthy();
  expect(screen.getByText("所有分支都已写在本机内容中，不会生成对话，也不会录音。")).toBeTruthy();
  expect(screen.queryByText(/正在生成|麦克风|输入中/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "开始练习说暂停" }));
  expect(onStartScenario).toHaveBeenCalledWith("pause");
});

test("exposes empty and retryable error states", () => {
  const retry = jest.fn();
  const { rerender } = render(<PracticeHubScreen scenarios={[]} onStartPractice={jest.fn()} onStartScenario={jest.fn()} />);
  expect(screen.getByText("没有可用的预设情境")).toBeTruthy();
  rerender(<PracticeHubScreen loadState="error" onRetry={retry} scenarios={[]} onStartPractice={jest.fn()} onStartScenario={jest.fn()} />);
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  expect(retry).toHaveBeenCalledTimes(1);
});
