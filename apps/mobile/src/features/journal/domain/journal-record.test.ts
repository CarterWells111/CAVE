import {
  JOURNAL_EDIT_WINDOW_MS,
  JournalValidationError,
  canEditJournalItem,
  createJournalEntry,
  createJournalRecord
} from "./journal-record";
import { journalDateFromDate } from "./journal-date";

const createdAt = "2026-08-28T10:00:00.000Z";

describe("key event journal domain", () => {
  test("trims a title and calculates a 24 hour editing window", () => {
    const record = createJournalRecord({
      id: "record-1",
      title: "  第一次说出暂停  ",
      occurredAt: "2026-08-20T18:00:00.000Z",
      createdAt,
      highlight: { kind: "feeling", text: "  松了一口气  " },
      body: "  我先停下来想了一会儿。  ",
      topics: ["self-boundaries", "self-boundaries", "intimate-relationship"],
      source: { kind: "freeform" }
    });

    expect(record.title).toBe("第一次说出暂停");
    expect(record.highlight.text).toBe("松了一口气");
    expect(record.body).toBe("我先停下来想了一会儿。");
    expect(record.topics).toEqual(["self-boundaries", "intimate-relationship"]);
    expect(record.editableUntil).toBe("2026-08-29T10:00:00.000Z");
  });

  test("rejects an empty title and an empty highlight", () => {
    expect(() => createJournalRecord({
      id: "record-1", title: "  ", occurredAt: createdAt, createdAt,
      highlight: { kind: "feeling", text: "有一点安心" }, body: "", topics: [],
      source: { kind: "freeform" }
    })).toThrow(new JournalValidationError("journal-title-required"));

    expect(() => createJournalRecord({
      id: "record-1", title: "一个事件", occurredAt: createdAt, createdAt,
      highlight: { kind: "impression", text: "  " }, body: "", topics: [],
      source: { kind: "freeform" }
    })).toThrow(new JournalValidationError("journal-highlight-required"));
  });

  test("allows occurredAt before createdAt and rejects invalid topics", () => {
    expect(createJournalRecord({
      id: "record-1", title: "一个事件", occurredAt: "2020-01-01T00:00:00.000Z", createdAt,
      highlight: { kind: "feeling", text: "平静" }, body: "", topics: ["sexual-health"],
      source: { kind: "freeform" }
    }).occurredAt).toBe("2020-01-01");

    expect(() => createJournalRecord({
      id: "record-1", title: "一个事件", occurredAt: createdAt, createdAt,
      highlight: { kind: "feeling", text: "平静" }, body: "", topics: ["diagnosis" as never],
      source: { kind: "freeform" }
    })).toThrow(new JournalValidationError("journal-topic-invalid"));
  });

  test("locks exactly at the deadline", () => {
    const deadline = new Date(Date.parse(createdAt) + JOURNAL_EDIT_WINDOW_MS).toISOString();
    expect(canEditJournalItem("2026-08-29T09:59:59.999Z", deadline)).toBe(true);
    expect(canEditJournalItem(deadline, deadline)).toBe(false);
  });

  test("gives every later entry its own editing window", () => {
    const entry = createJournalEntry({
      id: "entry-1", recordId: "record-1", kind: "correction",
      occurredAt: "2026-08-30T09:00:00.000Z", createdAt: "2026-08-30T10:00:00.000Z",
      highlight: null, body: "后来我想补充一件事"
    });
    expect(entry.editableUntil).toBe("2026-08-31T10:00:00.000Z");
  });

  test("stores event and later-entry occurrence as calendar days", () => {
    const legacyOccurredAt = "2026-08-29T23:30:00.000-07:00";
    const record = createJournalRecord({
      id: "record-date", title: "日期语义", occurredAt: legacyOccurredAt, createdAt,
      highlight: { kind: "feeling", text: "安心" }, source: { kind: "freeform" },
    });
    const entry = createJournalEntry({
      id: "entry-date", recordId: record.id, kind: "insight", occurredAt: legacyOccurredAt,
      createdAt, body: "后来明白了一点",
    });
    const expected = journalDateFromDate(new Date(legacyOccurredAt));
    expect(record.occurredAt).toBe(expected);
    expect(entry.occurredAt).toBe(expected);
  });
});
