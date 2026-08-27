import { buildCommunicationCard, selectConfirmedCommunicationCard } from "../domain/derive-communication-card";
import type { PresetPracticeEngine, PresetPracticeState } from "../domain/practice-types";
import { createJourneyDraft, type JourneyDraft } from "../domain/types";
import type { CommunicationCardRepository } from "../infrastructure/journey-draft-repository";
import type { JourneyApplicationService } from "./journey-application-service";
import { JourneyPageController, type ClipboardAdapter } from "./page-controllers";

function activeDraft(): JourneyDraft {
  const draft = {
    ...createJourneyDraft({ id: "journey-1", now: "now" }),
    ageConfirmed: true,
    behaviorAttitudes: { "draft-kissing": "unsure" as const },
    sourceRevision: 1
  };
  const communicationCard = buildCommunicationCard(draft);
  communicationCard["communication-night-expectations"] = {
    ...communicationCard["communication-night-expectations"],
    visibility: "included"
  };
  communicationCard["communication-not-this-time"] = {
    ...communicationCard["communication-not-this-time"],
    userText: "private marker",
    visibility: "private"
  };
  return { ...draft, communicationCard };
}

function harness() {
  let snapshot: JourneyDraft | null = activeDraft();
  const service: JourneyApplicationService = {
    getSnapshot: jest.fn(() => snapshot),
    confirmAdult: jest.fn(async () => undefined),
    dispatch: jest.fn(async () => undefined),
    navigateTo: jest.fn(async () => undefined),
    resetJourney: jest.fn(async () => { snapshot = null; })
  };
  const cards: CommunicationCardRepository = {
    list: jest.fn(async () => []),
    save: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined)
  };
  const clipboard: { setStringAsync: jest.MockedFunction<ClipboardAdapter["setStringAsync"]> } = {
    setStringAsync: jest.fn(async (value: string) => { void value; })
  };
  const practiceState: PresetPracticeState = {
    scenarioId: "draft-scenario",
    behaviorId: "draft-kissing",
    intent: "slow-down",
    phraseIds: ["draft-phrase-slow-down"],
    safetyEnded: false,
    catalogVersion: "draft-v1",
    scripted: true
  };
  const practice: PresetPracticeEngine = {
    start: jest.fn(() => practiceState),
    selectPhrase: jest.fn((state, selectedPhraseId) => ({ ...state, selectedPhraseId })),
    choosePartnerResponse: jest.fn((state, branch) => ({ ...state, response: {
      id: branch,
      branch,
      text: branch,
      scripted: true,
      safeTerminal: branch === "ignores-pause"
    }, safetyEnded: branch === "ignores-pause" }))
  };
  const controller = new JourneyPageController({
    service,
    cards,
    clipboard,
    practice,
    now: () => "2026-08-27T10:00:00.000Z"
  });
  return { cards, clipboard, controller, practice, service };
}

test("keeps the underage exit unsaved and creates only an adult journey", async () => {
  const { controller, service } = harness();

  await expect(controller.enterWelcome({ adult: false, prefaceRead: true })).resolves.toBe("underage-exit");
  expect(service.confirmAdult).not.toHaveBeenCalled();
  expect(service.dispatch).not.toHaveBeenCalled();

  await expect(controller.enterWelcome({ adult: true, prefaceRead: false })).resolves.toBe("overnight");
  expect(service.confirmAdult).toHaveBeenCalledTimes(1);
  expect(service.dispatch).toHaveBeenCalledWith({ type: "set-preface-read", read: false });
  expect(service.navigateTo).toHaveBeenCalledWith("overnight");
});

test("translates Page 2-5 events into page-owned commands and idempotent task keys", async () => {
  const { controller, service } = harness();

  await controller.saveOvernight({ expectationIds: ["draft-rest"], concernIds: [], customNote: "" });
  await controller.readKnowledge("draft-knowledge-consent");
  await controller.setBehaviorAttitude("draft-kissing", "unsure");
  await controller.saveReflection({ motivationIds: ["draft-curious"], comfortNeedIds: ["draft-privacy"], expressionSupportNeeded: true, journalSaveChoice: "device" });

  expect(service.dispatch).toHaveBeenCalledWith({
    type: "save-overnight",
    expectationIds: ["draft-rest"],
    concernIds: [],
    customNote: "",
  });
  expect(service.dispatch).toHaveBeenCalledWith({ type: "record-point-event", key: "learning:draft-knowledge-consent:v1" });
  expect(service.dispatch).toHaveBeenCalledWith({ type: "record-point-event", key: "reflection:page-5:v1" });
  expect(service.dispatch).toHaveBeenCalledWith({ type: "set-behavior-attitude", behaviorId: "draft-kissing", attitude: "unsure" });
});

test("marks the medical diagram opened through the controller", async () => {
  const { controller, service } = harness();

  await controller.openMedicalDiagram();

  expect(service.dispatch).toHaveBeenCalledWith({ type: "set-medical-diagram-opened", opened: true });
});

test("runs Page 6 only through the scripted engine and records one versioned practice event", async () => {
  const { controller, practice, service } = harness();

  await controller.completePractice({
    behaviorId: "draft-kissing",
    intent: "slow-down",
    phraseId: "draft-phrase-slow-down",
    editedPhrase: "Please slow down.",
    branch: "supportive"
  });

  expect(practice.start).toHaveBeenCalledWith({ behaviorId: "draft-kissing", intent: "slow-down" });
  expect(service.dispatch).toHaveBeenCalledWith(expect.objectContaining({
    type: "set-practice",
    practice: expect.objectContaining({ completed: true, editedPhrase: "Please slow down." })
  }));
  expect(service.dispatch).toHaveBeenCalledWith({
    type: "record-point-event",
    key: "practice:draft-scenario:draft-v1"
  });
});

test("rejects practice for a behavior that is not selected in the active draft", async () => {
  const { controller, practice, service } = harness();

  await expect(controller.completePractice({
    behaviorId: "draft-unselected",
    intent: "slow-down",
    phraseId: "draft-phrase-slow-down",
    branch: "supportive"
  })).rejects.toThrow("practice-behavior-not-selected");

  expect(practice.start).not.toHaveBeenCalled();
  expect(service.dispatch).not.toHaveBeenCalled();
});

test("updates private preparation and copies only explicitly included final-page sections", async () => {
  const { cards, clipboard, controller, service } = harness();
  await controller.updateChecklist("checklist:expression", "considered", "Pause first");
  await controller.finishChecklistReview();
  expect(cards.save).not.toHaveBeenCalled();

  await controller.saveCommunicationCard(selectConfirmedCommunicationCard(activeDraft()));
  await expect(controller.copyCommunicationCard()).resolves.toEqual({ status: "success" });

  expect(service.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "update-checklist-item" }));
  expect(service.dispatch).toHaveBeenCalledWith({ type: "record-point-event", key: "review:checklist:v1" });
  expect(cards.save).toHaveBeenCalledWith(expect.objectContaining({ id: "card:journey-1", journeyId: "journey-1" }));
  const saveCard = cards.save as jest.MockedFunction<CommunicationCardRepository["save"]>;
  expect(JSON.stringify(saveCard.mock.calls[0]?.[0].card)).not.toContain("private marker");
  const copied = clipboard.setStringAsync.mock.calls[0]?.[0] ?? "";
  expect(copied).toContain("我对这个夜晚暂时没有具体想象。");
  expect(copied).not.toMatch(/draft-card|draft-/u);
  expect(copied).toContain("任何人都可以随时改变主意，每一种靠近仍然需要当时再次确认");
  expect(copied).not.toContain("private marker");
});

test("returns a typed clipboard failure that the route can render", async () => {
  const { clipboard, controller } = harness();
  clipboard.setStringAsync.mockRejectedValueOnce(new Error("denied"));

  await expect(controller.copyCommunicationCard()).resolves.toEqual({
    status: "error",
    code: "clipboard-write-failed"
  });
});

test("persists address preference and explicit-content consent through typed controller commands", async () => {
  const { controller, service } = harness();

  await controller.setAddressPreference("妳");
  await controller.setExplicitContentConsent(true);

  expect(service.dispatch).toHaveBeenCalledWith({ type: "set-address-preference", preference: "妳" });
  expect(service.dispatch).toHaveBeenCalledWith({ type: "set-explicit-content-consent", consented: true });
});

test("saves the complete Page 5 payload atomically and gives unsaved journals no timestamp or body", async () => {
  const { controller, service } = harness();

  await controller.saveReflection({
    motivationIds: ["draft-curious"],
    comfortNeedIds: ["draft-privacy"],
    pressureWithoutDisappointment: "slow-down",
    refusalSafety: "difficult-but-possible",
    expressionDifficulty: "needs-phrase",
    comfortClarity: "need-space",
    comfortNote: "需要自己的空间",
    journalPromptId: "journal-hesitation",
    journalText: "不得写入",
    journalSaveChoice: "not-saved",
  });

  expect(service.dispatch).toHaveBeenCalledWith({
    type: "save-reflection",
    motivationIds: ["draft-curious"],
    comfortNeedIds: ["draft-privacy"],
    expressionSupportNeeded: true,
    reflection: {
      pressureWithoutDisappointment: "slow-down",
      refusalSafety: "difficult-but-possible",
      expressionDifficulty: "needs-phrase",
      comfortClarity: "need-space",
      comfortNote: "需要自己的空间",
    },
    journal: { text: "", saveChoice: "not-saved" },
  });
});

test("does not award reflection participation for an entirely blank submission", async () => {
  const { controller, service } = harness();

  await controller.saveReflection({
    motivationIds: [],
    comfortNeedIds: [],
    pressureWithoutDisappointment: null,
    refusalSafety: null,
    expressionDifficulty: null,
    comfortClarity: null,
    comfortNote: "   ",
    journalText: "discarded text",
    journalSaveChoice: "not-saved",
  });

  expect(service.dispatch).not.toHaveBeenCalledWith({
    type: "record-point-event",
    key: "reflection:page-5:v1",
  });
});

test("persists the canonical Page 6 submission and awards only a valid participation key", async () => {
  const { controller, service } = harness();

  await controller.completePractice({
    behaviorId: null,
    intent: "pause-to-feel",
    phrase: "先停一下。",
    aftercareId: "space",
    completed: true,
    optionalBranch: "disappointed-but-stops",
    optionalResponse: "我现在想停。",
    pointEventKey: "practice:seven-screen-v1:first-completion",
  });

  expect(service.dispatch).toHaveBeenCalledWith({
    type: "save-practice-submission",
    submission: expect.objectContaining({
      phrase: "先停一下。",
      aftercareId: "space",
      optionalBranch: "disappointed-but-stops",
      optionalResponse: "我现在想停。",
      safetyTerminal: false,
      completed: true,
    }),
  });
  expect(service.dispatch).toHaveBeenCalledWith({
    type: "record-point-event",
    key: "practice:seven-screen-v1:first-completion",
  });

  jest.mocked(service.dispatch).mockClear();
  await controller.completePractice({
    behaviorId: null,
    intent: "stop-current-action",
    phrase: "请停下。",
    aftercareId: "end-night",
    completed: true,
    optionalBranch: "ignores-or-blocks-exit",
  });
  expect(service.dispatch).toHaveBeenCalledWith(expect.objectContaining({
    type: "save-practice-submission",
    submission: expect.objectContaining({ safetyTerminal: true }),
  }));
  expect(service.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "record-point-event" }));

  jest.mocked(service.dispatch).mockClear();
  await controller.completePractice({
    behaviorId: null,
    intent: "pause-to-feel",
    phrase: "先停一下。",
    aftercareId: "space",
    completed: true,
    pointEventKey: "practice:free-points",
  });
  expect(service.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "record-point-event" }));
});
