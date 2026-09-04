import { readFileSync } from "node:fs";
import { join } from "node:path";

test("journal production modules contain no network, analytics or console calls", () => {
  const root = join(__dirname);
  const files = [
    "application/journal-service.ts", "infrastructure/in-memory-journal-repository.ts",
    "infrastructure/sql-journal-repository.ts", "infrastructure/expo-go-journal-repository.ts",
    "ui/JournalListScreen.tsx",
    "ui/JournalEditorScreen.tsx", "ui/JournalDetailScreen.tsx",
    "ui/JournalEntryEditorScreen.tsx", "ui/JournalPeriodReviewScreen.tsx"
  ];
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(|\bconsole\.|analytics|gateway/iu);
  }
});

test("journal routes wire explicit back navigation and focus-driven list refresh", () => {
  const appRoot = join(__dirname, "../../../app/journal");
  const detailRoute = readFileSync(join(appRoot, "[id].tsx"), "utf8");
  const listRoute = readFileSync(join(appRoot, "../(tabs)/journal.tsx"), "utf8");

  expect(detailRoute).toContain("onBack={() => backOrHome(router)}");
  expect(listRoute).toContain("useFocusEffect");
  expect(listRoute).toContain("focusRevision");
});

test("root and journal layouts mount account access before rendering protected routes", () => {
  const appRoot = join(__dirname, "../../../app");
  const rootLayout = readFileSync(join(appRoot, "_layout.tsx"), "utf8");
  const journalLayout = readFileSync(join(appRoot, "journal/_layout.tsx"), "utf8");

  expect(rootLayout).toContain("JournalAccessProvider");
  expect(rootLayout).toMatch(/<AuthProvider[\s\S]*<JournalAccessProvider>[\s\S]*<\/JournalAccessProvider>[\s\S]*<\/AuthProvider>/u);
  expect(journalLayout).toContain("JournalRouteGate");
});
