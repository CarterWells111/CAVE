import { getPointSummary } from "../application/points-ledger";
import { DefaultJourneyApplicationService } from "../application/journey-application-service";
import { JourneyPageController } from "../application/page-controllers";
import { LocalPresetPracticeEngine } from "../domain/preset-practice-engine";
import type { JourneyDraft, SavedCommunicationCardRecord } from "../domain/types";
import type {
  CommunicationCardRepository,
  JourneyDraftRepository
} from "../infrastructure/journey-draft-repository";
import { loadJourneyContentCatalog } from "../infrastructure/journey-content-catalog";

function localStorageHarness() {
  let active: JourneyDraft | null = null;
  const savedCards = new Map<string, SavedCommunicationCardRecord>();
  const drafts: JourneyDraftRepository = {
    loadActive: jest.fn(async () => active),
    saveActive: jest.fn(async (draft) => { active = structuredClone(draft); }),
    deleteActive: jest.fn(async () => { active = null; })
  };
  const cards: CommunicationCardRepository = {
    list: jest.fn(async () => [...savedCards.values()].map((record) => structuredClone(record))),
    save: jest.fn(async (record) => { savedCards.set(record.id, structuredClone(record)); }),
    delete: jest.fn(async (id) => { savedCards.delete(id); })
  };
  return { cards, drafts };
}

function application(drafts: JourneyDraftRepository) {
  return new DefaultJourneyApplicationService(drafts, {
    createId: () => "journey-1",
    now: () => "2026-08-27T11:00:00.000Z"
  });
}

async function completeLocalFlow() {
  const storage = localStorageHarness();
  const app = application(storage.drafts);
  const clipboard = { setStringAsync: jest.fn(async () => undefined) };
  const controller = new JourneyPageController({
    service: app,
    cards: storage.cards,
    clipboard,
    practice: new LocalPresetPracticeEngine(loadJourneyContentCatalog().practice),
    now: () => "2026-08-27T11:00:00.000Z"
  });

  await controller.enterWelcome({ adult: true, prefaceRead: false });
  await controller.saveOvernight({
    expectationIds: ["draft-expect-rest"],
    concernIds: ["draft-concern-pressure"],
    customNote: "I need a quiet exit option"
  });
  await app.navigateTo("body-knowledge");
  await controller.readKnowledge("draft-knowledge-consent");
  await app.navigateTo("behavior-attitudes");
  await controller.setBehaviorAttitude("draft-kissing", "unsure");
  await app.navigateTo("reflection");
  await controller.saveReflection({
    motivationIds: ["draft-motivation-curious"],
    comfortNeedIds: ["draft-comfort-privacy"],
    expressionSupportNeeded: true,
    journalSaveChoice: "device"
  });
  await app.navigateTo("preset-practice");
  await controller.completePractice({
    behaviorId: "draft-kissing",
    intent: "slow-down",
    phraseId: "draft-phrase-slow-down",
    editedPhrase: "Please slow down.",
    branch: "supportive"
  });
  await app.navigateTo("checklist");
  await controller.updateChecklist("checklist:expression", "considered", "Use my pause phrase");
  await controller.finishChecklistReview();
  await app.navigateTo("communication-card");
  await controller.editCommunicationCard("boundaries", "Please ask before continuing.");

  return { app, clipboard, controller, storage };
}

test("completes Pages 1-8 offline, explicitly saves/copies, and resumes after restart", async () => {
  const originalFetch = globalThis.fetch;
  const offline = jest.fn(async () => { throw new Error("offline"); });
  globalThis.fetch = offline as typeof fetch;
  try {
    const { app, clipboard, controller, storage } = await completeLocalFlow();
    expect(await storage.cards.list()).toEqual([]);
    await controller.saveCommunicationCard();
    await controller.copyCommunicationCard();

    expect(await storage.cards.list()).toHaveLength(1);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining("Please ask before continuing."));
    expect(getPointSummary(app.getSnapshot()!.pointEventKeys)).toMatchObject({ total: 60 });
    expect(offline).not.toHaveBeenCalled();

    const restarted = application(storage.drafts);
    await expect(restarted.initialize()).resolves.toBe("ready");
    expect(restarted.getSnapshot()).toMatchObject({
      currentPage: "communication-card",
      practice: { completed: true }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("back-edit recomputes generated fields while preserving user text for review", async () => {
  const { app, controller } = await completeLocalFlow();
  await app.navigateTo("overnight");
  await controller.saveOvernight({
    expectationIds: ["draft-expect-talk"],
    concernIds: ["draft-concern-space"],
    customNote: ""
  });

  expect(app.getSnapshot()?.communicationCard.boundaries).toMatchObject({
    userText: "Please ask before continuing.",
    needsReview: true
  });
  expect(app.getSnapshot()?.checklistItems).toContainEqual(expect.objectContaining({
    id: "checklist:expression",
    status: "considered",
    userNote: "Use my pause phrase"
  }));
});
