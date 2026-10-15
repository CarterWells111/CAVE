import { useLayoutEffect, useRef, useState } from "react";
import { AssistantRequestSchema, type AssistantRequest, type AssistantResponse } from "@cave/contracts";
import { useAssistantJournal } from "./use-assistant-journal";
import { createAttachmentChatRequest } from "./assistant-attachment-request";
import { adaptJournalReviewResponse, createJournalReviewRequest } from "./assistant-journal-review";

type Sheet = "menu" | "journal" | "draft" | null;
type Kind = "journal" | null;
type ScopedSelection = { scope: string; kind: Kind };
type GeneratedDraft = NonNullable<AssistantResponse["journalDraft"]>;

export function useChatAttachments(scope: string, turns: { question: string; response: AssistantResponse }[]) {
  const journal = useAssistantJournal();
  const [selection, setSelection] = useState<ScopedSelection>({ scope, kind: null });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [historicalDraft, setHistoricalDraft] = useState<{ scope: string; value: GeneratedDraft } | null>(null);
  const lastGenerated = useRef<GeneratedDraft | null>(null);
  const pendingNew = useRef<string | null>(null);
  const reviewStart = useRef<{ requestId: string; turnIndex: number } | null>(null);
  const current = selection.scope === scope ? selection : { scope, kind: null };
  useLayoutEffect(() => {
    journal.controller.clear(); setSheet(null);
    reviewStart.current = null;
    lastGenerated.current = null; setHistoricalDraft(null);
    const resumeNew = pendingNew.current === scope;
    if (!resumeNew) pendingNew.current = null;
    setSelection({ scope, kind: resumeNew ? "journal" : null });
    if (resumeNew && journal.available) { journal.controller.beginNew(); pendingNew.current = null; }
  }, [scope, journal.controller, journal.available]);
  useLayoutEffect(() => {
    const draft = journal.draft;
    if (draft?.mode !== "review") { reviewStart.current = null; return; }
    if (reviewStart.current?.requestId !== draft.requestId) reviewStart.current = { requestId: draft.requestId, turnIndex: turns.length };
  }, [journal.draft, turns.length]);

  const choose = (kind: Exclude<Kind, null>) => {
    setSelection({ scope, kind });
    setSheet(kind);
  };
  const clear = () => {
    journal.controller.clear(); setSelection({ scope, kind: null }); setSheet(null);
    pendingNew.current = null; lastGenerated.current = null; setHistoricalDraft(null);
  };
  const startNewJournal = () => {
    journal.controller.clear(); lastGenerated.current = null; setHistoricalDraft(null);
    setSelection({ scope, kind: "journal" }); setSheet(null);
    pendingNew.current = scope;
    if (journal.available) { journal.controller.beginNew(); pendingNew.current = null; }
  };
  const privateKind = current.kind === "journal" && (journal.selectedIds.length > 0 || !!journal.draft?.body.trim()) ? "journal" : null;

  const prepare = async (question: string): Promise<AssistantRequest> => {
    if (current.kind === "journal") {
      const records = await journal.controller.getRecordPayload();
      const draft = journal.controller.getSnapshot().draft;
      if (draft?.mode === "review") {
        const start = reviewStart.current;
        return createJournalReviewRequest({ question, records, draft,
          turns: start?.requestId === draft.requestId ? turns.slice(start.turnIndex) : [] });
      }
      const base = createAttachmentChatRequest({ question, turns, records });
      if (!draft) return base;
      return AssistantRequestSchema.parse({
        ...base, mode: "journal-draft",
        ...(records.length || draft.body.trim() ? { contextConsent: true } : {}),
        journalDraft: {
          protocol: "cave-journal-draft-v1", requestId: draft.requestId, operation: draft.mode,
          stage: draft.mode === "new" && !draft.body.trim() ? "interview" : "generate",
          title: draft.mode === "edit" ? draft.original!.record.title : draft.title,
          occurredAt: draft.occurredAt, body: draft.body.trim(),
        },
      });
    }
    return createAttachmentChatRequest({ question, turns });
  };
  const accept = (payload: AssistantRequest, response: AssistantResponse) => {
    if (payload.mode === "review") {
      const draft = journal.controller.getSnapshot().draft;
      if (draft?.mode !== "review") throw new Error("journal-draft-required");
      const adapted = adaptJournalReviewResponse(response, draft);
      if (adapted.journalDraft) {
        journal.controller.acceptGeneration(JSON.stringify(adapted.journalDraft));
        lastGenerated.current = adapted.journalDraft;
      }
      return adapted;
    }
    if (payload.mode !== "journal-draft") return response;
    if (payload.journalDraft?.stage === "interview" && response.status === "ok"
      && response.journalStage === "collecting" && !response.journalDraft) return response;
    if (response.status !== "ok" || !response.journalDraft) throw new Error("journal-draft-invalid");
    journal.controller.acceptGeneration(JSON.stringify(response.journalDraft));
    lastGenerated.current = response.journalDraft;
    return response;
  };
  const openDraft = (value: GeneratedDraft) => {
    const draft = journal.controller.getSnapshot().draft;
    const latest = lastGenerated.current;
    const editable = draft?.requestId === value.requestId && latest && JSON.stringify(latest) === JSON.stringify(value);
    setHistoricalDraft(editable ? null : { scope, value });
    setSheet("draft");
  };
  const copyHistoricalDraft = () => {
    if (!historicalDraft || historicalDraft.scope !== scope || !journal.available) return;
    const value = historicalDraft.value;
    startNewJournal();
    journal.controller.editDraft({ title: value.title, occurredAt: value.occurredAt, body: value.body });
    setSheet("draft");
  };
  return {
    journal, kind: current.kind, sheet, setSheet, choose, clear, privateKind, prepare, accept, scope,
    startNewJournal, openDraft, copyHistoricalDraft,
    historicalDraft: historicalDraft?.scope === scope ? historicalDraft.value : null,
  };
}

export type ChatAttachments = ReturnType<typeof useChatAttachments>;
