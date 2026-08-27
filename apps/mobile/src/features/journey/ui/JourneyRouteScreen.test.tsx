import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { createJourneyDraft, type JourneyDraft, type JourneyPageId } from "../domain/types";
import { JourneyAction } from "./components/JourneyAction";
import { JourneyRouteScreen } from "./JourneyRouteScreen";

const mockReplace = jest.fn();
const mockRuntime = {
  snapshot: null as JourneyDraft | null,
  service: {
    getSnapshot: jest.fn<JourneyDraft | null, []>(() => null),
    navigateTo: jest.fn<Promise<void>, [JourneyPageId]>(async () => undefined),
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
  mockRuntime.service.navigateTo.mockImplementation(async () => undefined);
  mockRuntime.runAndRefresh.mockImplementation(async <T,>(action: () => Promise<T>) => action());
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

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
  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));

  await waitFor(() => {
    expect(mockRuntime.service.navigateTo).toHaveBeenCalledWith("behavior-attitudes");
    expect(mockReplace).toHaveBeenCalledWith("/journey/behavior-attitudes");
  });
  expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(1);
});

test("exits every journey page to root without resetting or deleting the active draft", async () => {
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

  fireEvent.press(screen.getByRole("button", { name: "退出旅程" }));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  expect(mockRuntime.service.resetJourney).not.toHaveBeenCalled();
  expect(mockRuntime.service.navigateTo).not.toHaveBeenCalled();
  expect(mockRuntime.runAndRefresh).not.toHaveBeenCalled();
  expect(mockRuntime.snapshot?.id).toBe("journey-1");
});

test("does not replace the root with a late forward navigation after exit", async () => {
  const pendingForward = deferred<void>();
  mockRuntime.snapshot = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage: "overnight"
  };
  mockRuntime.service.navigateTo.mockReturnValueOnce(pendingForward.promise);

  render(
    <JourneyRouteScreen pageId="overnight">
      {({ goTo }) => (
        <JourneyAction
          label="next-page"
          loadingLabel="正在继续…"
          onAction={() => goTo("body-knowledge")}
          testID="next-page"
        />
      )}
    </JourneyRouteScreen>
  );

  fireEvent.press(screen.getByTestId("next-page"));
  fireEvent.press(screen.getByRole("button", { name: "退出旅程" }));
  await act(async () => pendingForward.resolve());

  expect(mockReplace).toHaveBeenCalledWith("/");
  expect(mockReplace).not.toHaveBeenCalledWith("/journey/body-knowledge");
  expect(mockRuntime.service.resetJourney).not.toHaveBeenCalled();
});

test("does not replace the route when a deferred back navigation resolves after unmount", async () => {
  const pendingBack = deferred<void>();
  mockRuntime.snapshot = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage: "reflection"
  };
  mockRuntime.service.navigateTo.mockReturnValueOnce(pendingBack.promise);

  const view = render(
    <JourneyRouteScreen pageId="reflection">
      {() => <Text>reflection-content</Text>}
    </JourneyRouteScreen>
  );

  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  view.unmount();
  await act(async () => pendingBack.resolve());

  expect(mockReplace).not.toHaveBeenCalledWith("/journey/behavior-attitudes");
});

test("keeps back navigation busy, blocks duplicates, and hides rejection details", async () => {
  const pendingBack = deferred<void>();
  mockRuntime.snapshot = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage: "reflection"
  };
  mockRuntime.runAndRefresh.mockReturnValueOnce(pendingBack.promise);

  render(
    <JourneyRouteScreen pageId="reflection">
      {() => <Text>reflection-content</Text>}
    </JourneyRouteScreen>
  );

  const back = screen.getByRole("button", { name: "返回上一页" });
  fireEvent.press(back);
  fireEvent.press(back);

  expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(1);
  expect(screen.getByText("正在返回…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "正在返回…" }).props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );

  await act(async () => { pendingBack.reject(new Error("private back failure")); });
  expect(await screen.findByText("返回失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private back failure")).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "返回上一页" })).toBeTruthy());

  fireEvent.press(screen.getByRole("button", { name: "返回上一页" }));
  await waitFor(() => expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(2));
  expect(mockRuntime.service.navigateTo).toHaveBeenCalledWith("behavior-attitudes");
});

test("keeps forward navigation busy, handles rejection safely, and retries", async () => {
  const pendingForward = deferred<void>();
  mockRuntime.snapshot = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    currentPage: "overnight"
  };
  mockRuntime.runAndRefresh.mockReturnValueOnce(pendingForward.promise);

  render(
    <JourneyRouteScreen pageId="overnight">
      {({ goTo }) => (
        <JourneyAction
          errorMessage="继续失败，请重试。"
          label="next-page"
          loadingLabel="正在继续…"
          onAction={() => goTo("body-knowledge")}
          testID="next-page"
        />
      )}
    </JourneyRouteScreen>
  );

  const next = screen.getByTestId("next-page");
  fireEvent.press(next);
  fireEvent.press(next);
  expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(1);
  expect(screen.getByText("正在继续…")).toBeTruthy();
  expect(screen.getByTestId("next-page").props.accessibilityState).toEqual(
    expect.objectContaining({ busy: true, disabled: true })
  );

  await act(async () => { pendingForward.reject(new Error("private forward failure")); });
  expect(await screen.findByText("继续失败，请重试。")).toBeTruthy();
  expect(screen.queryByText("private forward failure")).toBeNull();

  fireEvent.press(screen.getByTestId("next-page"));
  await waitFor(() => {
    expect(mockRuntime.runAndRefresh).toHaveBeenCalledTimes(2);
    expect(mockRuntime.service.navigateTo).toHaveBeenCalledWith("body-knowledge");
    expect(mockReplace).toHaveBeenCalledWith("/journey/body-knowledge");
  });
});
