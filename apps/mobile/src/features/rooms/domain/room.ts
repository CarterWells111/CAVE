export const ROOM_SCENARIOS = [
  { id: "first-overnight", title: "第一次过夜", introduction: "一起商量第一次过夜的期待与边界。" },
  { id: "pause", title: "说出暂停", introduction: "练习在需要时停下来，并听见彼此的回应。" },
  { id: "adjust", title: "调整靠近", introduction: "聊聊靠近的节奏，保留随时调整的空间。" },
] as const;

export type RoomScenarioId = typeof ROOM_SCENARIOS[number]["id"];
export type RoomQuestionId = "expectation" | "concern" | "boundary" | "response_next_step";
export const ROOM_QUESTION_IDS: readonly RoomQuestionId[] = ["expectation", "concern", "boundary", "response_next_step"];

export const ROOM_QUESTIONS: Record<RoomScenarioId, readonly { id: RoomQuestionId; title: string; prompt: string }[]> = {
  "first-overnight": [
    { id: "expectation", title: "期待", prompt: "想到第一次过夜，你最期待什么？有什么不确定？" },
    { id: "concern", title: "担忧", prompt: "想到第一次过夜，你有什么担心或尚未准备好的地方？" },
    { id: "boundary", title: "边界", prompt: "哪些事需要先问过你，哪些事你现在不想尝试？" },
    { id: "response_next_step", title: "回应与下一步", prompt: "如果当晚想暂停或改变计划，你希望怎样说、怎样被回应？" },
  ],
  "pause": [
    { id: "expectation", title: "期待", prompt: "在互动中，什么会让你更容易说出暂停？" },
    { id: "concern", title: "担忧", prompt: "有什么情形会让你难以说出暂停？" },
    { id: "boundary", title: "边界", prompt: "哪种情形下你会想立刻停下来？" },
    { id: "response_next_step", title: "回应与下一步", prompt: "你想用什么话或动作示意暂停？暂停后怎样确认下一步？" },
  ],
  "adjust": [
    { id: "expectation", title: "期待", prompt: "此刻你期待怎样的靠近与相处节奏？" },
    { id: "concern", title: "担忧", prompt: "靠近时，你有什么顾虑或需要更多时间的地方？" },
    { id: "boundary", title: "边界", prompt: "哪些靠近方式需要先征询你？" },
    { id: "response_next_step", title: "回应与下一步", prompt: "如果想放慢或改变方式，你会怎样表达？之后希望如何继续？" },
  ],
};

export type RoomStatus = "waiting" | "active" | "ready" | "reported" | "ended";
export type Room = Readonly<{
  id: string;
  scenarioId: RoomScenarioId;
  status: RoomStatus;
  inviteToken?: string;
  participantCount: number;
  myRole?: "A" | "B";
  myAnswers: Partial<Record<RoomQuestionId, string>>;
  myCompleted: boolean;
  partnerCompleted: boolean;
  reportConsent: boolean;
  report?: RoomReport;
}>;

export type RoomReport = Readonly<
  | { status: "ready"; sections: Readonly<{
      commonAndDifferences: string;
      adviceForBoth: string;
      nextSteps: string;
    }> }
  | { status: "paused" | "insufficient"; message: string }
>;

export interface RoomApi {
  list(): Promise<readonly Room[]>;
  create(scenarioId: RoomScenarioId): Promise<Room>;
  issueInvite(roomId: string): Promise<string>;
  join(inviteToken: string): Promise<Room>;
  get(roomId: string): Promise<Room>;
  saveAnswer(roomId: string, questionId: RoomQuestionId, answer: string): Promise<Room>;
  complete(roomId: string, reportConsent: boolean): Promise<Room>;
  generateReport(roomId: string): Promise<Room>;
  end(roomId: string): Promise<Room>;
}

export function isRoomScenarioId(value: unknown): value is RoomScenarioId {
  return ROOM_SCENARIOS.some((scenario) => scenario.id === value);
}

export function normalizeInviteToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return /^[A-Za-z0-9_-]{16,256}$/u.test(token) ? token : null;
}

export function mayGenerateReport(room: Room): boolean {
  return room.status !== "ended" && room.myCompleted && room.partnerCompleted && room.reportConsent && room.report === undefined;
}
