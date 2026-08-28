import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { theme } from "../design/theme";
import { Card } from "./Card";

describe("Card", () => {
  it.each(["default", "muted", "accent"] as const)(
    "renders the %s hierarchy variant with a visible boundary",
    (variant) => {
      render(
        <Card variant={variant} testID={`card-${variant}`} accessibilityLabel={`${variant} card`}>
          <Text>卡片正文</Text>
        </Card>,
      );

      const card = screen.getByTestId(`card-${variant}`);
      const style = StyleSheet.flatten(card.props.style);

      expect(style.borderWidth).toBeGreaterThan(0);
      expect(style.borderRadius).toBeGreaterThan(0);
      expect(style.padding).toBeGreaterThan(0);
    },
  );

  it("groups its content while retaining caller accessibility props", () => {
    render(
      <Card testID="grouped-card" accessibilityLabel="今日提示" accessibilityHint="阅读卡片内容">
        <Text>放慢一点</Text>
        <Text>留意身体感受</Text>
      </Card>,
    );

    const card = screen.getByRole("summary", { name: "今日提示" });
    expect(card).toHaveProp("accessible", true);
    expect(card).toHaveProp("accessibilityHint", "阅读卡片内容");
    expect(screen.getByText("放慢一点")).toBeTruthy();
    expect(screen.getByText("留意身体感受")).toBeTruthy();
  });

  it("distinguishes hierarchy variants with boundary treatment, not color alone", () => {
    render(
      <>
        <Card testID="default-card">
          <Text>默认</Text>
        </Card>
        <Card variant="muted" testID="muted-card">
          <Text>柔和</Text>
        </Card>
        <Card variant="accent" testID="accent-card">
          <Text>强调</Text>
        </Card>
      </>,
    );

    const defaultStyle = StyleSheet.flatten(screen.getByTestId("default-card").props.style);
    const mutedStyle = StyleSheet.flatten(screen.getByTestId("muted-card").props.style);
    const accentStyle = StyleSheet.flatten(screen.getByTestId("accent-card").props.style);

    expect(defaultStyle).toEqual(
      expect.objectContaining({ borderStyle: "solid", borderWidth: theme.border.width }),
    );
    expect(mutedStyle).toEqual(
      expect.objectContaining({ borderStyle: "dashed", borderWidth: theme.border.width }),
    );
    expect(accentStyle).toEqual(
      expect.objectContaining({ borderStyle: "solid", borderWidth: theme.border.focusWidth }),
    );
  });
});
