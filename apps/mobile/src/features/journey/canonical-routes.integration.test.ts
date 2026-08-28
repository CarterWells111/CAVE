declare const __dirname: string;

const { existsSync, readFileSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
const { resolve } = jest.requireActual<typeof import("node:path")>("node:path");
const routeDirectory = resolve(__dirname, "../../../app/journey");

function route(name: string) {
  return readFileSync(resolve(routeDirectory, `${name}.tsx`), "utf8");
}

test.each([
  ["welcome", "WelcomePage"],
  ["preface", "preface-page"],
  ["adult-gate", "adult-gate-page"],
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

test("landing, adult declaration and preface precede Page 1 without login", () => {
  const source = route("welcome");
  expect(source).toContain('onStart={() => router.push("/journey/adult-gate")}');
  const gate = route("adult-gate");
  expect(gate).toContain("adultDeclaration.confirmAdult()");
  expect(gate).toContain('router.replace("/journey/preface")');
  expect(gate).toContain('router.replace("/underage-exit")');
  const preface = route("preface");
  expect(preface).not.toContain("service.beginJourney");
  expect(preface).toContain('router.replace("/journey/welcome")');
  expect(preface).toContain('router.replace("/journey/body-knowledge")');
  expect([source, preface, gate].join("\n")).not.toMatch(/邮箱|验证码|Supabase|OTP/u);
});

test("underage exit is a root-level blocking route outside the journey layout", () => {
  const underageRoute = resolve(routeDirectory, "../underage-exit.tsx");
  expect(existsSync(underageRoute)).toBe(true);
  if (!existsSync(underageRoute)) return;

  const source = readFileSync(underageRoute, "utf8");
  expect(source).toContain("pages/underage-exit-page");
  expect(source).not.toContain("JourneyRouteScreen");
  expect(source).not.toContain("useJourneyRuntime");
});

test("Pages 1 through 4 hydrate canonical state and persist before navigation", () => {
  const overnight = route("overnight");
  expect(overnight).toContain("options={catalog.options}");
  expect(overnight).toContain("initialStage={snapshot?.overnight.resumeStage");
  expect(overnight).toContain("controller.saveOvernightProgress(input)");
  expect(overnight).toMatch(/onContinue[\s\S]*saveOvernight\(input\)[\s\S]*goTo\("behavior-map"\)/u);

  const knowledge = route("body-knowledge");
  expect(knowledge).toContain("sources={catalog.sources}");
  expect(knowledge).toContain('require("../../../../assets/medical/vulva-anatomy-review-current.png")');
  expect(existsSync(resolve(__dirname, "../../../../../assets/medical/vulva-anatomy-review-current.png"))).toBe(true);
  expect(knowledge).toContain("diagramSource={medicalDiagram}");
  expect(knowledge).toContain("onSourceAction");
  expect(knowledge).toContain('goTo("overnight")');
  expect(knowledge).not.toContain("useRouter");
  expect(knowledge).not.toContain('/journey/adult-gate');

  const behavior = route("behavior-map");
  expect(behavior).toContain("<BehaviorMapPage");
  expect(behavior).toContain('type: "add-custom-behavior"');
  expect(behavior).toContain("onSetSensitiveContentConsent");
  expect(behavior).toContain("controller.setExplicitContentConsent(consented)");
  expect(behavior).toContain('goTo("reflection")');

  const reflection = route("reflection");
  expect(reflection).toContain("initialValue={{");
  expect(reflection).toContain("onCardVisibilityChange={setCardOpen}");
  expect(reflection).toContain("immersiveContent={cardOpen}");
  expect(reflection).toContain("onSave={(input)");
  expect(reflection).toContain("onSetJournalSaveNotice={setJournalSaveNotice}");
  expect(reflection).toContain("pressureWithoutDisappointment: input.pressureWithoutDisappointment");
  expect(reflection).toContain("journalPromptId: input.journalPromptId");
  expect(reflection).toContain("journalText: input.journalText");
  expect(reflection).toContain("behaviorAnswers={Object.entries(snapshot?.behaviorAttitudes ?? {})");
  expect(reflection).toContain("controller.setBehaviorAttitude");
  expect(reflection).toContain("onEditBehaviorAttitude");
  expect(reflection).toMatch(/saveReflection\([\s\S]*goTo\("preset-practice"\)/u);
});

test("practice and final routes use real user-triggered local persistence", () => {
  const practice = route("preset-practice");
  expect(practice).toContain("catalog={catalog.practice}");
  expect(practice).toContain("ExpoClipboard.setStringAsync");
  expect(practice).toContain("controller.completePractice({");
  expect(practice).not.toContain('type: "set-practice"');
  expect(practice).toContain('goTo("final-preparation")');

  const final = route("final-preparation");
  expect(final).toContain("<FinalPreparationPage");
  expect(final).toContain('type: "set-communication-card-visibility"');
  expect(final).toContain("await runAndRefresh(() => controller.completeInitialJourney())");
  expect(final).toContain("router.replace(`/cards/${cardId}`)");
  expect(final).toContain("saveCardImageToLibrary");
  expect(final).not.toContain("cardImagePermissionRecovery");
  expect(final).toContain("copyConfirmedCommunicationCard");
  expect(final).toContain("onUpdatePreparation");
});
