import type { JourneyPracticeCatalog } from "@cave/content";

import {
  beginPractice,
  chooseAftercare,
  chooseOptionalBranch,
  completeMirror,
  completePractice,
  editOptionalUserResponse,
  editPracticePhrase,
  selectOptionalUserResponse,
  selectPracticeBehavior,
  selectPracticeNeed,
  skipMirror,
  showRespectfulResponse
} from "./seven-screen-practice-machine";

function catalog(): JourneyPracticeCatalog {
  const intents = [
    "slow-down",
    "adjust-touch",
    "pause-and-decide",
    "stop-current-action",
    "choose-another-closeness",
    "pause-to-feel"
  ];
  return {
    version: "seven-screen-v1",
    scripted: true,
    phrases: intents.map((intent, index) => ({
      id: `phrase-${intent}`, page: 6, contentType: "EDU", sourceIds: ["SRC-003"],
      reviewStatus: "expert_review_pending", intent, order: index + 1, text: `phrase ${intent}`
    })),
    responses: [],
    partnerResponses: intents.map((intent, index) => ({
      id: `response-${intent}`, page: 6, contentType: "EDU", sourceIds: ["SRC-003"],
      reviewStatus: "expert_review_pending", intent, order: index + 1, text: `response ${intent}`
    })),
    safetyBranches: [
      {
        id: "disappointed", page: 6, contentType: "EDU", sourceIds: ["SRC-003"],
        reviewStatus: "expert_review_pending", branch: "disappointed-but-stops", order: 1,
        partnerText: "disappointed", userTexts: ["one", "two", "three"], guidance: "guidance", safeTerminal: false
      },
      {
        id: "pressure", page: 6, contentType: "REVIEW", sourceIds: ["SRC-003"],
        reviewStatus: "expert_review_pending", branch: "continues-pressure", order: 2,
        partnerText: "pressure", userTexts: ["stop"], guidance: "leave", safeTerminal: false
      },
      {
        id: "unsafe", page: 6, contentType: "REVIEW", sourceIds: ["SRC-003"],
        reviewStatus: "expert_review_pending", branch: "ignores-or-blocks-exit", order: 3,
        partnerText: "unsafe", userTexts: [], guidance: "safety", safeTerminal: true
      }
    ],
    supportResources: []
  };
}

test("moves through mirror, behavior, need, editable phrase, respectful response and completion", () => {
  let state = beginPractice(catalog());
  expect(state).toMatchObject({ stage: "entry", scripted: true, mirrorConfirmed: false });
  expect(JSON.stringify(state)).not.toMatch(/microphone|recording|audio|ai/iu);

  state = completeMirror(state);
  state = selectPracticeBehavior(state, "behavior-hug");
  state = selectPracticeNeed(state, "slow-down");
  state = editPracticePhrase(state, "Please slow down.");
  state = showRespectfulResponse(state, catalog());
  state = chooseAftercare(state, "quiet");
  state = chooseOptionalBranch(state, catalog(), "skip");
  state = completePractice(state);

  expect(state).toMatchObject({
    stage: "completed",
    behaviorId: "behavior-hug",
    intent: "slow-down",
    phrase: "Please slow down.",
    partnerResponse: "response slow-down",
    aftercareId: "quiet",
    pointEventKey: "practice:seven-screen-v1:first-completion"
  });
});

test("offers all six deterministic need phrases without generating text", () => {
  for (const intent of [
    "slow-down", "adjust-touch", "pause-and-decide", "stop-current-action",
    "choose-another-closeness", "pause-to-feel"
  ] as const) {
    const state = selectPracticeNeed(selectPracticeBehavior(completeMirror(beginPractice(catalog())), null), intent);
    expect(state).toMatchObject({ stage: "editable-phrase", intent, phrase: `phrase ${intent}` });
  }
});

test("skips mirror practice safely from both entry and editable phrase", () => {
  const fromEntry = skipMirror(beginPractice(catalog()));
  expect(fromEntry.stage).toBe("behavior");

  const editing = selectPracticeNeed(
    selectPracticeBehavior(completeMirror(beginPractice(catalog())), null),
    "pause-to-feel",
  );
  expect(skipMirror(editing)).toMatchObject({
    stage: "editable-phrase",
    intent: "pause-to-feel",
    phrase: "phrase pause-to-feel",
  });
});

test("keeps the disappointed branch optional and gives it no additional point event", () => {
  let state = selectPracticeNeed(selectPracticeBehavior(completeMirror(beginPractice(catalog())), null), "pause-and-decide");
  state = showRespectfulResponse(state, catalog());
  state = chooseAftercare(state, "space");
  state = chooseOptionalBranch(state, catalog(), "disappointed-but-stops");

  expect(state).toMatchObject({ stage: "optional-response", optionalBranch: "disappointed-but-stops" });
  expect(state.optionalUserTexts).toEqual(["one", "two", "three"]);
  expect(state.pointEventKey).toBeUndefined();

  state = selectOptionalUserResponse(state, "two");
  state = editOptionalUserResponse(state, "  my own response  ");
  state = completePractice(state);
  expect(state).toMatchObject({
    optionalUserResponse: "my own response",
    optionalUserResponseEdited: true,
    stage: "completed",
  });
});

test("requires a selected optional response before completing a non-terminal branch", () => {
  let state = selectPracticeNeed(selectPracticeBehavior(completeMirror(beginPractice(catalog())), null), "pause-and-decide");
  state = showRespectfulResponse(state, catalog());
  state = chooseAftercare(state, "space");
  state = chooseOptionalBranch(state, catalog(), "disappointed-but-stops");

  expect(() => completePractice(state)).toThrow("optional-practice-response-required");
});

test("enforces disappointed then pressure before the safety terminal", () => {
  let state = selectPracticeNeed(selectPracticeBehavior(completeMirror(beginPractice(catalog())), null), "stop-current-action");
  state = showRespectfulResponse(state, catalog());
  state = chooseAftercare(state, "end-night");

  expect(() => chooseOptionalBranch(state, catalog(), "continues-pressure"))
    .toThrow("practice-branch-order");
  expect(() => chooseOptionalBranch(state, catalog(), "ignores-or-blocks-exit"))
    .toThrow("practice-branch-order");

  state = chooseOptionalBranch(state, catalog(), "disappointed-but-stops");
  expect(() => chooseOptionalBranch(state, catalog(), "continues-pressure"))
    .toThrow("optional-practice-response-required");
  state = selectOptionalUserResponse(state, "one");
  state = chooseOptionalBranch(state, catalog(), "continues-pressure");
  expect(state).toMatchObject({ stage: "optional-response", optionalBranch: "continues-pressure" });
  expect(() => chooseOptionalBranch(state, catalog(), "ignores-or-blocks-exit"))
    .toThrow("optional-practice-response-required");
  state = selectOptionalUserResponse(state, "stop");
  state = chooseOptionalBranch(state, catalog(), "ignores-or-blocks-exit");
  expect(state).toMatchObject({ stage: "safety-resources", safetyEnded: true });
});

test("ends ordinary language practice immediately when exit is ignored or blocked", () => {
  let state = selectPracticeNeed(selectPracticeBehavior(completeMirror(beginPractice(catalog())), null), "stop-current-action");
  state = showRespectfulResponse(state, catalog());
  state = chooseAftercare(state, "end-night");
  state = chooseOptionalBranch(state, catalog(), "disappointed-but-stops");
  state = selectOptionalUserResponse(state, "one");
  state = chooseOptionalBranch(state, catalog(), "continues-pressure");
  state = selectOptionalUserResponse(state, "stop");
  state = chooseOptionalBranch(state, catalog(), "ignores-or-blocks-exit");

  expect(state).toMatchObject({ stage: "safety-resources", safetyEnded: true });
  expect(() => completePractice(state)).toThrow("safety-resources-must-close-explicitly");
  expect(JSON.stringify(state)).not.toMatch(/pause.?card|auto.?dial/iu);
});
