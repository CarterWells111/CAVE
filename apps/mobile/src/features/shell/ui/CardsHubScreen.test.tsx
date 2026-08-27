import { fireEvent, render, screen } from "@testing-library/react-native";

import { CardsHubScreen } from "./CardsHubScreen";

test("offers current and historical card actions without previewing sensitive body text", () => {
  const onCopy = jest.fn();
  const onEdit = jest.fn();
  const onFullscreen = jest.fn();
  const onOpenHistory = jest.fn();
  render(<CardsHubScreen
    currentCard={{ id: "current", title: "当前沟通卡", dateLabel: "今天", statusLabel: "已保存" }}
    history={[{ id: "old", title: "沟通卡版本 1", dateLabel: "8月20日", statusLabel: "历史版本" }]}
    onCopy={onCopy}
    onEdit={onEdit}
    onFullscreen={onFullscreen}
    onOpenHistory={onOpenHistory}
  />);
  expect(screen.getAllByText("当前沟通卡")).toHaveLength(2);
  expect(screen.getByText("今天 · 已保存")).toBeTruthy();
  expect(screen.queryByText(/我愿意|我不希望|正文/u)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "编辑当前沟通卡" }));
  fireEvent.press(screen.getByRole("button", { name: "复制当前沟通卡" }));
  fireEvent.press(screen.getByRole("button", { name: "全屏展示当前沟通卡" }));
  fireEvent.press(screen.getByRole("button", { name: "打开沟通卡版本 1" }));
  expect(onEdit).toHaveBeenCalledWith("current");
  expect(onCopy).toHaveBeenCalledWith("current");
  expect(onFullscreen).toHaveBeenCalledWith("current");
  expect(onOpenHistory).toHaveBeenCalledWith("old");
  expect(screen.getByRole("button", { name: "保存到云端｜后续版本" }))
    .toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
});

test("has loading, empty, and retryable error destinations", () => {
  const retry = jest.fn();
  const { rerender } = render(<CardsHubScreen loadState="loading" history={[]} />);
  expect(screen.getByRole("status")).toBeTruthy();
  rerender(<CardsHubScreen loadState="error" history={[]} onRetry={retry} />);
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  expect(retry).toHaveBeenCalledTimes(1);
  rerender(<CardsHubScreen history={[]} />);
  expect(screen.getByText("还没有沟通卡")).toBeTruthy();
  expect(screen.getByText("还没有历史版本")).toBeTruthy();
});
