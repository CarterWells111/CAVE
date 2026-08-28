import type { PracticeTurn, SafetyDecision } from "@cave/contracts";

export type SafetyPolicyInput = {
  turns: PracticeTurn[];
  classification?: "safe" | "uncertain";
};

export type SafetyPolicy = (input: SafetyPolicyInput) => SafetyDecision;

export type InjectableTurnSafetyInput = {
  recentTurns: PracticeTurn[];
  userMessage: string;
};

export interface InjectableTurnSafetyEvaluator {
  evaluateTurn(
    input: InjectableTurnSafetyInput,
    signal: AbortSignal
  ): Promise<SafetyDecision>;
}

type StopPattern = {
  patterns: RegExp[];
  decision: SafetyDecision;
};

const STOP_PATTERNS: StopPattern[] = [
  {
    patterns: [
      /直接危险/u,
      /现实(?:世界)?危险/u,
      /拿刀(?:堵|守|站在)?(?:在)?门/u,
      /持刀堵门/u,
      /拿枪威胁/u,
      /immediate danger/iu
    ],
    decision: { level: "stop", reasonCode: "danger", resourceCategory: "emergency" }
  },
  {
    patterns: [/暴力/u, /袭击/u, /殴打/u, /(?:刚|正在|曾经)?打了我/u, /violence/iu],
    decision: { level: "stop", reasonCode: "violence", resourceCategory: "violence" }
  },
  {
    patterns: [
      /自伤/u,
      /自杀/u,
      /不想活/u,
      /活着.*(?:没有|没).*(?:意思|意义)/u,
      /结束(?:自己|我的)?生命/u,
      /self[- ]?harm/iu,
      /suicid/iu,
      /end(?:ing)? my life/iu
    ],
    decision: { level: "stop", reasonCode: "self_harm", resourceCategory: "self_harm" }
  },
  {
    patterns: [
      /医疗紧急/u,
      /呼吸困难/u,
      /失去意识/u,
      /胸痛/u,
      /嘴唇发紫/u,
      /medical emergency/iu
    ],
    decision: { level: "stop", reasonCode: "medical_emergency", resourceCategory: "medical" }
  },
  {
    patterns: [
      /未成年人/u,
      /未满(?:十)?八岁/u,
      /我今年(?:[0-9]|1[0-7])岁/u,
      /我今年十[一二三四五六七]岁/u,
      /minor disclosure/iu
    ],
    decision: { level: "stop", reasonCode: "minor", resourceCategory: "minor" }
  }
];

const BOUNDARY_PATTERNS = [/不能继续/u, /需要(?:在这里)?停/u, /不要再/u, /到此为止/u];
const CLEAR_BOUNDARY_CLAUSE_PATTERNS = [
  /^我(?:今天|现在)?不能继续(?:了|下去)?$/u,
  /^我需要(?:在这里)?停(?:下来|止)(?:了)?$/u,
  /^我(?:不想|不要)再继续(?:了)?$/u,
  /^我(?:想|要)到此为止$/u
];
const PRESSURE_PATTERNS = [/必须/u, /别停/u, /再做一点/u, /不许拒绝/u, /you have to/iu];
const EXPLICIT_SAFE_PRACTICE_PATTERNS = [
  /我想练习/u,
  /请(?:和|帮)我练习/u,
  /这是(?:一次|一个)?(?:模拟|练习)/u,
  /practice (?:how to|saying|setting)/iu,
  /roleplay practice/iu
];

function matches(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function isClearBoundary(text: string) {
  const clauses = text
    .split(/[，。！]/u)
    .map((clause) => clause.trim())
    .filter(Boolean);
  return clauses.length > 0 && clauses.every(
    (clause) => matches(clause, CLEAR_BOUNDARY_CLAUSE_PATTERNS)
  );
}

export function classifySafetyDeterministically(
  input: Pick<SafetyPolicyInput, "turns">
): "safe" | "uncertain" {
  const latestUserTurn = input.turns
    .slice()
    .reverse()
    .find((turn) => turn.role === "user");
  return latestUserTurn && (
    isClearBoundary(latestUserTurn.text) ||
    matches(latestUserTurn.text, EXPLICIT_SAFE_PRACTICE_PATTERNS)
  )
    ? "safe"
    : "uncertain";
}

export const evaluateSafety: SafetyPolicy = ({ turns, classification }) => {
  const combined = turns.map((turn) => turn.text).join("\n");
  for (const rule of STOP_PATTERNS) {
    if (matches(combined, rule.patterns)) return rule.decision;
  }

  const boundaryIndex = turns.findIndex(
    (turn) => turn.role === "user" && matches(turn.text, BOUNDARY_PATTERNS)
  );
  if (boundaryIndex >= 0) {
    const pressureAfterBoundary = turns
      .slice(boundaryIndex + 1)
      .some((turn) => turn.role === "assistant" && matches(turn.text, PRESSURE_PATTERNS));
    if (pressureAfterBoundary) {
      return { level: "stop", reasonCode: "clear_boundary" };
    }
  }

  return classification === "safe"
    ? { level: "safe", reasonCode: "none" }
    : { level: "stop", reasonCode: "uncertain" };
};

export function createTurnSafetyEvaluator(): InjectableTurnSafetyEvaluator {
  return {
    async evaluateTurn(input, signal) {
      if (signal.aborted) throw new DOMException("The operation was aborted", "AbortError");
      const turns: PracticeTurn[] = [
        ...input.recentTurns,
        { role: "user", text: input.userMessage }
      ];
      return evaluateSafety({
        turns,
        classification: classifySafetyDeterministically({ turns })
      });
    }
  };
}
