import { fireEvent, render, screen } from "@testing-library/react-native";

import { ProfileScreen } from "./ProfileScreen";

const card = { id: "card-1", title: "沟通卡", dateLabel: "2026-08-28", statusLabel: "仅存本机" };
const olderCard = { id: "card-2", title: "沟通卡", dateLabel: "2026-08-26", statusLabel: "仅存本机" };
const review = { id: "review-1", title: "最近回顾", dateLabel: "2026-08-27", statusLabel: "已完成" };

test("shows separate card and review archives with settings and detail actions", () => {
  const onOpenCard = jest.fn();
  const onOpenReview = jest.fn();
  const onOpenSettings = jest.fn();

  render(
    <ProfileScreen
      cards={[card, olderCard]}
      onOpenCard={onOpenCard}
      onOpenReview={onOpenReview}
      onOpenSettings={onOpenSettings}
      reviews={[review]}
    />,
  );

  expect(screen.getByRole("header", { name: "我的" })).toBeTruthy();
  expect(screen.getByRole("header", { name: "我的卡片" })).toBeTruthy();
  expect(screen.getByRole("header", { name: "我的回顾" })).toBeTruthy();
  expect(screen.getByText("2026-08-28 · 仅存本机")).toBeTruthy();
  expect(screen.getByText("2026-08-27 · 已完成")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "设置" }));
  const newestCardAction = screen.getByRole("button", { name: "打开沟通卡，2026-08-28，仅存本机" });
  expect(screen.getByRole("button", { name: "打开沟通卡，2026-08-26，仅存本机" })).toBeTruthy();
  fireEvent.press(newestCardAction);
  fireEvent.press(screen.getByRole("button", { name: "打开最近回顾，2026-08-27，已完成" }));

  expect(onOpenSettings).toHaveBeenCalledTimes(1);
  expect(onOpenCard).toHaveBeenCalledWith("card-1");
  expect(onOpenReview).toHaveBeenCalledWith("review-1");
});

test("keeps cards available when reviews fail and retries only the failed archive", () => {
  const onRetryCards = jest.fn();
  const onRetryReviews = jest.fn();

  render(
    <ProfileScreen
      cards={[card]}
      cardsLoadState="ready"
      onOpenSettings={jest.fn()}
      onRetryCards={onRetryCards}
      onRetryReviews={onRetryReviews}
      reviews={[]}
      reviewsLoadState="error"
    />,
  );

  expect(screen.getByText("2026-08-28 · 仅存本机")).toBeTruthy();
  expect(screen.getByText("暂时无法读取本机历史回顾。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试读取回顾" }));
  expect(onRetryReviews).toHaveBeenCalledTimes(1);
  expect(onRetryCards).not.toHaveBeenCalled();
});

test("keeps reviews available when cards fail and retries only the failed archive", () => {
  const onRetryCards = jest.fn();
  const onRetryReviews = jest.fn();

  render(
    <ProfileScreen
      cards={[]}
      cardsLoadState="error"
      onOpenSettings={jest.fn()}
      onRetryCards={onRetryCards}
      onRetryReviews={onRetryReviews}
      reviews={[review]}
      reviewsLoadState="ready"
    />,
  );

  expect(screen.getByText("最近回顾")).toBeTruthy();
  expect(screen.getByText("暂时无法读取本机沟通卡。")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "重试读取卡片" }));
  expect(onRetryCards).toHaveBeenCalledTimes(1);
  expect(onRetryReviews).not.toHaveBeenCalled();
});

test("shows independent loading and empty states", () => {
  render(
    <ProfileScreen
      cards={[]}
      cardsLoadState="loading"
      onOpenSettings={jest.fn()}
      reviews={[]}
      reviewsLoadState="ready"
    />,
  );

  expect(screen.getByRole("status")).toBeTruthy();
  expect(screen.getByText("还没有历史回顾")).toBeTruthy();
});
