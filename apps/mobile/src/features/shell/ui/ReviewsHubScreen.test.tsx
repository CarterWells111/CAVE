import { fireEvent, render, screen } from "@testing-library/react-native";

import { ReviewsHubScreen } from "./ReviewsHubScreen";

test("supports continuing, topic entry, and a user-started full six-page review without history", () => {
  const onContinueReview = jest.fn();
  const onStartFullReview = jest.fn();
  const onStartTopic = jest.fn();
  render(<ReviewsHubScreen
    activeReview={{ id: "active", title: "本次回顾", dateLabel: "今天", statusLabel: "进行中" }}
    onContinueReview={onContinueReview}
    onStartFullReview={onStartFullReview}
    onStartTopic={onStartTopic}
    topics={[{ id: "boundaries", label: "边界与表达" }]}
  />);

  fireEvent.press(screen.getByRole("button", { name: "继续本次回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "按主题回顾：边界与表达" }));
  fireEvent.press(screen.getByRole("button", { name: "开始完整六页回顾" }));
  expect(onStartFullReview).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "确认开始新回顾" }));
  expect(onContinueReview).toHaveBeenCalledWith("active");
  expect(onStartTopic).toHaveBeenCalledWith("boundaries");
  expect(onStartFullReview).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("header", { name: "历史回顾" })).toBeNull();
});

test("has nonblank loading, error, and empty states", () => {
  const retry = jest.fn();
  const { rerender } = render(<ReviewsHubScreen loadState="loading" topics={[]} onStartFullReview={jest.fn()} onStartTopic={jest.fn()} />);
  expect(screen.getByRole("status")).toBeTruthy();
  rerender(<ReviewsHubScreen loadState="error" onRetry={retry} topics={[]} onStartFullReview={jest.fn()} onStartTopic={jest.fn()} />);
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  expect(retry).toHaveBeenCalledTimes(1);
  rerender(<ReviewsHubScreen topics={[]} onStartFullReview={jest.fn()} onStartTopic={jest.fn()} />);
  expect(screen.getByText("当前没有可用主题，仍可启动完整回顾。")).toBeTruthy();
});
