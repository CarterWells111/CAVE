import {
  formatJournalDate,
  isJournalDateInRange,
  journalDateFromDate,
  normalizeJournalDate,
  parseJournalDate,
} from "./journal-date";

describe("journal calendar dates", () => {
  test("keeps a valid calendar day stable", () => {
    expect(normalizeJournalDate("2026-08-29")).toBe("2026-08-29");
    expect(parseJournalDate("2026-08-29")).toEqual(new Date(2026, 7, 29));
  });

  test("converts a legacy timestamp using the device calendar rather than its UTC prefix", () => {
    const legacy = "2026-08-29T23:30:00.000-07:00";
    const parsed = new Date(legacy);
    expect(normalizeJournalDate(legacy)).toBe(journalDateFromDate(parsed));
  });

  test("rejects impossible or ambiguous calendar dates", () => {
    expect(() => normalizeJournalDate("2026-02-30")).toThrow("journal-date-invalid");
    expect(() => normalizeJournalDate("08/29/2026")).toThrow("journal-date-invalid");
  });

  test("formats a day without exposing an ISO timestamp", () => {
    const label = formatJournalDate("2026-08-29");
    expect(label).toContain("2026");
    expect(label).toContain("29");
    expect(label).not.toContain("T00:00");
  });

  test("includes only calendar days inside a closed range", () => {
    expect(isJournalDateInRange("2026-08-29", "2026-07-30", "2026-08-29")).toBe(true);
    expect(isJournalDateInRange("2026-08-30", "2026-07-30", "2026-08-29")).toBe(false);
  });
});
