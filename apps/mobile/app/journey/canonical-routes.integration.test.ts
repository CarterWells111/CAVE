declare const __dirname: string;

const { existsSync, readFileSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
const { resolve } = jest.requireActual<typeof import("node:path")>("node:path");

function route(name: string) {
  return readFileSync(resolve(__dirname, `${name}.tsx`), "utf8");
}

test.each([
  ["welcome", "WelcomePage"],
  ["overnight", "OvernightPage"],
  ["body-knowledge", "BodyKnowledgePage"],
  ["behavior-map", "behavior-map-page"],
  ["reflection", "reflection-page"],
  ["preset-practice", "PresetPracticePage"],
  ["final-preparation", "FinalPreparationPage"],
] as const)("%s imports its canonical page directly", (name, pageModule) => {
  const source = route(name);
  expect(source).toContain(`pages/${pageModule}`);
  expect(source).not.toContain("pages/JourneyPages");
});

test("welcome completes the internal preface before persisted navigation", () => {
  const source = route("welcome");
  expect(source).toContain("prefaceRead: true");
  expect(source).toContain("onAddressPreferenceChange");
  expect(source).toContain("controller.setAddressPreference(preference)");
  expect(source).not.toContain("onOpenPreface");
  expect(source).toContain('router.replace("/journey/overnight")');
});

test("pages two through five hydrate canonical state and persist before navigation", () => {
  const overnight = route("overnight");
  expect(overnight).toContain("options={catalog.options}");
  expect(overnight).toContain("initialStage={snapshot?.overnight.resumeStage");
  expect(overnight).toContain('type: "set-overnight-stage"');
  expect(overnight).toMatch(/onContinue[\s\S]*saveOvernight\(input\)[\s\S]*goTo\("body-knowledge"\)/u);

  const knowledge = route("body-knowledge");
  expect(knowledge).toContain("sources={catalog.sources}");
  expect(knowledge).toContain('require("../../../../assets/medical/vulva-anatomy-review-current.png")');
  expect(existsSync(resolve(__dirname, "../../../../assets/medical/vulva-anatomy-review-current.png"))).toBe(true);
  expect(knowledge).toContain("diagramSource={medicalDiagram}");
  expect(knowledge).toContain("onSourceAction");
  expect(knowledge).toContain('goTo("behavior-map")');

  const behavior = route("behavior-map");
  expect(behavior).toContain("<BehaviorMapPage");
  expect(behavior).toContain('type: "add-custom-behavior"');
  expect(behavior).toContain("onSetSensitiveContentConsent");
  expect(behavior).toContain("controller.setExplicitContentConsent(consented)");
  expect(behavior).toContain('goTo("reflection")');

  const reflection = route("reflection");
  expect(reflection).toContain("initialValue={{");
  expect(reflection).toContain("behaviorAnswers=");
  expect(reflection).toContain("pressureWithoutDisappointment: input.pressureWithoutDisappointment");
  expect(reflection).toContain("journalPromptId: input.journalPromptId");
  expect(reflection).toContain("journalText: input.journalText");
  expect(reflection).toContain("catalog.options");
  expect(reflection).toContain("controller.setBehaviorAttitude(behaviorId, attitude)");
  expect(reflection).not.toContain('onEditBehaviorAttitude={() => goTo("behavior-map")}');
  expect(reflection).not.toContain("?? behaviorId");
  expect(reflection).toMatch(/saveReflection\([\s\S]*goTo\("preset-practice"\)/u);
});

test("practice and final routes use real user-triggered local adapters", () => {
  const practice = route("preset-practice");
  expect(practice).toContain("catalog={catalog.practice}");
  expect(practice).toContain("ExpoClipboard.setStringAsync");
  expect(practice).toContain("controller.completePractice({");
  expect(practice).not.toContain('type: "set-practice"');
  expect(practice).toContain('goTo("final-preparation")');

  const final = route("final-preparation");
  expect(final).toContain("<FinalPreparationPage");
  expect(final).toContain('type: "set-communication-card-visibility"');
  expect(final).toContain("saveCardImageToLibrary(imageUri)");
  expect(final).toContain("cardImagePermissionRecovery.openSettings()");
  expect(final).toContain('result.status === "error"');
  expect(final).toContain("onFinish={(card) => controller.completeInitialJourney(card)}");
  expect(final).toContain('onCompleted={() => router.replace("/")}');
  expect(final).toContain("onSaveDraft={() => controller.saveCommunicationCard()}");
  expect(final).toContain("onUpdatePreparation={(itemId, status) => runAndRefresh(");
  expect(final).toContain("controller.updateChecklist(itemId, status)");
});
