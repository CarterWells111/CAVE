import type { Room, RoomApi, RoomQuestionId, RoomReport, RoomScenarioId } from "../domain/room";

type Participant = { answers: Partial<Record<RoomQuestionId, string>>; completed: boolean; consent: boolean };
type StoredRoom = {
  id: string;
  scenarioId: RoomScenarioId;
  ownerId: string;
  partnerId?: string;
  inviteToken?: string;
  ended: boolean;
  participants: Record<string, Participant>;
  report?: RoomReport;
};

export function createFakeRoomServer() {
  const rooms = new Map<string, StoredRoom>();
  let nextId = 1;
  const participant = (): Participant => ({ answers: {}, completed: false, consent: false });
  const stored = (id: string, accountId: string): StoredRoom => {
    const room = rooms.get(id);
    if (!room || !room.participants[accountId]) throw new Error("ROOM_NOT_FOUND");
    return room;
  };
  const project = (room: StoredRoom, accountId: string): Room => {
    const mine = room.participants[accountId]!;
    const partnerId = accountId === room.ownerId ? room.partnerId : room.ownerId;
    const partner = partnerId ? room.participants[partnerId] : undefined;
    return {
      id: room.id,
      scenarioId: room.scenarioId,
      status: room.ended ? "ended" : room.report ? "reported" : !partner ? "waiting" : mine.completed && partner.completed ? "ready" : "active",
      participantCount: partner ? 2 : 1,
      myRole: accountId === room.ownerId ? "A" : "B",
      myAnswers: { ...mine.answers },
      myCompleted: mine.completed,
      partnerCompleted: partner?.completed ?? false,
      reportConsent: mine.consent,
      ...(room.report ? { report: room.report } : {}),
    };
  };
  return {
    forAccount(accountId: string): RoomApi {
      return {
        list: async () => [...rooms.values()].filter((room) => !!room.participants[accountId]).map((room) => project(room, accountId)),
        create: async (scenarioId: RoomScenarioId) => {
          const room: StoredRoom = { id: String(nextId++), scenarioId, ownerId: accountId, ended: false, participants: { [accountId]: participant() } };
          rooms.set(room.id, room);
          return project(room, accountId);
        },
        issueInvite: async (id: string) => {
          const room = stored(id, accountId);
          if (room.ownerId !== accountId || room.partnerId || room.ended) throw new Error("INVITE_UNAVAILABLE");
          const token = `fake-invite-token-${room.id}-${String(nextId++).padStart(4, "0")}`;
          room.inviteToken = token;
          return token;
        },
        join: async (token: string) => {
          const room = [...rooms.values()].find((item) => item.inviteToken === token);
          if (!room || room.ended || room.partnerId || room.ownerId === accountId) throw new Error("INVITE_UNAVAILABLE");
          room.partnerId = accountId;
          delete room.inviteToken;
          room.participants[accountId] = participant();
          return project(room, accountId);
        },
        get: async (id: string) => project(stored(id, accountId), accountId),
        saveAnswer: async (id: string, questionId: RoomQuestionId, answer: string) => {
          const room = stored(id, accountId);
          const mine = room.participants[accountId]!;
          if (room.ended || (mine.completed && room.report?.status !== "insufficient")) throw new Error("ROOM_CLOSED");
          mine.answers[questionId] = answer;
          mine.completed = false;
          mine.consent = false;
          delete room.report;
          return project(room, accountId);
        },
        complete: async (id: string, reportConsent: boolean) => {
          const room = stored(id, accountId);
          if (room.ended || !reportConsent) throw new Error("CONSENT_REQUIRED");
          const mine = room.participants[accountId]!;
          mine.completed = true;
          mine.consent = reportConsent;
          return project(room, accountId);
        },
        generateReport: async (id: string) => {
          const room = stored(id, accountId);
          const partner = room.partnerId ? room.participants[room.partnerId] : undefined;
          if (room.ended || !partner || !Object.values(room.participants).every((entry) => entry.completed && entry.consent)) throw new Error("NOT_READY");
          if (!room.report) {
            const enough = Object.values(room.participants).every((entry) => Object.values(entry.answers).filter((answer) => answer?.trim()).length >= 2);
            room.report = !enough
              ? { status: "insufficient", message: "目前没有足够的双方信息生成有依据的共同报告。可以各自补充、跳过，或结束本次填写。" }
              : { status: "ready", sections: {
                  commonAndDifferences: "你们都留下了愿意讨论的内容，关注之处也有不同。",
                  adviceForBoth: "可以先确认彼此在意的议题和边界，留出暂停的空间。",
                  nextSteps: "双方愿意时再选一个小步骤尝试；未回答的部分仍需分别确认。",
                } };
          }
          return project(room, accountId);
        },
        end: async (id: string) => {
          const room = stored(id, accountId);
          room.ended = true;
          delete room.inviteToken;
          return project(room, accountId);
        },
      };
    },
  };
}
