import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text as MockText } from "react-native";
import JournalHomeRoute from "../../../app/(tabs)/journal";
const mockPush = jest.fn();
let mockAdult = "public";
let mockAccess = "locked";
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => undefined }));
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({ useAdultDeclaration: () => ({ status: mockAdult }) }));
jest.mock("../journal/runtime/JournalAccessProvider", () => ({ useJournalAccess: () => ({ status: mockAccess }), useReadyJournalService: () => ({}) }));
jest.mock("../journal/ui/JournalRouteGate", () => ({ JournalRouteGate: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("../journal/ui/JournalListScreen", () => ({ JournalListScreen: () => <MockText>账号手记列表</MockText> }));
beforeEach(() => { mockPush.mockClear(); mockAdult = "public"; mockAccess = "locked"; });
test("first launch explains the journal and preserves adult declaration", () => {
 render(<JournalHomeRoute />);
 expect(screen.getByRole("header", { name: "内界手记" })).toBeTruthy();
 expect(screen.queryByText("账号手记列表")).toBeNull();
 fireEvent.press(screen.getByRole("button", { name: "开始写手记" }));
 expect(mockPush).toHaveBeenCalledWith({ pathname: "/journey/adult-gate", params: { entry: "journal" } });
});
test("adult signed-out users enter login without a journey preface", () => {
 mockAdult = "authorized";
 render(<JournalHomeRoute />);
 fireEvent.press(screen.getByRole("button", { name: "开始写手记" }));
 expect(mockPush).toHaveBeenCalledWith({ pathname: "/auth/email", params: { returnTo: "/(tabs)/journal" } });
});
test("ready journal accounts open their list directly on the home tab", () => {
 mockAdult = "authorized"; mockAccess = "ready";
 render(<JournalHomeRoute />);
 expect(screen.getByText("账号手记列表")).toBeTruthy();
 expect(mockPush).not.toHaveBeenCalled();
});
