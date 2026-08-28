import { fireEvent, render, screen } from "@testing-library/react-native";

import { ReviewsHubScreen } from "./ReviewsHubScreen";

test("supports continuing, topic entry, history, and a user-started full six-page review", () => {
  const onContinueReview = jest.fn();
  const onOpenReview = jest.fn();
  const onStartFullReview = jest.fn();
  const onStartTopic = jest.fn();
  render(<ReviewsHubScreen
    activeReview={{ id: "active", title: "本次回顾", dateLabel: "今天", statusLabel: "进行中" }}
    onContinueReview={onContinueReview}
    onOpenReview={onOpenReview}
    onStartFullReview={onStartFullReview}
    onStartTopic={onStartTopic}
    reviews={[{ id: "old", title: "第一次回顾", dateLabel: "8月20日", statusLabel: "已完成" }]}
    topics={[{ id: "boundaries", label: "边界与表达" }]}
  />);

  fireEvent.press(screen.getByRole("button", { name: "继续本次回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "按主题回顾：边界与表达" }));
  fireEvent.press(screen.getByRole("button", { name: "开始完整六页回顾" }));
  expect(onStartFullReview).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "确认开始新回顾" }));
  fireEvent.press(screen.getByRole("button", { name: "打开第一次回顾" }));
  expect(onContinueReview).toHaveBeenCalledWith("active");
  expect(onStartTopic).toHaveBeenCalledWith("boundaries");
  expect(onStartFullReview).toHaveBeenCalledTimes(1);
  expect(onOpenReview).toHaveBeenCalledWith("old");
});

test("has nonblank loading, error, and empty states", () => {
  const retry = jest.fn();
  const { rerender } = render(<ReviewsHubScreen loadState="loading" reviews={[]} topics={[]} onStartFullReview={jest.fn()} onStartTopic={jest.fn()} />);
  expect(screen.getByRole("status")).toBeTruthy();
  rerender(<ReviewsHubScreen loadState="error" onRetry={retry} reviews={[]} topics={[]} onStartFullReview={jest.fn()} onStartTopic={jest.fn()} />);
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  expect(retry).toHaveBeenCalledTimes(1);
  rerender(<ReviewsHubScreen reviews={[]} topics={[]} onStartFullReview={jest.fn()} onStartTopic={jest.fn()} />);
  expect(screen.getByText("还没有历史回顾")).toBeTruthy();
});
