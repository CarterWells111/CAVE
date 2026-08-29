import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, ScrollView, Text } from "react-native";

import {
  JourneyGuidedScrollScreen,
  JourneyScrollTarget,
  useJourneyGuidedScroll,
} from "./guided-scroll-screen";

function RevealHarness() {
  const { reveal } = useJourneyGuidedScroll();
  return (
    <>
      <JourneyScrollTarget targetId="next-action">
        <Text>下一步</Text>
      </JourneyScrollTarget>
      <Text accessibilityRole="button" onPress={() => reveal("next-action")}>显示下一步</Text>
    </>
  );
}

test("renders one guided Screen and registers stable target wrappers", () => {
  render(
    <JourneyGuidedScrollScreen testID="guided-screen">
      <RevealHarness />
    </JourneyGuidedScrollScreen>,
  );

  const scroll = screen.getByTestId("guided-screen");
  expect(scroll.props.scrollEventThrottle).toBe(16);
  expect(typeof scroll.props.onScroll).toBe("function");
  expect(typeof scroll.props.onScrollBeginDrag).toBe("function");
  expect(screen.getByTestId("journey-scroll-target-next-action")).toHaveProp("collapsable", false);
});

test("turns a page reveal request into the minimum native scroll", () => {
  jest.useFakeTimers();
  const nativePrototype = ScrollView.prototype as unknown as {
    measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
  };
  const measureScreen = jest.spyOn(nativePrototype, "measureInWindow")
    .mockImplementationOnce((callback) => callback(0, 0, 320, 640))
    .mockImplementationOnce((callback) => callback(0, 700, 320, 48));
  const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(() => undefined);
  const view = render(
    <JourneyGuidedScrollScreen testID="measured-screen">
      <RevealHarness />
    </JourneyGuidedScrollScreen>,
  );

  try {
    fireEvent.scroll(screen.getByTestId("measured-screen"), {
      nativeEvent: { contentOffset: { x: 0, y: 100 } },
    });
    fireEvent.press(screen.getByRole("button", { name: "显示下一步" }));
    jest.runAllTimers();

    expect(measureScreen).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenCalledWith({ animated: true, y: 224 });
  } finally {
    view.unmount();
    measureScreen.mockRestore();
    scrollTo.mockRestore();
    jest.useRealTimers();
  }
});

test("subscribes to the operating-system reduce-motion preference and cleans up", () => {
  const remove = jest.fn();
  const preference = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  const fakeSubscription = { remove } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  const subscription = jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue(fakeSubscription);
  preference.mockClear();
  subscription.mockClear();

  const view = render(<JourneyGuidedScrollScreen><Text>内容</Text></JourneyGuidedScrollScreen>);
  view.unmount();

  expect(preference).toHaveBeenCalledTimes(1);
  expect(subscription).toHaveBeenCalledWith("reduceMotionChanged", expect.any(Function));
  expect(remove).toHaveBeenCalledTimes(1);
});

test("keeps the hook safe outside a guided journey screen", () => {
  function OutsideHarness() {
    const { reveal } = useJourneyGuidedScroll();
    return <Text accessibilityRole="button" onPress={() => reveal("missing")}>继续</Text>;
  }
  render(<OutsideHarness />);

  expect(() => fireEvent.press(screen.getByRole("button", { name: "继续" }))).not.toThrow();
});
