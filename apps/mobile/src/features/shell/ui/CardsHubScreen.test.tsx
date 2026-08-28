import { fireEvent, render, screen } from "@testing-library/react-native";

import { CardsHubScreen } from "./CardsHubScreen";

test("offers only private draft review and edit actions", () => {
  const onEdit = jest.fn();
  const onOpenHistory = jest.fn();
  render(<CardsHubScreen
    currentCard={{ id: "current", title: "沟通草稿", dateLabel: "今天", statusLabel: "已保存" }}
    history={[{ id: "old", title: "沟通草稿版本 1", dateLabel: "8月20日", statusLabel: "历史版本" }]}
    onEdit={onEdit}
    onOpenHistory={onOpenHistory}
  />);

  expect(screen.getByRole("header", { name: "沟通草稿箱" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "编辑当前沟通草稿" }));
  fireEvent.press(screen.getByRole("button", { name: "打开沟通草稿版本 1" }));
  expect(onEdit).toHaveBeenCalledWith("current");
  expect(onOpenHistory).toHaveBeenCalledWith("old");
  expect(screen.queryByText(/复制|全屏|云端/u)).toBeNull();
});
test("has loading, empty, and retryable error destinations", () => {
  const retry = jest.fn();
  const { rerender } = render(<CardsHubScreen loadState="loading" history={[]} />);
  expect(screen.getByRole("status")).toBeTruthy();
  rerender(<CardsHubScreen loadState="error" history={[]} onRetry={retry} />);
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  expect(retry).toHaveBeenCalledTimes(1);
  rerender(<CardsHubScreen history={[]} />);
  expect(screen.getByText("还没有沟通草稿")).toBeTruthy();
  expect(screen.getByText("还没有历史版本")).toBeTruthy();
});
