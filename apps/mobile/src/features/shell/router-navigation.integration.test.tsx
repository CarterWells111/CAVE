import { resolve } from "node:path";
import { Text } from "react-native";
import * as Linking from "expo-linking";
import { Stack, router } from "expo-router";
import { act, fireEvent, getMockContext, renderRouter, screen } from "expo-router/testing-library";
import type { JournalEntry, JournalRecord } from "../journal/domain/journal-record";

const mockShellLoad = jest.fn(async () => null);
const mockLoadRecord = jest.fn<Promise<{ record: JournalRecord; entries: readonly JournalEntry[] } | null>, [string]>(async () => null);
const mockLoadEntry = jest.fn<Promise<JournalEntry | null>, [string]>(async () => null);
const mockJournalService = { loadRecord: mockLoadRecord, loadEntry: mockLoadEntry };
let mockAuthorized = false;
let mockJournalStatus = "locked";
jest.mock("../journey/runtime/JourneyRuntimeProvider", () => ({
  useJourneyRuntime: () => ({ cards: {}, reviewHistory: {} }),
  useOptionalJourneyRuntime: () => mockAuthorized ? { shellState: { load: mockShellLoad } } : null,
  useAdultDeclaration: () => ({ status: mockAuthorized ? "authorized" : "public" }),
}));
jest.mock("../auth/runtime/AuthProvider", () => ({
  useAuth: () => ({
    status: "signedOut",
    requestEmailChallenge: async () => ({ challengeId: "fixture-login", expiresInSeconds: 600, resendAfterSeconds: 60 }),
    verifyEmailChallenge: async () => { mockJournalStatus = "ready"; },
    logout: jest.fn(),
  }),
}));
jest.mock("../journal/runtime/JournalAccessProvider", () => ({
  useJournalAccess: () => ({ status: mockJournalStatus, journalPersistence: "sqlcipher", retry: jest.fn() }),
  useReadyJournalService: () => mockJournalService,
}));

const Root = () => <Stack screenOptions={{ headerShown: false }} />;
const Marker = () => <Text>公开入口</Text>;
function open(initialUrl: string) {
  const actual = getMockContext(resolve(__dirname, "../../../app"));
  const overrides: Record<string, () => React.ReactElement> = {
      "./_layout.tsx": Root,
      "./index.tsx": Marker,
      "./(tabs)/index.tsx": Marker,
      "./(tabs)/practice.tsx": Marker,
      "./(tabs)/profile.tsx": Marker,
      "./(tabs)/journal.tsx": Marker,
      "./(tabs)/reviews.tsx": Marker,
      "./journey/_layout.tsx": Root,
      "./journey/welcome.tsx": Marker,
      "./journey/body-knowledge.tsx": Marker,
      "./journey/behavior-map.tsx": Marker,
      "./journey/final-preparation.tsx": Marker,
  };
  // Router 6's appDir+overrides helper duplicates keys. Use the actual file
  // inventory once, delaying module loading until that real route is rendered.
  const context = Object.fromEntries(actual.keys().map((key) => [key.replace(/^\.\//u, "").replace(/\.[tj]sx?$/u, ""), overrides[key] ?? (() => {
    const Page = actual(key).default;
    return <Page />;
  })]));
  return renderRouter(context, { initialUrl });
}

beforeEach(() => {
  mockAuthorized = false;
  mockJournalStatus = "locked";
  jest.clearAllMocks();
  mockLoadRecord.mockReset().mockResolvedValue(null);
  mockLoadEntry.mockReset().mockResolvedValue(null);
});

test("real tab layout navigates all four visible destinations", async () => {
  const result = open("/(tabs)");
  for (const [label, path] of [["练习", "/practice"], ["内界手记", "/journal"], ["我的", "/profile"], ["首页", "/"]] as const) {
    fireEvent.press(await screen.findByRole("tab", { name: label }));
    expect(result.getPathname()).toBe(path);
  }
  expect(screen.queryByRole("tab", { name: "回顾" })).toBeNull();
  expect(mockShellLoad).not.toHaveBeenCalled();
});

test.each([
  ["/journey/behavior-attitudes", "/journey/behavior-map"],
  ["/journey/checklist", "/journey/final-preparation"],
  ["/journey/communication-card", "/journey/final-preparation"],
  ["/journey/preset-practice", "/practice"],
])("resolves compatibility deep link %s", async (initialUrl, expected) => {
  const result = open(initialUrl);
  await screen.findByText("公开入口");
  expect(result.getPathname()).toBe(expected);
});

test("cold private deep link is guarded before any private repository read", async () => {
  const result = open("/journal/private-record");
  await screen.findByText("公开入口");
  expect(result.getPathname()).toBe("/journey/welcome");
  expect(mockLoadRecord).not.toHaveBeenCalled();
});

test("a signed-out journal deep link has a working cold-start back destination", async () => {
  mockAuthorized = true;
  const result = open("/journal/private-record");
  fireEvent.press(await screen.findByRole("button", { name: "返回上一页" }));
  await screen.findByText("公开入口");
  expect(result.getPathname()).toBe("/");
  expect(mockLoadRecord).not.toHaveBeenCalled();
});

test("unknown record deep link has an actionable safe return", async () => {
  mockAuthorized = true;
  mockJournalStatus = "ready";
  const result = open("/journal/missing-record");
  await screen.findByText("无法打开这条手记");
  expect(mockLoadRecord).toHaveBeenCalledWith("missing-record");
  fireEvent.press(screen.getByRole("button", { name: "返回手记列表" }));
  await screen.findByText("公开入口");
  expect(result.getPathname()).toBe("/");
});

test("a cold new-journal deep link can return without creating a record", async () => {
  mockAuthorized = true;
  mockJournalStatus = "ready";
  const result = open("/journal/new");
  fireEvent.press(await screen.findByRole("button", { name: "返回手记列表" }));
  expect(result.getPathname()).toBe("/");
  expect(mockLoadRecord).not.toHaveBeenCalled();
});

test("a cold standalone practice deep link can return to the public home", async () => {
  const result = open("/practice/session");
  fireEvent.press(await screen.findByRole("button", { name: "返回练习入口" }));
  expect(result.getPathname()).toBe("/");
});

test("warm deep links update the actual router state", async () => {
  const result = open("/(tabs)");
  await act(async () => { router.push("/(tabs)/journal"); });
  expect(result.getPathname()).toBe("/journal");
  await act(async () => { router.push("/journey/checklist"); });
  expect(result.getPathname()).toBe("/journey/final-preparation");
});

const syntheticRecord: JournalRecord = {
  id: "record-a", title: "合成验收记录", body: "账号 A 的合成正文", occurredAt: "2026-09-01T12:00:00.000Z",
  createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z", editableUntil: "2026-09-02T12:00:00.000Z",
  highlight: { kind: "feeling", text: "安心" }, topics: [], source: { kind: "freeform" }, cardSnapshot: null,
};

test("login returns to the exact original journal record using real auth and journal routes", async () => {
  mockAuthorized = true;
  mockLoadRecord.mockResolvedValue({ record: syntheticRecord, entries: [] });
  const result = open("/journal/record-a");
  fireEvent.press(await screen.findByRole("button", { name: "去登录" }));
  fireEvent.changeText(await screen.findByLabelText("邮箱地址"), "fixture@example.com");
  fireEvent.press(screen.getByRole("button", { name: "发送验证码" }));
  await screen.findByText(/验证码已发送/u);
  fireEvent.changeText(screen.getByLabelText("6 位验证码"), "123456");
  fireEvent.press(screen.getByRole("button", { name: "登录" }));
  await screen.findByText("账号 A 的合成正文");
  expect(result.getPathname()).toBe("/journal/record-a");
});

test("replacing a record deep link never shows the previous record while the new record loads", async () => {
  mockAuthorized = true;
  mockJournalStatus = "ready";
  mockLoadRecord.mockResolvedValueOnce({ record: syntheticRecord, entries: [] });
  open("/journal/record-a");
  await screen.findByText("账号 A 的合成正文");
  mockLoadRecord.mockReturnValueOnce(new Promise(() => undefined));
  await act(async () => { router.replace({ pathname: "/journal/[id]", params: { id: "record-b" } }); });
  expect(screen.queryByText("账号 A 的合成正文")).toBeNull();
  expect(screen.getByText("正在读取本机手记…")).toBeTruthy();
});

test.each(["/journal/missing/edit", "/journal/missing/add", "/journal/missing/entry/missing-entry"])("missing edit target %s exits safely", async (path) => {
  mockAuthorized = true;
  mockJournalStatus = "ready";
  const result = open(path);
  await screen.findByText("无法打开这条手记");
  fireEvent.press(screen.getByRole("button", { name: "返回手记列表" }));
  expect(result.getPathname()).toBe("/");
});

test("an incoming URL event navigates a running app through Expo linking", async () => {
  let receive: ((event: { url: string }) => void) | undefined;
  const originalAdd = Linking.addEventListener;
  const subscription = jest.spyOn(Linking, "addEventListener").mockImplementation((_type, listener) => {
    receive = listener;
    return originalAdd(_type, listener);
  });
  try {
    const result = open("/(tabs)");
    expect(receive).toBeDefined();
    await act(async () => { receive!({ url: "cave:///journal" }); });
    expect(result.getPathname()).toBe("/journal");
  } finally { subscription.mockRestore(); }
});
