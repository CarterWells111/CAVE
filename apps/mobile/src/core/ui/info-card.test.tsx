import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { darkTheme as theme } from "../design/theme";
import { InfoCard } from "./info-card";

test.each([
  ["default", "说明", theme.color.brandLavender],
  ["medical", "医学事实", theme.color.brandLavender],
  ["education", "教育原则", theme.color.infoMuted],
  ["pause", "暂停原则", theme.color.brandSoft],
  ["safety", "安全资源", theme.color.safetyMuted],
] as const)("renders %s information with a visible semantic label and line", (variant, label, tone) => {
  render(<InfoCard title="标题" variant={variant} testID="card"><Text>正文</Text></InfoCard>);
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText("标题")).toBeTruthy();
  expect(screen.getByText("正文")).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByTestId("card").props.style)).toEqual(expect.objectContaining({
    backgroundColor: theme.color.surface,
    borderLeftColor: tone,
    borderLeftWidth: 3,
    borderRadius: 16,
  }));
});
