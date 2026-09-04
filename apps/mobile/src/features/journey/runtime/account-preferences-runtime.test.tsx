import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { useEffect } from "react";
import { DatabaseRecoveryRequiredError } from "../../../core/storage/database";

import { InMemoryCommunicationCardRepository, InMemoryJourneyDraftRepository } from "../infrastructure/in-memory-journey-repositories";
import { composeJourneyRuntime } from "./journey-runtime";
import { JourneyRuntimeProvider, useAdultDeclaration, useOptionalJourneyRuntime } from "./JourneyRuntimeProvider";

let mockPreferences = {
  ready: true, initialized: true, owner: "account-a" as string | null,
  preferences: { ageConfirmed: true, addressPreference: "妳" as "你" | "妳" | null },
  initialize: jest.fn(async () => undefined), change: jest.fn(), clear: jest.fn(), retry: jest.fn(), error: false,
};
jest.mock("../../account/runtime/AccountPreferencesProvider", () => ({ useOptionalAccountPreferences: () => mockPreferences }));
let captured: ReturnType<typeof useOptionalJourneyRuntime>;
function Probe() {
  useEffect(() => () => { captured = null; }, []);
  captured = useOptionalJourneyRuntime();
  const adult = useAdultDeclaration();
  return <Text>{adult.status}:{captured?.snapshot?.addressPreference ?? "none"}</Text>;
}
function setup(declared = false) {
  const runtime = composeJourneyRuntime({
    mode: "expo-go-demo", persistence: "memory-only", drafts: new InMemoryJourneyDraftRepository(), cards: new InMemoryCommunicationCardRepository(),
    clipboard: { setStringAsync: async () => undefined }, createId: () => "test", now: () => "2026-09-04T10:00:00.000Z",
    adultDeclaration: { hasAdultDeclaration: async () => declared, recordAdultDeclaration: async () => { declared = true; }, deleteAdultDeclaration: async () => { declared = false; }, hasPendingLocalDataDeletion: async () => false },
  });
  const createRuntime = async () => runtime;
  const view = render(<JourneyRuntimeProvider createRuntime={createRuntime}><Probe /></JourneyRuntimeProvider>);
  return { runtime, rerender: () => view.rerender(<JourneyRuntimeProvider createRuntime={createRuntime}><Probe /></JourneyRuntimeProvider>) };
}
beforeEach(() => {
  captured = null;
  mockPreferences = { ...mockPreferences, ready: true, owner: "account-a", preferences: { ageConfirmed: true, addressPreference: "妳" } };
});

test.each([false, true])("encrypted storage recovery remains an explicit delete path with marker %s", async (declared) => {
  const { runtime } = setup(declared);
  jest.spyOn(runtime.service, "initialize").mockRejectedValueOnce(new DatabaseRecoveryRequiredError("missing-key"));
  const deleteData = jest.spyOn(runtime, "deleteAllData");
  await screen.findByText("本机加密数据需要恢复");
  expect(screen.getByRole("button", { name: "删除全部本机数据" })).toBeTruthy();
  expect(deleteData).not.toHaveBeenCalled();
  expect(captured).toBeNull();
});
test("restores remembered choices without treating the preface as read and keeps them on restart", async () => {
  setup();
  await waitFor(() => expect(captured?.snapshot).toMatchObject({ ageConfirmed: true, addressPreference: "妳", prefaceRead: false }));
  await act(async () => { await captured!.restart(); });
  await waitFor(() => expect(captured?.snapshot).toMatchObject({ ageConfirmed: true, addressPreference: "妳", prefaceRead: false }));
});
test("revoking or changing owner locks immediately while preserving existing journey data", async () => {
  const { runtime, rerender } = setup();
  await waitFor(() => expect(captured?.snapshot?.ageConfirmed).toBe(true));
  const id = runtime.service.getSnapshot()?.id;
  mockPreferences = { ...mockPreferences, preferences: { ageConfirmed: false, addressPreference: "妳" } };
  await act(async () => { rerender(); });
  expect(captured).toBeNull();
  await waitFor(() => expect(runtime.service.getSnapshot()?.ageConfirmed).toBe(false));
  expect(runtime.service.getSnapshot()?.id).toBe(id);
});

test.each([false, true])("unreadable draft offers explicit reset with legacy adult marker %s", async (declared) => {
  const { runtime } = setup(declared);
  jest.spyOn(runtime.service, "initialize").mockResolvedValueOnce("recovery-required");
  const reset = jest.spyOn(runtime.service, "resetJourney");
  await screen.findByText("本机旅程需要恢复");
  expect(reset).not.toHaveBeenCalled();
  expect(captured).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "重置本机旅程" }));
  await waitFor(() => expect(captured?.snapshot).toMatchObject({ ageConfirmed: true, addressPreference: "妳" }));
  expect(reset).toHaveBeenCalledTimes(1);
});
