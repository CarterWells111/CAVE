import { render, screen } from "@testing-library/react-native";

import { EchoBackground } from "./echo-background";

test.each([false, true])("EchoBackground is accessibility-hidden when reducedMotion=%s", (reducedMotion) => {
  render(<EchoBackground reducedMotion={reducedMotion} testID="echo" />);
  const echo = screen.getByTestId("echo", { includeHiddenElements: true });
  expect(echo).toHaveProp("accessible", false);
  expect(echo).toHaveProp("accessibilityElementsHidden", true);
  expect(echo).toHaveProp("importantForAccessibility", "no-hide-descendants");
  expect(echo).toHaveProp("pointerEvents", "none");
});

test("EchoBackground is explicitly static under reduced motion", () => {
  render(<EchoBackground reducedMotion testID="echo" />);
  expect(screen.getByTestId("echo-layer-1", { includeHiddenElements: true }).props.style.transform).toBeUndefined();
  expect(screen.getByTestId("echo-layer-2", { includeHiddenElements: true }).props.style.transform).toBeUndefined();
});
