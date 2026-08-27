import type { SafetyDecision, ScenarioStage } from "@cave/contracts";

export type GuardedModelOutput = {
  roleMessage: string;
  nextStage: ScenarioStage;
  safety: SafetyDecision;
};

export type OutputGuardResult =
  | { ok: true; value: GuardedModelOutput }
  | {
    ok: false;
    reason:
      | "prompt_disclosure"
      | "unsupported_diagnosis"
      | "legal_conclusion"
      | "threat"
      | "shame"
      | "terminal_safety_stop"
      | "invalid_safety_transition";
  };

export type OutputGuard = (
  candidate: GuardedModelOutput,
  currentStage: ScenarioStage
) => OutputGuardResult;

export type OutputGuardBinding = {
  serverOwnedText?: readonly string[];
  forbiddenFragments?: readonly string[];
};

const TEXT_RULES: Array<{
  reason: Exclude<OutputGuardResult, { ok: true }>["reason"];
  patterns: RegExp[];
}> = [
  {
    reason: "prompt_disclosure",
    patterns: [
      /CAVE_SYSTEM_PROMPT/u,
      /CAVE_POLICY/u,
      /system prompt/iu,
      /(?:system|developer)\s+(?:message|instructions?)/iu,
      /内部\s*(?:prompt|policy)/iu,
      /系统(?:提示词|消息|指令)/u,
      /开发者(?:消息|指令)/u
    ]
  },
  {
    reason: "unsupported_diagnosis",
    patterns: [
      /你患有/u,
      /诊断(?:了)?你/u,
      /你就是[^。！？\n]{0,12}(?:症|障碍|疾病|患者)/u,
      /肯定有[^。！？\n]{0,12}(?:症|障碍|疾病)/u,
      /这说明你就是[^。！？\n]{0,12}(?:人格|患者)/u,
      /you (?:have|are suffering from)/iu,
      /clinically diagnosed/iu
    ]
  },
  {
    reason: "legal_conclusion",
    patterns: [
      /法律上.*(?:一定|必然|肯定)/u,
      /构成犯罪/u,
      /这[^。！？\n]{0,16}(?:一定|肯定).*违法/u,
      /法院.*(?:一定|肯定|必然).*判/u,
      /(?:一定|肯定|必然).*有罪/u,
      /definitely illegal/iu,
      /committed a crime/iu
    ]
  },
  {
    reason: "threat",
    patterns: [
      /我(?:就|会)伤害你/u,
      /威胁你/u,
      /让你付出代价/u,
      /我会报复/u,
      /I(?:'ll| will) hurt you/iu,
      /you(?:'ll| will) regret/iu
    ]
  },
  {
    reason: "shame",
    patterns: [
      /丢脸/u,
      /羞耻/u,
      /可耻/u,
      /都是你的错/u,
      /真没用/u,
      /太差劲/u,
      /you should be ashamed/iu,
      /pathetic/iu
    ]
  }
];

function normalizeSensitiveText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function fragmentWindows(value: string): string[] {
  const normalized = normalizeSensitiveText(value);
  if (normalized.length < 16) return [];

  const fragments = new Set<string>([normalized]);
  const words = normalized.split(" ").filter(Boolean);
  if (words.length >= 5) {
    for (let index = 0; index <= words.length - 5; index += 1) {
      fragments.add(words.slice(index, index + 5).join(" "));
    }
  } else if (words.length === 1) {
    for (let index = 0; index <= normalized.length - 16; index += 1) {
      fragments.add(normalized.slice(index, index + 16));
    }
  }
  return [...fragments];
}

function boundFragments(binding: OutputGuardBinding): ReadonlySet<string> {
  const fragments = new Set<string>();
  for (const text of binding.serverOwnedText ?? []) {
    for (const line of text.split("\n")) {
      for (const fragment of fragmentWindows(line)) fragments.add(fragment);
    }
  }
  for (const value of binding.forbiddenFragments ?? []) {
    for (const fragment of fragmentWindows(value)) fragments.add(fragment);
  }
  return fragments;
}

export function createOutputGuard(binding: OutputGuardBinding = {}): OutputGuard {
  const forbidden = boundFragments(binding);
  return (candidate, currentStage) => {
  if (currentStage === "safety_stop" && candidate.nextStage !== "safety_stop") {
    return { ok: false, reason: "terminal_safety_stop" };
  }
  if (candidate.safety.level === "stop" && candidate.nextStage !== "safety_stop") {
    return { ok: false, reason: "invalid_safety_transition" };
  }
  const normalizedOutput = normalizeSensitiveText(candidate.roleMessage);
  if ([...forbidden].some((fragment) => normalizedOutput.includes(fragment))) {
    return { ok: false, reason: "prompt_disclosure" };
  }
  for (const rule of TEXT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(candidate.roleMessage))) {
      return { ok: false, reason: rule.reason };
    }
  }
  return { ok: true, value: candidate };
  };
}

export const guardModelOutput: OutputGuard = createOutputGuard();
