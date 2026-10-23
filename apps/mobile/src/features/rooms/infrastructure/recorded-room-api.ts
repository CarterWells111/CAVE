import { randomUUID } from "expo-crypto";

import { ROOM_QUESTION_IDS, type Room, type RoomApi } from "../domain/room";
import type { RoomHistoryRecord, RoomHistoryRepository } from "../history/room-history-repository";

type Snapshot = Pick<RoomHistoryRecord, "scenarioId" | "myAnswers" | "report">;
type CaptureScope = {
  epoch: number; loaded: boolean; references: number; warning: string | undefined;
  queue: Promise<void>; snapshots: Map<string, Snapshot>; unsubscribe(): void;
};
const scopes = new WeakMap<RoomHistoryRepository, Map<string, CaptureScope>>();

function acquireScope(repository: RoomHistoryRepository, owner: string): { scope: CaptureScope; release(): void } {
  let owners = scopes.get(repository);
  if (!owners) { owners = new Map(); scopes.set(repository, owners); }
  let shared = owners.get(owner);
  if (!shared) {
    const next: CaptureScope = { epoch: 0, loaded: false, references: 0, warning: undefined,
      queue: Promise.resolve(), snapshots: new Map(), unsubscribe: () => undefined };
    next.unsubscribe = repository.subscribeToOwnerClear(owner, () => {
      next.epoch += 1; next.loaded = false; next.snapshots.clear(); next.warning = undefined;
    });
    owners.set(owner, next); shared = next;
  }
  const scope = shared;
  scope.references += 1;
  return { scope, release() {
    scope.references -= 1;
    if (scope.references === 0) { scope.unsubscribe(); owners!.delete(owner); }
  } };
}

type Options = {
  api: RoomApi; repository: RoomHistoryRepository; ownerAccountId: string;
  isCurrentAccount(): boolean; now?(): string; createId?(): string;
};

/** Capture successful operations for the current account, never invitation credentials. */
export function createRecordedRoomApi({ api, repository, ownerAccountId, isCurrentAccount, now = () => new Date().toISOString(), createId = randomUUID }: Options): { api: RoomApi; dispose(): void } {
  const { scope, release } = acquireScope(repository, ownerAccountId);
  let active = true;
  const current = () => active && isCurrentAccount();
  const safeContent = (room: Room, action: RoomHistoryRecord["action"]): Snapshot => {
    const myAnswers = Object.fromEntries(ROOM_QUESTION_IDS.flatMap(key =>
      typeof room.myAnswers[key] === "string" ? [[key, room.myAnswers[key]!]] : []));
    const reportAllowed = room.myCompleted && room.partnerCompleted && room.reportConsent;
    // List responses omit a still-visible report; omission is not report revocation.
    const report = reportAllowed ? room.report ?? (action === "observed" && room.status === "reported"
      ? scope.snapshots.get(room.id)?.report : undefined) : undefined;
    return { scenarioId: room.scenarioId, myAnswers, ...(report ? { report } : {}) };
  };
  const capture = async (room: Room, action: RoomHistoryRecord["action"], startedEpoch: number) => {
    if (!current() || scope.epoch !== startedEpoch) return;
    const occurredAt = now(), id = createId();
    const task = scope.queue.then(async () => {
      if (!current() || scope.epoch !== startedEpoch) return;
      if (!scope.loaded) {
        const saved = await repository.list(ownerAccountId);
        if (!current() || scope.epoch !== startedEpoch) return;
        for (const item of [...saved].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
          const report = item.report ?? (item.action === "observed" ? scope.snapshots.get(item.roomId)?.report : undefined);
          scope.snapshots.set(item.roomId, { scenarioId: item.scenarioId, myAnswers: item.myAnswers, ...(report ? { report } : {}) });
        }
        scope.loaded = true;
      }
      const snapshot = safeContent(room, action);
      if (action === "observed" && (room.status === "ended"
        || JSON.stringify(scope.snapshots.get(room.id)) === JSON.stringify(snapshot))) return;
      if (!current() || scope.epoch !== startedEpoch) return;
      const record: RoomHistoryRecord = { id, roomId: room.id, occurredAt,
        action, timeKind: action === "observed" ? "observed" : "action", ...snapshot };
      await repository.save(ownerAccountId, record);
      if (current() && scope.epoch === startedEpoch) { scope.snapshots.set(room.id, snapshot); scope.warning = undefined; }
    });
    scope.queue = task.catch(() => undefined);
    try { await task; }
    catch {
      if (current() && scope.epoch === startedEpoch) scope.warning = "房间操作已完成，但这次房间历史未能保存到本机，成长回顾可能不完整。请刷新后重试保存。";
    }
  };
  const recordResult = async (operation: () => Promise<Room>, action: RoomHistoryRecord["action"]) => {
    const startedEpoch = scope.epoch;
    const room = await operation();
    await capture(room, action, startedEpoch);
    return room;
  };
  const recorded: RoomApi = {
    get historyWarning() { return scope.warning; },
    list: async () => {
      const startedEpoch = scope.epoch, rooms = await api.list();
      for (const room of rooms) await capture(room, "observed", startedEpoch);
      return rooms;
    },
    create: scenario => recordResult(() => api.create(scenario), "created"),
    join: token => recordResult(() => api.join(token), "joined"),
    get: id => recordResult(() => api.get(id), "observed"),
    saveAnswer: (id, questionId, answer) => recordResult(() => api.saveAnswer(id, questionId, answer), "answer-saved"),
    complete: (id, consent) => recordResult(() => api.complete(id, consent), "completed"),
    generateReport: id => recordResult(() => api.generateReport(id), "report-generated"),
    end: id => recordResult(() => api.end(id), "ended"),
    issueInvite: id => api.issueInvite(id),
  };
  return { api: recorded, dispose() { if (active) { active = false; release(); } } };
}
