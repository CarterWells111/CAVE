import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { useEffect } from "react";

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
function setup() {
  let declared = false;
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
  mockPreferences = { ...mockPreferences, ready: true, owner: "account-a", preferences: { ageConfirmed: true, addressPreference: "妳" } };
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
