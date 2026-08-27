import { render, screen } from "@testing-library/react-native";

import { JourneyScreenShell } from "./JourneyScreenShell";

test.each([
  ["welcome", 1],
  ["overnight", 2],
  ["body-knowledge", 3],
  ["behavior-attitudes", 4],
  ["reflection", 5],
  ["preset-practice", 6],
  ["checklist", 7],
  ["communication-card", 8]
] as const)("renders %s as page %i without readiness language", (pageId, pageNumber) => {
  render(<JourneyScreenShell pageId={pageId} />);

  expect(screen.getByTestId(`journey-page-${pageId}`)).toBeTruthy();
  expect(screen.getByText(`第 ${pageNumber} 页，共 8 页`)).toBeTruthy();
  expect(screen.queryByText(/准备度|readiness|score|percentage/iu)).toBeNull();
});
