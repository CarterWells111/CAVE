import { z } from "zod";

const Id = z.string().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
export const AssistantRequestSchema = z.object({
  mode: z.enum(["chat", "guide", "summarize", "review", "journey"]),
  consent: z.literal(true),
  records: z.array(z.object({ id: Id, text: z.string().trim().min(1).max(4000) }).strict()).max(10),
  question: z.string().trim().min(1).max(1000).optional(),
  journeyId: Id.optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }).strict()).max(12).optional(),
}).strict().superRefine((value, context) => {
  if (value.records.reduce((sum, record) => sum + record.text.length, 0) > 12000
    || new Set(value.records.map(record => record.id)).size !== value.records.length)
    context.addIssue({ code: "custom", message: "Records exceed bounds or contain duplicate IDs" });
  if ((value.mode === "summarize" || value.mode === "review") && value.records.length === 0)
    context.addIssue({ code: "custom", message: "Selected records required" });
  if ((value.history?.reduce((total, item) => total + item.content.length, 0) ?? 0) > 12000)
    context.addIssue({ code: "custom", message: "History exceeds bounds" });
  if (value.history?.length && value.mode !== "chat")
    context.addIssue({ code: "custom", message: "History is only supported in chat" });
  if (value.mode === "chat" && (!value.question || value.records.length > 0))
    context.addIssue({ code: "custom", message: "Chat requires a question without private records" });
  if (value.mode === "journey" && (!value.question || !value.journeyId || value.records.length > 0))
    context.addIssue({ code: "custom", message: "Journey requires question and journeyId, without private records" });
});

export const AssistantResponseSchema = z.object({
  status: z.enum(["ok", "blocked", "unavailable"]),
  message: z.string().trim().min(1).max(2000),
  question: z.string().trim().min(1).max(500).optional(),
  summary: z.string().trim().min(1).max(2000).optional(),
  observations: z.array(z.object({ text: z.string().trim().min(1).max(500), sourceRecordIds: z.array(Id).min(1).max(10) }).strict()).max(6),
  sources: z.array(z.object({ id: Id, title: z.string().min(1).max(200), url: z.string().url().max(1000).refine(value => value.startsWith("https://")).optional() }).strict()).max(10),
  providerMode: z.enum(["mock", "live"]),
}).strict();
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