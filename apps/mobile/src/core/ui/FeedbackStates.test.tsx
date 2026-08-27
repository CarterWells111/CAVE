import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, StyleSheet } from "react-native";

import { theme } from "../design/theme";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

describe("feedback states", () => {
  it("announces an empty state politely with visible copy", () => {
    render(<EmptyState title="还没有内容" message="完成一次练习后，内容会显示在这里。" />);

    expect(screen.getByRole("header", { name: "还没有内容" })).toBeTruthy();
    expect(screen.getByRole("summary", { name: "完成一次练习后，内容会显示在这里。" })).toHaveProp(
      "accessibilityLiveRegion",
      "polite",
    );
  });

  it("announces an error assertively with visible copy", () => {
    render(<ErrorState title="暂时无法读取" message="请稍后再试。" />);

    expect(screen.getByRole("header", { name: "暂时无法读取" })).toBeTruthy();
    expect(screen.getByRole("alert", { name: "请稍后再试。" })).toHaveProp(
      "accessibilityLiveRegion",
      "assertive",
    );
  });

  it.each([
    [EmptyState, "开始练习"],
    [ErrorState, "重试"],
  ] as const)("offers an optional accessible recovery action", (FeedbackState, actionLabel) => {
    const onAction = jest.fn();
    render(
      <FeedbackState
        title="状态标题"
        message="状态说明"
        actionLabel={actionLabel}
        onAction={onAction}
      />,
    );

    const action = screen.getByRole("button", { name: actionLabel });
    const style = StyleSheet.flatten(action.props.style);

    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    fireEvent.press(action);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it.each([
    [EmptyState, "开始练习"],
    [ErrorState, "重试"],
  ] as const)("shows a token-backed focus boundary on the recovery action", (FeedbackState, actionLabel) => {
    render(
      <FeedbackState
        title="状态标题"
        message="状态说明"
        actionLabel={actionLabel}
        onAction={jest.fn()}
      />,
    );

    const action = screen.getByRole("button", { name: actionLabel });
    const restingStyle = StyleSheet.flatten(action.props.style);
    fireEvent(action, "focus");

    expect(StyleSheet.flatten(action.props.style)).toEqual(
      expect.objectContaining({
        borderWidth: theme.border.width,
        outlineColor: theme.color.focus,
        outlineOffset: theme.border.focusWidth,
        outlineStyle: "solid",
        outlineWidth: theme.border.focusWidth,
      }),
    );
    expect(restingStyle.borderWidth).toBe(theme.border.width);
  });

  it.each([
    ["empty state", EmptyState, "空状态", "目前没有内容。"],
    ["error state", ErrorState, "读取失败", "请稍后重试。"],
  ] as const)("announces meaningful %s copy through the iOS accessibility API", (_name, FeedbackState, title, message) => {
    const originalExpoOs = process.env.EXPO_OS;
    process.env.EXPO_OS = "ios";
    const announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);

    try {
      render(<FeedbackState title={title} message={message} />);

      expect(announce).toHaveBeenCalledWith(`${title}。${message}`);
    } finally {
      if (originalExpoOs === undefined) {
        delete process.env.EXPO_OS;
      } else {
        process.env.EXPO_OS = originalExpoOs;
      }
      announce.mockRestore();
    }
  });

  it("does not render a recovery button unless both action props are supplied", () => {
    render(<EmptyState title="还没有内容" message="稍后再来看看。" actionLabel="开始" />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
