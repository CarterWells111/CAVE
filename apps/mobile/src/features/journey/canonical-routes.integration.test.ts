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
  ["reflection", "ConsentReminderPage"],
  ["final-preparation", "FinalPreparationPage"],
] as const)("%s imports its canonical page directly", (name, pageModule) => {
  const source = route(name);
  expect(source).toContain(`pages/${pageModule}`);
  expect(source).not.toContain("pages/JourneyPages");
});

test("landing, adult declaration and preface precede the map without login", () => {
  const source = route("welcome");
  expect(source).toContain('onStart={() => router.push(onboardingHref("/journey/adult-gate", entry))}');
  const gate = route("adult-gate");
  expect(gate).toContain("adultDeclaration.confirmAdult()");
  expect(gate).toContain('router.replace(onboardingHref("/journey/preface", entry))');
  expect(gate).toContain('router.replace("/underage-exit")');
  const preface = route("preface");
  expect(preface).not.toContain("service.beginJourney");
  expect(preface).toContain('router.replace(onboardingHref("/journey/welcome", entry))');
  expect(preface).toContain('entry === "first-overnight" ? getResumePath(runtime.snapshot) : "/(tabs)"');
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

test("Pages 1 through 4 persist canonical progress before navigation", () => {
  const overnight = route("overnight");
  expect(overnight).toContain("options={catalog.options}");
  expect(overnight).toContain("initialStage={snapshot?.overnight.resumeStage");
  expect(overnight).toContain("controller.saveOvernightProgress(input)");
  expect(overnight).toMatch(/onContinue[\s\S]*saveOvernight\(input\)[\s\S]*goTo\("behavior-map"\)/u);

  const knowledge = route("body-knowledge");
  expect(knowledge).toContain("onOpenSources={openJourneySources}");
  expect(knowledge).toContain('require("../../../../assets/medical/vulva-anatomy-review-current.png")');
  expect(existsSync(resolve(__dirname, "../../../../../assets/medical/vulva-anatomy-review-current.png"))).toBe(true);
  expect(knowledge).toContain("diagramSource={medicalDiagram}");
  expect(knowledge).not.toContain("onSourceAction");
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
  expect(reflection).toContain("<ConsentReminderPage");
  expect(reflection).toContain("CONSENT_REMINDER_SEEN_POINT_EVENT_KEY");
  expect(reflection).toContain('goTo("final-preparation")');
  expect(reflection).not.toContain("ReflectionPage");
  expect(reflection).not.toContain("saveReflection");
});

test("standalone practice and final routes use real user-triggered local persistence", () => {
  const practice = route("preset-practice");
  expect(practice).toContain('<Redirect href="/practice"');
  const standalonePractice = readFileSync(
    resolve(routeDirectory, "../practice/session.tsx"),
    "utf8",
  );
  expect(standalonePractice).toContain("catalog={catalog.practice}");
  expect(standalonePractice).toContain("ExpoClipboard.setStringAsync");
  expect(standalonePractice).toContain('context="standalone"');

  const final = route("final-preparation");
  expect(final).toContain("<FinalPreparationPage");
  expect(final).toContain('type: "set-communication-card-visibility"');
  expect(final).not.toContain("confirmCommunicationCardForSharing");
  expect(final).toContain("controller.saveCommunicationCard()");
  expect(final).toContain("controller.completeInitialJourney()");
  expect(final).toContain('pathname: "/practice"');
  expect(final).toContain("router.replace(`/cards/${cardId}`)");
  expect(final).not.toContain("saveCardImageToLibrary");
  expect(final).not.toContain("copyConfirmedCommunicationCard");
  expect(final).not.toContain("onUpdatePreparation");
});
