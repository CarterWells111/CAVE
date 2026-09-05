import { fireEvent, render, screen } from "@testing-library/react-native";

import { ReviewsHubScreen } from "./ReviewsHubScreen";

test("supports continuing, topic entry, and journey selection without history or replacement", () => {
  const onContinueReview = jest.fn();
  const onSelectJourney = jest.fn();
  const onStartTopic = jest.fn();
  render(<ReviewsHubScreen
    activeJourney={{ id: "active", kind: "review", title: "本次回顾", dateLabel: "今天", statusLabel: "进行中" }}
    onContinueJourney={onContinueReview}
    onSelectJourney={onSelectJourney}
    onStartTopic={onStartTopic}
    topics={[{ id: "boundaries", label: "边界与表达" }]}
  />);

  fireEvent.press(screen.getByRole("button", { name: "继续本次回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "按主题回顾：边界与表达" }));
  fireEvent.press(screen.getByRole("button", { name: "选择旅程" }));
  expect(onSelectJourney).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "确认开始新回顾" })).toBeNull();
  expect(onContinueReview).toHaveBeenCalledWith("active");
  expect(onStartTopic).toHaveBeenCalledWith("boundaries");
  expect(onSelectJourney).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("header", { name: "历史回顾" })).toBeNull();
});

test("continues the initial journey while also allowing map selection", () => {
  const onContinueJourney = jest.fn();
  const onSelectJourney = jest.fn();
  render(
    <ReviewsHubScreen
      activeJourney={{ id: "initial", kind: "initial", title: "首次旅程", dateLabel: "今天", statusLabel: "进行中" }}
      onContinueJourney={onContinueJourney}
      onSelectJourney={onSelectJourney}
      onStartTopic={jest.fn()}
      topics={[{ id: "boundaries", label: "边界与表达" }]}
    />,
  );

  fireEvent.press(screen.getByRole("button", { name: "继续首次旅程" }));
  expect(onContinueJourney).toHaveBeenCalledWith("initial");
  fireEvent.press(screen.getByRole("button", { name: "选择旅程" }));
  expect(screen.getByRole("button", { name: "按主题回顾：边界与表达" })).toBeTruthy();
  expect(onSelectJourney).toHaveBeenCalledTimes(1);
});

test("has nonblank loading, error, and empty states", () => {
  const retry = jest.fn();
  const { rerender } = render(<ReviewsHubScreen loadState="loading" topics={[]} onSelectJourney={jest.fn()} onStartTopic={jest.fn()} />);
  expect(screen.getByRole("status")).toBeTruthy();
  rerender(<ReviewsHubScreen loadState="error" onRetry={retry} topics={[]} onSelectJourney={jest.fn()} onStartTopic={jest.fn()} />);
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  expect(retry).toHaveBeenCalledTimes(1);
  rerender(<ReviewsHubScreen topics={[]} onSelectJourney={jest.fn()} onStartTopic={jest.fn()} />);
  expect(screen.getByText("当前没有可用主题，可以先选择一段旅程。")).toBeTruthy();
});
