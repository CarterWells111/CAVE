import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react-native";

import { StatusBanner } from "../../../../core/ui/StatusBanner";
import { JourneyStatusBanner } from "./JourneyStatusBanner";

test.each([
  ["info", "ⓘ", "status", "polite"],
  ["success", "✓", "status", "polite"],
  ["error", "×", "alert", "assertive"]
] as const)(
  "maps %s tone through the core banner with %s semantics",
  (tone, icon, role, liveRegion) => {
    const { UNSAFE_getByType } = render(
      <JourneyStatusBanner message="状态说明" tone={tone} />
    );

    expect(UNSAFE_getByType(StatusBanner).props).toEqual(
      expect.objectContaining({ message: "状态说明", variant: tone })
    );
    const status = screen.getByLabelText(`${icon} 状态说明`);
    expect(status).toHaveProp("role", role);
    expect(status).toHaveProp("accessibilityLiveRegion", liveRegion);
    expect(screen.getByText(icon)).toBeTruthy();
  }
);

test("preserves explicit label and role overrides around the core banner", () => {
  const { UNSAFE_getByType } = render(
    <JourneyStatusBanner
      accessibilityLabel="恢复提醒"
      message="本机旅程需要恢复"
      role="alert"
      testID="recovery-status"
    />
  );

  expect(UNSAFE_getByType(StatusBanner)).toBeTruthy();
  expect(screen.getByTestId("recovery-status")).toHaveProp("role", "alert");
  expect(screen.getByTestId("recovery-status")).toHaveProp(
    "accessibilityLiveRegion",
    "assertive"
  );
  expect(screen.getByLabelText("恢复提醒")).toBeTruthy();
  expect(
    screen.getByText("本机旅程需要恢复", { includeHiddenElements: true })
  ).toBeTruthy();
});

test("does not retain journey-local visual tokens or log banner content", () => {
  const consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
  const source = readFileSync(join(__dirname, "JourneyStatusBanner.tsx"), "utf8");

  render(<JourneyStatusBanner message="private status content" tone="error" />);

  expect(source).not.toContain("journey-ui-tokens");
  expect(source).not.toMatch(/journeyColors|journeyRadii|journeySpacing/u);
  expect(consoleLog).not.toHaveBeenCalled();
  consoleLog.mockRestore();
});
