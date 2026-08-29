export const JOURNAL_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const JOURNAL_TOPICS = [
  "intimate-relationship",
  "self-boundaries",
  "sexual-health"
] as const;

export type JournalTopic = (typeof JOURNAL_TOPICS)[number];
export type JournalHighlight = Readonly<{ kind: "feeling" | "impression"; text: string }>;
export type JournalEntryKind = "event-change" | "feeling-change" | "action" | "insight" | "correction";
export type JournalSource =
  | Readonly<{ kind: "freeform" }>
  | Readonly<{ kind: "journey"; journeyId: string; reviewId?: string; cardId?: string }>;
export type JournalCardSnapshot = Readonly<{
  cardId: string;
  capturedAt: string;
  sections: ReadonlyArray<{ id: string; text: string }>;
}>;

export type JournalRecord = Readonly<{
  id: string;
  title: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  editableUntil: string;
  highlight: JournalHighlight;
  body: string;
  topics: readonly JournalTopic[];
  source: JournalSource;
  cardSnapshot: JournalCardSnapshot | null;
}>;

export type JournalEntry = Readonly<{
  id: string;
  recordId: string;
  kind: JournalEntryKind;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  editableUntil: string;
  highlight: JournalHighlight | null;
  body: string;
}>;

export type JournalValidationErrorCode =
  | "journal-title-required"
  | "journal-highlight-required"
  | "journal-topic-invalid"
  | "journal-date-invalid"
  | "journal-body-required";

export class JournalValidationError extends Error {
  constructor(readonly code: JournalValidationErrorCode) {
    super(code);
    this.name = "JournalValidationError";
  }
}

type CreateJournalRecordInput = Readonly<{
  id: string;
  title: string;
  occurredAt: string;
  createdAt: string;
  highlight: JournalHighlight;
  body?: string;
  topics?: readonly JournalTopic[];
  source: JournalSource;
  cardSnapshot?: JournalCardSnapshot | null;
}>;

type CreateJournalEntryInput = Readonly<{
  id: string;
  recordId: string;
  kind: JournalEntryKind;
  occurredAt: string;
  createdAt: string;
  highlight?: JournalHighlight | null;
  body: string;
}>;

function requireIsoDate(value: string): string {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new JournalValidationError("journal-date-invalid");
  }
  return new Date(value).toISOString();
}

function editableUntil(createdAt: string): string {
  return new Date(Date.parse(createdAt) + JOURNAL_EDIT_WINDOW_MS).toISOString();
}

function normalizeHighlight(highlight: JournalHighlight): JournalHighlight {
  const text = highlight.text.trim();
  if (!text) throw new JournalValidationError("journal-highlight-required");
  return { kind: highlight.kind, text };
}

function normalizeTopics(topics: readonly JournalTopic[]): readonly JournalTopic[] {
  if (topics.some((topic) => !JOURNAL_TOPICS.includes(topic))) {
    throw new JournalValidationError("journal-topic-invalid");
  }
  return [...new Set(topics)];
}

export function canEditJournalItem(now: string, deadline: string): boolean {
  return Date.parse(requireIsoDate(now)) < Date.parse(requireIsoDate(deadline));
}

export function createJournalRecord(input: CreateJournalRecordInput): JournalRecord {
  const title = input.title.trim();
  if (!title) throw new JournalValidationError("journal-title-required");
  const createdAt = requireIsoDate(input.createdAt);
  return {
    id: input.id,
    title,
    occurredAt: normalizeJournalDate(input.occurredAt),
    createdAt,
    updatedAt: createdAt,
    editableUntil: editableUntil(createdAt),
    highlight: normalizeHighlight(input.highlight),
    body: (input.body ?? "").trim(),
    topics: normalizeTopics(input.topics ?? []),
    source: input.source,
    cardSnapshot: input.cardSnapshot ?? null
  };
}

export function createJournalEntry(input: CreateJournalEntryInput): JournalEntry {
  const createdAt = requireIsoDate(input.createdAt);
  const body = input.body.trim();
  const highlight = input.highlight === null || input.highlight === undefined
    ? null
    : normalizeHighlight(input.highlight);
  if (!body && highlight === null) throw new JournalValidationError("journal-body-required");
  return {
    id: input.id,
    recordId: input.recordId,
    kind: input.kind,
    occurredAt: normalizeJournalDate(input.occurredAt),
    createdAt,
    updatedAt: createdAt,
    editableUntil: editableUntil(createdAt),
    highlight,
    body
  };
}
import { normalizeJournalDate } from "./journal-date";
