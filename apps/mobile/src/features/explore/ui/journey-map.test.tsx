import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";

import { darkTheme, lightTheme } from "../../../core/design/theme";
import { ThemeProvider } from "../../../core/design/theme-provider";
import { SAMPLE_JOURNEYS } from "../catalog";
import { JourneyMap } from "./journey-map";

const callbacks = () => ({ onOpenSample: jest.fn(), onOpenScenario: jest.fn() });
const originalWindow = Dimensions.get("window");

beforeEach(() => {
  act(() => Dimensions.set({ window: { ...originalWindow, width: 390, fontScale: 1 } }));
});

afterEach(() => {
  act(() => Dimensions.set({ window: originalWindow }));
});

it("provides six available circular sample buttons and the independent optional scenario", () => {
  const actions = callbacks();
  render(<JourneyMap {...actions} />);

  expect(screen.getAllByRole("button")).toHaveLength(7);
  for (const journey of SAMPLE_JOURNEYS) {
    const button = screen.getByRole("button", { name: `打开${journey.title}，样板` });
    expect(button).toBeEnabled();
    const style = StyleSheet.flatten(button.props.style);
    expect(style.width).toBe(style.height);
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.borderRadius).toBeGreaterThanOrEqual(style.width / 2);
    fireEvent.press(button);
    expect(actions.onOpenSample).toHaveBeenLastCalledWith(journey.id);
  }
  expect(actions.onOpenSample).toHaveBeenCalledTimes(6);
  fireEvent.press(screen.getByRole("button", { name: "体验第一次过夜" }));
  expect(actions.onOpenScenario).toHaveBeenCalledTimes(1);
  expect(screen.getByText("情景演绎 · 可选体验")).toBeTruthy();
  expect(screen.queryByText(/解锁|积分|连续|沟通草稿|手记/u)).toBeNull();
});

it("keeps the scenario beside the second and third samples in the ordinary layout", () => {
  render(<JourneyMap {...callbacks()} />);
  const branch = screen.getByTestId("journey-map-scenario-branch");
  expect(branch).toHaveStyle({ flexDirection: "row" });
  expect(within(branch).getByRole("button", { name: "打开旅程 02，样板" })).toBeTruthy();
  expect(within(branch).getByRole("button", { name: "打开旅程 03，样板" })).toBeTruthy();
  expect(within(branch).getByRole("button", { name: "体验第一次过夜" })).toBeTruthy();
});

it("only disables the optional scenario while opening it and retains an accessible retry state", () => {
  const actions = callbacks();
  const view = render(<JourneyMap {...actions} scenarioPending />);
  const scenario = screen.getByRole("button", { name: "体验第一次过夜" });
  expect(scenario.props.accessibilityState).toEqual({ busy: true, disabled: true });
  fireEvent.press(scenario);
  expect(actions.onOpenScenario).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "打开旅程 06，样板" }));
  expect(actions.onOpenSample).toHaveBeenCalledWith("journey-06");

  view.rerender(<JourneyMap {...actions} scenarioError />);
  expect(screen.getByRole("alert")).toHaveTextContent("暂时无法打开，请再试一次。");
  expect(screen.getByRole("alert")).toHaveProp("selectable", true);
  fireEvent.press(screen.getByRole("button", { name: "体验第一次过夜" }));
  expect(actions.onOpenScenario).toHaveBeenCalledTimes(1);
});

it.each([lightTheme, darkTheme])("uses readable $name theme tokens for nodes and labels", async (theme) => {
  render(
    <ThemeProvider repository={{ load: async () => theme.name, save: async () => undefined }}>
      <JourneyMap {...callbacks()} />
    </ThemeProvider>,
  );
  const sample = await screen.findByRole("button", { name: "打开旅程 01，样板" });
  expect(sample).toHaveStyle({ backgroundColor: theme.color.surfaceAccent, borderColor: theme.color.primary });
  expect(screen.getByText("旅程 01")).toHaveStyle({ color: theme.color.text });
  expect(screen.getByText("第一次过夜")).toHaveStyle({ color: theme.color.text });
});

it.each([{ width: 320, fontScale: 1 }, { width: 390, fontScale: 2 }, { width: 320, fontScale: 2.5 }])(
  "flows safely at $width points and font scale $fontScale", ({ width, fontScale }) => {
    const original = Dimensions.get("window");
    act(() => Dimensions.set({ window: { ...original, width, fontScale } }));
    const view = render(<JourneyMap {...callbacks()} />);
    try {
      expect(screen.getByTestId("journey-map-scenario-branch")).toHaveStyle({ flexDirection: "column" });
      expect(screen.getAllByRole("button")).toHaveLength(7);
      for (const title of [...SAMPLE_JOURNEYS.map(({ title }) => title), "第一次过夜"]) {
        const text = screen.getByText(title);
        expect(text).toHaveProp("selectable", true);
        expect(text.props.numberOfLines).toBeUndefined();
      }
    } finally {
      view.unmount();
      act(() => Dimensions.set({ window: original }));
    }
  },
);

it("hides the decorative trail from accessibility and gives controls a focus ring", () => {
  render(<JourneyMap {...callbacks()} />);
  for (const trail of screen.getAllByTestId("journey-map-trail", { includeHiddenElements: true })) {
    expect(trail).toHaveProp("accessibilityElementsHidden", true);
    expect(trail).toHaveProp("importantForAccessibility", "no-hide-descendants");
    expect(trail).toHaveProp("pointerEvents", "none");
  }
  const button = screen.getByRole("button", { name: "打开旅程 01，样板" });
  fireEvent(button, "focus");
  expect(button).toHaveStyle({ outlineWidth: 2 });
  fireEvent(button, "blur");
  expect(button).toHaveStyle({ outlineWidth: 0 });
});

it("switches layout when the measured container is narrower than the window", () => {
  render(<JourneyMap {...callbacks()} />);
  const map = screen.getByTestId("journey-map");
  fireEvent(map, "layout", { nativeEvent: { layout: { width: 300, height: 1200, x: 0, y: 0 } } });
  expect(screen.getByTestId("journey-map-scenario-branch")).toHaveStyle({ flexDirection: "column" });
  fireEvent(map, "layout", { nativeEvent: { layout: { width: 340, height: 1200, x: 0, y: 0 } } });
  expect(screen.getByTestId("journey-map-scenario-branch")).toHaveStyle({ flexDirection: "row" });
});
