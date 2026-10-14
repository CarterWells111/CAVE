import { z } from "zod";

const Id = z.string().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const JournalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid journal date");
const JournalDraftInput = z.object({
  protocol: z.literal("cave-journal-draft-v1"),
  requestId: Id,
  operation: z.enum(["new", "edit"]),
  stage: z.enum(["interview", "generate"]).optional(),
  title: z.string().trim().max(200),
  occurredAt: JournalDate,
  body: z.string().max(4000),
}).strict();
const JournalDraftOutput = z.object({
  protocol: z.literal("cave-journal-draft-v1"),
  requestId: Id,
  title: z.string().trim().min(1).max(200),
  occurredAt: JournalDate,
  body: z.string().trim().min(1).max(1200),
}).strict().refine(value => JSON.stringify(value).length <= 2000, "Journal draft exceeds serialized bounds");
export const AssistantRequestSchema = z.object({
  mode: z.enum(["chat", "guide", "summarize", "review", "journey", "journal-draft"]),
  consent: z.literal(true),
  contextConsent: z.boolean().optional(),
  records: z.array(z.object({ id: Id, text: z.string().trim().min(1).max(4000) }).strict()).max(10),
  question: z.string().trim().min(1).max(1000).optional(),
  journeyId: Id.optional(),
  journalDraft: JournalDraftInput.optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }).strict()).max(12).optional(),
}).strict().superRefine((value, context) => {
  if (value.records.reduce((sum, record) => sum + record.text.length, 0) > 12000
    || new Set(value.records.map(record => record.id)).size !== value.records.length)
    context.addIssue({ code: "custom", message: "Records exceed bounds or contain duplicate IDs" });
  if ((value.mode === "summarize" || value.mode === "review") && value.records.length === 0)
    context.addIssue({ code: "custom", message: "Selected records required" });
  if ((value.history?.reduce((total, item) => total + item.content.length, 0) ?? 0) > 12000)
    context.addIssue({ code: "custom", message: "History exceeds bounds" });
  if (value.history?.length && value.mode !== "chat" && value.mode !== "journal-draft")
    context.addIssue({ code: "custom", message: "History is only supported in chat or journal-draft" });
  if (value.mode === "chat" && !value.question)
    context.addIssue({ code: "custom", message: "Chat requires a question" });
  if (value.mode === "chat" && value.records.length > 0 && value.contextConsent !== true)
    context.addIssue({ code: "custom", message: "Chat records require explicit context consent" });
  if (value.mode === "journey" && (!value.question || !value.journeyId || value.records.length > 0))
    context.addIssue({ code: "custom", message: "Journey requires question and journeyId, without private records" });
  if (value.mode !== "journal-draft" && value.journalDraft)
    context.addIssue({ code: "custom", message: "Journal draft data is only supported in journal-draft mode" });
  if (value.mode === "journal-draft") {
    if (!value.journalDraft || !value.question)
      context.addIssue({ code: "custom", message: "Journal draft requires draft data and a question" });
    if (value.records.length > 3)
      context.addIssue({ code: "custom", message: "Journal draft accepts at most three selected records" });
    if ((value.records.length > 0 || (value.journalDraft?.body.length ?? 0) > 0) && value.contextConsent !== true)
      context.addIssue({ code: "custom", message: "Journal draft content requires explicit context consent" });
    if (value.journalDraft?.operation === "edit" && !value.journalDraft.title)
      context.addIssue({ code: "custom", message: "Editing requires a journal title" });
  }
});

export const AssistantResponseSchema = z.object({
  status: z.enum(["ok", "blocked", "unavailable"]),
  message: z.string().trim().min(1).max(2000),
  question: z.string().trim().min(1).max(500).optional(),
  summary: z.string().trim().min(1).max(2000).optional(),
  journalDraft: JournalDraftOutput.optional(),
  journalStage: z.enum(["collecting", "ready"]).optional(),
  observations: z.array(z.object({ text: z.string().trim().min(1).max(500), sourceRecordIds: z.array(Id).min(1).max(10) }).strict()).max(6),
  sources: z.array(z.object({ id: Id, title: z.string().min(1).max(200), url: z.string().url().max(1000).refine(value => value.startsWith("https://")).optional() }).strict()).max(10),
  providerMode: z.enum(["mock", "live"]),
}).strict().superRefine((value, context) => {
  if (value.journalDraft && value.status !== "ok")
    context.addIssue({ code: "custom", message: "A journal draft requires ok status" });
  if (value.journalStage) {
    if (value.status !== "ok" || value.question !== undefined || value.summary !== undefined
      || value.observations.length > 0 || value.sources.length > 0)
      context.addIssue({ code: "custom", message: "Journal stages require a plain preview or collecting response" });
    if (value.journalStage === "collecting" && (value.journalDraft || value.message.length > 500))
      context.addIssue({ code: "custom", message: "Collecting requires a short message without a draft" });
    if (value.journalStage === "ready" && !value.journalDraft)
      context.addIssue({ code: "custom", message: "Ready requires a complete draft" });
  }
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

const UsageWindowSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive().nullable(),
  resetsAt: z.string().datetime(),
}).strict();
export const AssistantUsageSchema = z.object({
  hour: UsageWindowSchema,
  day: UsageWindowSchema,
  measuredAt: z.string().datetime(),
}).strict();
export type AssistantUsage = z.infer<typeof AssistantUsageSchema>;
