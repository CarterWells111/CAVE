import { AssistantRequestSchema, type AssistantRequest, type AssistantResponse } from "@cave/contracts";

type Turn = { question: string; response: AssistantResponse };

/** Keeps generation instructions separate from the user's visible question and trims complete old turns. */
export function createAttachmentChatRequest(input: {
  question: string;
  turns: readonly Turn[];
  instruction?: string;
  records?: AssistantRequest["records"];
}): AssistantRequest {
  const recent = input.turns.slice(-6).flatMap(turn => [
    { role: "user" as const, content: turn.question },
    { role: "assistant" as const, content: turn.response.message },
  ]);
  const instruction = input.instruction?.trim();
  if (instruction && instruction.length > 2000) throw new Error("assistant-instruction-too-long");
  const extra = instruction ? [{ role: "user" as const, content: instruction }] : [];
  while (recent.length + extra.length > 12
    || recent.reduce((total, item) => total + item.content.length, instruction?.length ?? 0) > 12000) {
    recent.splice(0, 2);
  }
  const records = input.records ?? [];
  return AssistantRequestSchema.parse({
    mode: "chat", consent: true, records, question: input.question,
    history: [...extra, ...recent],
    ...(records.length ? { contextConsent: true } : {}),
  });
}
