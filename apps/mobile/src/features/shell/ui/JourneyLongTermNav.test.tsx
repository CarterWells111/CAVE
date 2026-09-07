import { fireEvent, render, screen } from "@testing-library/react-native";

import { JourneyLongTermNav } from "./JourneyLongTermNav";

const mockReplace = jest.fn();
const mockLoad = jest.fn();
const mockRouter = { replace: mockReplace };
const mockShellState = { load: mockLoad };
let mockRuntime: {
  shellState: typeof mockShellState;
  snapshot: { ageConfirmed: boolean } | null;
} | null = null;

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../journey/runtime/JourneyRuntimeProvider", () => ({
  useOptionalJourneyRuntime: () => mockRuntime
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRuntime = null;
  mockLoad.mockReturnValue(new Promise<null>(() => undefined));
});

test("renders the four current tabs without consulting runtime or private shell state", () => {
  render(<JourneyLongTermNav activeTab="journal" />);

  expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual([
    "旅程",
    "内界手记",
    "AI",
    "我的"
  ]);
  expect(screen.queryByRole("tab", { name: "练习" })).toBeNull();
  expect(mockLoad).not.toHaveBeenCalled();
});

test("keeps the same immediate navigation when an authorized runtime exists", () => {
  mockRuntime = { shellState: mockShellState, snapshot: { ageConfirmed: true } };
  render(<JourneyLongTermNav activeTab="journal" />);

  expect(screen.getAllByRole("tab")).toHaveLength(4);
  expect(screen.queryByRole("tab", { name: "练习" })).toBeNull();
  expect(mockLoad).not.toHaveBeenCalled();
});

test("routes each currently visible tab destination", () => {
  render(<JourneyLongTermNav activeTab="ai" />);

  fireEvent.press(screen.getByRole("tab", { name: "内界手记" }));
  fireEvent.press(screen.getByRole("tab", { name: "AI" }));
  fireEvent.press(screen.getByRole("tab", { name: "旅程" }));
  fireEvent.press(screen.getByRole("tab", { name: "我的" }));

  expect(mockReplace.mock.calls).toEqual([
    ["/(tabs)/journal"],
    ["/(tabs)/ai"],
    ["/(tabs)"],
    ["/(tabs)/profile"]
  ]);
  expect(mockLoad).not.toHaveBeenCalled();
});

test("does not replace the route while journey persistence is locked", () => {
  render(<JourneyLongTermNav activeTab="journal" disabled />);

  for (const tab of screen.getAllByRole("tab")) {
    expect(tab).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
    fireEvent.press(tab);
  }
  expect(mockReplace).not.toHaveBeenCalled();
});
