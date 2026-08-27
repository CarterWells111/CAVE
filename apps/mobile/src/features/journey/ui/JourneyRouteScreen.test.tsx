import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { createJourneyDraft, type JourneyDraft } from "../domain/types";
import { JourneyContinueButton, JourneyRouteScreen } from "./JourneyRouteScreen";

const mockReplace = jest.fn();
const mockRuntime = {
  snapshot: null as JourneyDraft | null,
  service: {
    getSnapshot: jest.fn<JourneyDraft | null, []>(() => null),
    navigateTo: jest.fn(async () => undefined),
    resetJourney: jest.fn(async () => undefined)
  },
  controller: {},
  runAndRefresh: jest.fn(async <T,>(action: () => Promise<T>) => action())
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace })
}));

jest.mock("../runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => mockRuntime
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRuntime.snapshot = null;
  mockRuntime.service.getSnapshot.mockImplementation(() => mockRuntime.snapshot);
});

test("redirects an unconfirmed visitor before rendering an adult-only page", async () => {
  render(
    <JourneyRouteScreen pageId="overnight">
      {() => <Text>protected-form</Text>}
    </JourneyRouteScreen>
  );

  expect(screen.queryByText("protected-form")).toBeNull();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/journey/welcome"));
});

test("renders active snapshot state and persists back navigation before replacing", async () => {
  mockRuntime.snapshot = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage: "reflection"
  };

  render(
    <JourneyRouteScreen pageId="reflection">
      {({ snapshot }) => <Text>{snapshot?.id}</Text>}
    </JourneyRouteScreen>
  );

  expect(screen.getByText("journey-1")).toBeTruthy();
  fireEvent.press(screen.getByTestId("journey-back"));

  await waitFor(() => {
    expect(mockRuntime.service.navigateTo).toHaveBeenCalledWith("behavior-attitudes");
    expect(mockReplace).toHaveBeenCalledWith("/journey/behavior-attitudes");
  });
  expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(1);
});

test("gives route content a goTo action that persists the next page", async () => {
  mockRuntime.snapshot = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage: "overnight"
  };

  render(
    <JourneyRouteScreen pageId="overnight">
      {({ goTo }) => (
        <Pressable accessibilityRole="button" onPress={() => { void goTo("body-knowledge"); }}>
          <Text>next-page</Text>
        </Pressable>
      )}
    </JourneyRouteScreen>
  );

  fireEvent.press(screen.getByText("next-page"));
  await waitFor(() => {
    expect(mockRuntime.service.navigateTo).toHaveBeenCalledWith("body-knowledge");
    expect(mockReplace).toHaveBeenCalledWith("/journey/body-knowledge");
  });
});

test("offers a shared positive-navigation action without page-specific styling", () => {
  const onPress = jest.fn();

  render(<JourneyContinueButton onPress={onPress} />);
  fireEvent.press(screen.getByText("继续"));

  expect(onPress).toHaveBeenCalledTimes(1);
});
