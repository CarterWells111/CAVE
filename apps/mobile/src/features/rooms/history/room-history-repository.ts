import { RoomScenarioSchema } from "@cave/contracts";
import { z } from "zod";

import type { RoomQuestionId, RoomReport, RoomScenarioId } from "../domain/room";

export type RoomHistoryRecord = Readonly<{
  id: string;
  roomId: string;
  scenarioId: RoomScenarioId;
  occurredAt: string;
  action: "created" | "joined" | "answer-saved" | "completed" | "report-generated" | "ended" | "observed";
  timeKind: "action" | "observed";
  myAnswers: Partial<Record<RoomQuestionId, string>>;
  report?: RoomReport;
}>;

export interface RoomHistoryRepository {
  list(ownerAccountId: string): Promise<readonly RoomHistoryRecord[]>;
  save(ownerAccountId: string, record: RoomHistoryRecord): Promise<void>;
  clearOwner(ownerAccountId: string): Promise<void>;
  clearAll(): Promise<void>;
  /** Native whole-file deletion must stay available while database access is locked. */
  withStorageDeletion?(operation: () => Promise<void>): Promise<void>;
  subscribeToOwnerClear(ownerAccountId: string, listener: () => void): () => void;
}

const Identifier = z.string().trim().min(1).max(200);
const PublicReport = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    sections: z.object({
      commonAndDifferences: z.string().min(1).max(2000),
      adviceForBoth: z.string().min(1).max(2000),
      nextSteps: z.string().min(1).max(2000),
    }).strict(),
  }).strict(),
  z.object({ status: z.enum(["paused", "insufficient"]), message: z.string().min(1).max(2000) }).strict(),
]);
const RecordSchema = z.object({
  id: Identifier,
  roomId: Identifier,
  scenarioId: RoomScenarioSchema,
  occurredAt: z.string().datetime({ offset: true }),
  action: z.enum(["created", "joined", "answer-saved", "completed", "report-generated", "ended", "observed"]),
  timeKind: z.enum(["action", "observed"]),
  myAnswers: z.object({
    expectation: z.string().max(2000).optional(),
    concern: z.string().max(2000).optional(),
    boundary: z.string().max(2000).optional(),
    response_next_step: z.string().max(2000).optional(),
  }).strict(),
  report: PublicReport.optional(),
}).strict().refine(record => (record.action === "observed") === (record.timeKind === "observed"));

export function validateRoomHistoryIdentifier(value: string): string {
  const result = Identifier.safeParse(value);
  if (!result.success || result.data !== value) throw new Error("room-history-invalid-identifier");
  return result.data;
}

export function validateRoomHistoryRecord(value: unknown): RoomHistoryRecord {
  const result = RecordSchema.safeParse(value);
  if (!result.success || result.data.id !== (value as RoomHistoryRecord).id
    || result.data.roomId !== (value as RoomHistoryRecord).roomId) throw new Error("room-history-invalid-record");
  const { report, myAnswers, ...record } = result.data;
  const answers: RoomHistoryRecord["myAnswers"] = {};
  for (const key of ["expectation", "concern", "boundary", "response_next_step"] as const) {
    if (myAnswers[key] !== undefined) answers[key] = myAnswers[key];
  }
  return { ...record, occurredAt: new Date(record.occurredAt).toISOString(), myAnswers: answers, ...(report === undefined ? {} : { report }) };
}

/** Deletion intent invalidates writes immediately; subscribers observe committed deletion only. */
export function createRoomHistoryLifecycle() {
  const listeners = new Map<string, Set<() => void>>();
  const epochs = new Map<string, number>();
  const clearing = new Map<string, number>();
  let allEpoch = 0;
  let clearingAll = 0;
  const notify = (owner: string) => {
    for (const listener of [...listeners.get(owner) ?? []]) {
      try { listener(); } catch { /* Committed deletion must not fail because a subscriber throws. */ }
    }
  };
  return {
    capture(owner: string): () => boolean {
      const epoch = epochs.get(owner) ?? 0;
      const globalEpoch = allEpoch;
      const allowed = clearingAll === 0 && (clearing.get(owner) ?? 0) === 0;
      return () => allowed && clearingAll === 0 && (clearing.get(owner) ?? 0) === 0
        && globalEpoch === allEpoch && epoch === (epochs.get(owner) ?? 0);
    },
    beginClear(owner?: string): () => void {
      if (owner === undefined) {
        allEpoch += 1;
        clearingAll += 1;
        return () => { clearingAll -= 1; };
      }
      epochs.set(owner, (epochs.get(owner) ?? 0) + 1);
      clearing.set(owner, (clearing.get(owner) ?? 0) + 1);
      return () => {
        const remaining = (clearing.get(owner) ?? 1) - 1;
        if (remaining === 0) clearing.delete(owner);
        else clearing.set(owner, remaining);
      };
    },
    subscribe(owner: string, listener: () => void): () => void {
      validateRoomHistoryIdentifier(owner);
      const ownerListeners = listeners.get(owner) ?? new Set<() => void>();
      ownerListeners.add(listener);
      listeners.set(owner, ownerListeners);
      return () => {
        ownerListeners.delete(listener);
        if (ownerListeners.size === 0) listeners.delete(owner);
      };
    },
    notifyOwner: notify,
    notifyAll() { for (const owner of [...listeners.keys()]) notify(owner); },
  };
}
