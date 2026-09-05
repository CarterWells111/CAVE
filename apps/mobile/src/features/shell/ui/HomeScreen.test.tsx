import { fireEvent, render, screen } from "@testing-library/react-native";
import { HomeScreen } from "./HomeScreen";

const actions = () => ({ onOpenSample: jest.fn(), onOpenScenario: jest.fn() });

test("shows a compact brand/account header and seven journey destinations without record metadata", () => {
  const onOpen = jest.fn();
  const callbacks = actions();
  render(<HomeScreen account={{ displayName: "阿岚", onOpen, status: "ready" }} {...callbacks} />);
  expect(screen.getByText("CAVE 内界")).toBeTruthy();
  expect(screen.getByText("选择一段旅程")).toBeTruthy();
  expect(screen.getAllByRole("button")).toHaveLength(8);
  fireEvent.press(screen.getByRole("button", { name: "打开旅程 03，样板" }));
  fireEvent.press(screen.getByRole("button", { name: "体验第一次过夜" }));
  fireEvent.press(screen.getByRole("button", { name: "查看阿岚的账号" }));
  expect(callbacks.onOpenSample).toHaveBeenCalledWith("journey-03");
  expect(callbacks.onOpenScenario).toHaveBeenCalledTimes(1);
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/最近手记|沟通草稿|已有进行中的回顾/u)).toBeNull();
});

test("shows a compact login CTA only while signed out", () => {
  const onOpen = jest.fn();
  const callbacks = actions();
  const view = render(<HomeScreen account={{ onOpen, status: "signedOut" }} {...callbacks} />);
  fireEvent.press(screen.getByRole("button", { name: "登录" }));
  expect(onOpen).toHaveBeenCalledTimes(1);
  view.rerender(<HomeScreen account={{ displayName: "内界用户", onOpen, status: "ready" }} {...callbacks} />);
  expect(screen.queryByRole("button", { name: "登录" })).toBeNull();
  expect(screen.getByRole("button", { name: "查看内界用户的账号" })).toBeTruthy();
});

test("disables account navigation while profile status is loading", () => {
  const onOpen = jest.fn();
  render(<HomeScreen account={{ onOpen, status: "loading" }} {...actions()} />);
  const button = screen.getByRole("button", { name: "正在检查账号状态…" });
  expect(button).toBeDisabled();
  fireEvent.press(button);
  expect(onOpen).not.toHaveBeenCalled();
});

test("shows a keyboard focus ring on the compact account entry", () => {
  render(<HomeScreen account={{ onOpen: jest.fn(), status: "signedOut" }} {...actions()} />);
  const button = screen.getByRole("button", { name: "登录" });
  fireEvent(button, "focus");
  expect(button).toHaveStyle({ outlineWidth: 2 });
  fireEvent(button, "blur");
  expect(button).toHaveStyle({ outlineWidth: 0 });
});

test("renders loading and retryable errors without exposing map nodes", () => {
  const retry = jest.fn();
  const callbacks = actions();
  const { rerender } = render(<HomeScreen loadState="loading" {...callbacks} />);
  expect(screen.getByRole("status")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "体验第一次过夜" })).toBeNull();
  rerender(<HomeScreen loadState="error" onRetry={retry} {...callbacks} />);
  fireEvent.press(screen.getByRole("button", { name: "重试" }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("旅程 01")).toBeNull();
  rerender(<HomeScreen {...callbacks} />);
  expect(screen.getByText("旅程 01")).toBeTruthy();
});
