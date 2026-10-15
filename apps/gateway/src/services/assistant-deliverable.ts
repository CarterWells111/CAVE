import { AssistantResponseSchema, type AssistantRequest, type AssistantResponse } from "@cave/contracts";
import { isChineseProse } from "./chinese-output";

const DraftOutput = AssistantResponseSchema.shape.journalDraft.unwrap();
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
function invalid(): never { throw new Error("invalid-assistant-delivery"); }

function recordObject(text: string) {
  try { return object(JSON.parse(text) as unknown); } catch { return undefined; }
}

function validateReview(input: AssistantRequest, response: AssistantResponse) {
  const contexts = input.records.flatMap(record => {
    const value = recordObject(record.text);
    return value?.referenceType === "journal-review-context" ? [{ record, value }] : [];
  });
  // Period reviews from older entry points do not create a local journal draft.
  if (contexts.length === 0) return;
  if (contexts.length !== 1) invalid();
  const context = contexts[0]!;
  const task = object(context.value.reviewTask);
  if (!task || typeof task.selectedRecordId !== "string") invalid();
  const selected = input.records.find(record => record.id === task.selectedRecordId);
  if (!selected || selected === context.record) invalid();
  const unique = (id: string) => id === selected.id ? `${id}.context` : id;
  const conversationId = unique("journal-review-conversation");
  const draftId = unique("journal-review-current-draft");
  if (context.record.id !== conversationId || response.sources.length > 0) invalid();
  const allowed = new Set([selected.id, conversationId]);
  if (task.currentReviewDraftRecordId !== undefined) {
    if (task.currentReviewDraftRecordId !== draftId || !input.records.some(record => record.id === draftId)) invalid();
    allowed.add(draftId);
  }
  if (response.observations.some(item => item.sourceRecordIds.some(id => !allowed.has(id)))) invalid();
  if (!response.summary) return;
  const original = recordObject(selected.text);
  // Old clients omit this local draft identity. Reserve the full contract limit
  // so a successful response will fit whatever valid ID that client holds.
  const requestId = task.requestId === undefined ? "x".repeat(100) : task.requestId;
  if (!DraftOutput.safeParse({ protocol: "cave-journal-draft-v1", requestId,
    title: original?.title, occurredAt: task.periodEnd, body: response.summary }).success) invalid();
}

/** Validate delivery against mobile adoption rules without writing or billing. */
export function validateAssistantDelivery(input: AssistantRequest, response: unknown): AssistantResponse {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(response); } catch { invalid(); }
  if (!serialized || serialized.length > 24_000) invalid();
  const parsed = AssistantResponseSchema.safeParse(response);
  if (!parsed.success) invalid();
  const result = parsed.data;
  const draft = result.journalDraft;
  const stage = result.journalStage;
  if (stage && input.mode !== "journal-draft") invalid();
  if (stage === "collecting" && input.journalDraft?.stage !== "interview") invalid();
  if (draft && (input.mode !== "journal-draft" || !input.journalDraft
    || draft.requestId !== input.journalDraft.requestId
    || draft.occurredAt !== input.journalDraft.occurredAt
    || (input.journalDraft.operation === "edit" && draft.title !== input.journalDraft.title)
    || !isChineseProse(draft.body)
    || (input.journalDraft.operation !== "edit" && !isChineseProse(draft.title)))) invalid();
  if (input.mode === "journal-draft" && result.status === "ok" && !draft && stage !== "collecting") invalid();
  const recordIds = new Set(input.records.map(record => record.id));
  if (result.observations.some(item => item.sourceRecordIds.some(id => !recordIds.has(id)))) invalid();
  const prose = [result.message, result.question, result.summary, ...result.observations.map(item => item.text)]
    .filter((value): value is string => value !== undefined);
  if (!prose.every(isChineseProse)) invalid();
  if (input.mode === "review" && result.status === "ok") validateReview(input, result);
  return result;
}
