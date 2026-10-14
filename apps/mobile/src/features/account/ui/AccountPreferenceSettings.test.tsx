import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { AccountPreferenceSettings } from "./AccountPreferenceSettings";
const mockChange = jest.fn(async () => undefined);
let mockPreferences = {
  ready: true,
  owner: null,
  preferences: { ageConfirmed: true, addressPreference: "妳" },
  change: mockChange,
};
jest.mock("../runtime/AccountPreferencesProvider", () => ({
  useOptionalAccountPreferences: () => mockPreferences,
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockPreferences = {
    ready: true,
    owner: null,
    preferences: { ageConfirmed: true, addressPreference: "妳" },
    change: mockChange,
  };
});
test("two rows open details and selection; closing performs no save", () => {
  render(<AccountPreferenceSettings onRevoke={jest.fn()} />);
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.queryByText(/撤销后需重新确认/)).toBeNull();
  fireEvent.press(
    screen.getByRole("button", { name: "成年确认，已确认年满 18 岁" }),
  );
  expect(screen.getByText(/已有内容会保留/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "取消" }));
  expect(mockChange).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "界面称呼，妳" }));
  fireEvent.press(screen.getByRole("button", { name: "关闭界面称呼" }));
  expect(mockChange).not.toHaveBeenCalled();
});
test("revocation saves before navigating; address selection saves", async () => {
  const onRevoke = jest.fn();
  render(<AccountPreferenceSettings onRevoke={onRevoke} />);
  fireEvent.press(screen.getByRole("button", { name: "界面称呼，妳" }));
  fireEvent.press(screen.getByRole("radio", { name: "你" }));
  await waitFor(() =>
    expect(mockChange).toHaveBeenCalledWith({ addressPreference: "你" }),
  );
  fireEvent.press(
    screen.getByRole("button", { name: "成年确认，已确认年满 18 岁" }),
  );
  fireEvent.press(screen.getByRole("button", { name: "撤销成年确认" }));
  await waitFor(() => expect(onRevoke).toHaveBeenCalledTimes(1));
  expect(mockChange).toHaveBeenCalledWith({ ageConfirmed: false });
});
test("failed revocation keeps the declaration and route", async () => {
  mockChange.mockRejectedValueOnce(new Error("private path"));
  const onRevoke = jest.fn();
  render(<AccountPreferenceSettings onRevoke={onRevoke} />);
  fireEvent.press(
    screen.getByRole("button", { name: "成年确认，已确认年满 18 岁" }),
  );
  fireEvent.press(screen.getByRole("button", { name: "撤销成年确认" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "设置暂时无法保存，请重试。",
  );
  expect(onRevoke).not.toHaveBeenCalled();
  expect(screen.queryByText("private path")).toBeNull();
});
