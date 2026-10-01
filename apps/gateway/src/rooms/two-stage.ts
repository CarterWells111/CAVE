import { RoomReportSchema, type RoomReport } from "@cave/contracts";
import { z } from "zod";
import catalog from "../../../../docs/calibration/paired-room/two-stage/fact-catalog.json";
import templates from "../../../../docs/calibration/paired-room/two-stage/render-templates.json";
import type { RoomReportInput } from "./report-provider";

const Side = z.enum(["A", "B"]);
const Scenario = z.enum(["first-overnight", "pause", "adjust"]);
const Topic = z.enum(["activity", "overnight", "boundaries", "pause", "retalk", "touch", "concern"]);
const FactId = z.string().regex(/^f[1-9][0-9]*$/u);
const RelationId = z.string().regex(/^r[1-9][0-9]*$/u);
const OpenId = z.string().regex(/^u[1-9][0-9]*$/u);
const AnswerId = z.string().regex(/^[AB]\.(?:expectation|concern|boundary|response_next_step)$/u);
const Scope = z.enum(["current", "when_owner_pauses", "when_other_pauses", "when_owner_tired", "when_other_wants_leave", "after_dinner", "after_rest", "before_touch"]);
const Fact = z.object({ id: FactId, owner: Side, answerId: AnswerId, sourceSpan: z.string().min(2).max(120), code: z.string().min(2).max(64), scope: Scope }).strict();
const Relation = z.object({ id: RelationId, kind: z.enum(["shared", "compatible", "different"]), topic: Topic, factIds: z.tuple([FactId, FactId]).refine(ids => ids[0] !== ids[1]) }).strict();
const OneSided = z.object({ id: OpenId, kind: z.literal("one_sided_proposal"), topic: Topic, factId: FactId, missingSide: Side }).strict();
const Unresolved = z.object({ id: OpenId, kind: z.literal("unresolved_choice"), topic: Topic, factIds: z.tuple([FactId, FactId]).refine(ids => ids[0] !== ids[1]) }).strict();
const ReadyLedger = z.object({ version: z.literal("paired-facts-v0.1"), scenarioId: Scenario, status: z.literal("ready"),
  facts: z.array(Fact).min(2).max(32), relations: z.array(Relation).min(1).max(16), openItems: z.array(z.discriminatedUnion("kind", [OneSided, Unresolved])).max(8) }).strict();
const Ledger = z.discriminatedUnion("status", [ReadyLedger,
  z.object({ version: z.literal("paired-facts-v0.1"), scenarioId: Scenario, status: z.literal("paused"), privateReasonCode: z.literal("possible_safety_risk") }).strict(),
  z.object({ version: z.literal("paired-facts-v0.1"), scenarioId: Scenario, status: z.literal("insufficient"), privateReasonCode: z.literal("insufficient_bilateral_facts") }).strict()]);
const RelationIds = z.array(RelationId).min(1).max(2).refine(ids => new Set(ids).size === ids.length);
const UniqueIds = <T extends z.ZodTypeAny>(schema: T, max: number) => z.array(schema).max(max).refine(ids => new Set(ids).size === ids.length);
const Plan = z.object({ version: z.literal("paired-report-plan-v0.1"), scenarioId: Scenario,
  ledgerSha256: z.string().regex(/^[a-f0-9]{64}$/u), catalogSha256: z.string().regex(/^[a-f0-9]{64}$/u), templatesSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  sections: z.object({
    commonAndDifferences: z.object({ sharedOrCompatibleRelationIds: RelationIds, differentRelationIds: UniqueIds(RelationId, 2) }).strict(),
    adviceForBoth: z.object({ discussionRelationIds: RelationIds, cautionCodes: UniqueIds(z.enum(["respect_stop", "do_not_infer_consent", "do_not_infer_touch_consent", "do_not_pressure", "do_not_require_explanation"]), 2).min(1) }).strict(),
    nextSteps: z.object({ actionCodes: UniqueIds(z.enum(["confirm_evening_plan", "pause_then_check", "walk_first", "ask_before_touch"]), 2).min(1),
      boundaryFactIds: UniqueIds(FactId, 2), openItemIds: UniqueIds(OpenId, 2) }).strict(),
  }).strict(),
}).strict();

export type FactLedger = z.infer<typeof Ledger>;
export type ReadyFactLedger = z.infer<typeof ReadyLedger>;
export type ReportPlan = z.infer<typeof Plan>;
type FactRecord = z.infer<typeof Fact>;
type RelationRecord = z.infer<typeof Relation>;
type CodeEntry = (typeof catalog.factCodes)[number];
const codes = new Map<string, CodeEntry>(catalog.factCodes.map(entry => [entry.code, entry]));
const actions = new Map(catalog.actionTemplates.map(entry => [entry.code, entry]));
const cautions = new Map(catalog.cautionTemplates.map(entry => [entry.code, entry]));
const compatible = (a: string, b: string) => catalog.compatiblePairs.some(pair => (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a));
const other = (side: "A" | "B") => side === "A" ? "B" : "A";
const insufficientLedger = (scenarioId: RoomReportInput["scenarioId"]): FactLedger => ({
  version: "paired-facts-v0.1", scenarioId, status: "insufficient", privateReasonCode: "insufficient_bilateral_facts",
});

function requireValid(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`two-stage-${reason}`);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, stable(item)]));
  return value;
}

export async function contentHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(value)));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}

export { catalog as roomFactCatalog, templates as roomRenderTemplates };

const denied = (span: string) => /(?:不|没|无|别|并非|未曾).{0,3}(?:想|希望|愿意|可以|会|要|打算|提出|先问|确认|停止|休息|散步|留宿)/u.test(span);
const positive = (span: string, pattern: RegExp) => pattern.test(span) && !denied(span);
function sourceSupports(code: string, span: string, answer: string, scope: string): boolean {
  switch (code) {
    case "wants_evening_together": return positive(span, /(?:想|希望|愿意|可以|期待|看看能不能).{0,12}(?:一起|共同).{0,10}(?:做饭|吃饭|晚饭|聊天|度过晚间)|(?:想|希望).{0,4}和对方.{0,10}(?:做顿饭|做饭|吃饭|聊聊天)|(?:想|希望).{0,8}(?:晚餐|晚饭).{0,4}一起吃/u);
    case "wants_walk_together": return positive(span, /(?:想|希望|愿意|可以|先).{0,12}(?:一起|出去)?(?:散步|走走)/u);
    case "wants_rest_separately": return positive(span, /(?:想|希望|愿意|可以|能).{0,12}(?:各自|分别|单独).{0,5}休息/u);
    case "wants_overnight": return positive(span, /(?:想|希望|愿意|看看能不能).{0,14}(?:留宿|过夜|住下|待到第二天)/u);
    case "no_overnight_now": return /(?:这次|今晚|现在).{0,8}(?:不想|不要|不愿).{0,8}(?:留宿|过夜|住下)/u.test(span);
    case "no_sex_now": return /(?:这次|今晚|现在).{0,8}(?:不想|不要|不愿).{0,8}(?:性行为|发生关系)/u.test(span);
    case "overnight_not_consent": return /(?:不把|不将).{0,8}(?:过夜|留宿).{0,14}(?:亲密|性行为|承诺|同意)|(?:过夜|留宿).{0,6}(?:不等于|不代表).{0,10}(?:亲密|性行为|承诺|同意)/u.test(span);
    case "wants_leave_when_tired": return scope === "when_owner_tired" && /(?:疲惫|累|疲劳).{0,14}(?:我|自己).{0,8}(?:回家|回自己家|离开)/u.test(span);
    case "stops_if_other_leaves": return scope === "when_other_wants_leave" && /(?:对方|另一方).{0,6}(?:想|要)?(?:回家|回去).{0,6}(?:我)?(?:就|会|可以)?(?:停|结束)/u.test(span);
    case "wants_end_time": return positive(span, /(?:想|希望|可以|先).{0,10}(?:约好|确定|说好).{0,6}结束时间/u);
    case "asks_overnight_after_dinner": return scope === "after_dinner" && /(?:(?:晚饭|晚餐|吃饭).{0,8}(?:之后|以后|后)|饭后).{0,12}(?:再问|问一次).{0,12}(?:留宿|过夜|住下|留下|住一晚)/u.test(span);
    case "fears_sleep_disruption": return /(?:担心|怕|顾虑).{0,18}(?:住下|留宿|过夜|临时).{0,12}(?:睡不好|影响睡眠|睡眠)|(?:临时留在|临时住在).{0,14}(?:担心|怕).{0,5}睡不好/u.test(span);
    case "fears_pressuring_other": return /(?:担心|怕|顾虑).{0,16}(?:留宿|过夜|住下).{0,12}(?:对方|另一方).{0,4}压力|(?:邀请|提议).{0,8}(?:留下|留宿|过夜).{0,12}(?:让|给).{0,6}(?:对方|另一方).{0,4}压力/u.test(span);
    case "pause_stop_touch": return /(?:停止|停下|不再|不继续).{0,6}(?:触碰|碰|身体接触|接触)/u.test(span) && /(?:暂停|说停|听到停)/u.test(answer)
      && (scope === "when_owner_pauses" ? /(?:我说停|我暂停|暂停就是|喊暂停)/u.test(answer) : scope === "when_other_pauses" && /(?:听到停|听到暂停|对方说停|对方暂停)/u.test(answer));
    case "pause_stop_questions": return /(?:停止|停下|不要|不再).{0,5}(?:追问|问原因)/u.test(span) && /(?:暂停|说停|听到停)/u.test(answer)
      && (scope === "when_owner_pauses" ? /(?:我说停|我暂停|暂停就是)/u.test(answer) : scope === "when_other_pauses" && /(?:听到停|对方说停|对方暂停)/u.test(answer));
    case "needs_one_hour_alone": return scope === "when_owner_pauses" && /(?:我说停|我暂停|我喊暂停)/u.test(answer)
      && (/(?:给我|我想|我需要).{0,8}(?:一小时|六十分钟).{0,5}(?:独处|一个人)/u.test(span)
        || /(?:让我|给我).{0,6}(?:单独待|独处).{0,4}(?:一小时|六十分钟)/u.test(span));
    case "retalk_self_initiates": return scope === "after_rest" && /(?:再谈|再聊)/u.test(answer) && /(?:我|自己)/u.test(answer)
      && !/(?:对方|另一方)/u.test(span) && /(?:由我|我来|我会|我主动|会主动).{0,10}(?:提出|发起|开启|联系|提)/u.test(span);
    case "waits_other_retalk": return scope === "after_rest" && /(?:再谈|再聊|愿意聊|话题)/u.test(answer)
      && /(?:等对方|由对方|等另一方|等你).{0,10}(?:提出|发起|开启|联系|话题)/u.test(span);
    case "does_not_resume_touch_unprompted": return scope === "after_rest" && /(?:不会|不).{0,4}(?:自行|自己|主动).{0,4}(?:恢复|继续)/u.test(span) && /(?:触碰|暂停|说停|听到停)/u.test(answer);
    case "fears_explanation_demand": return /(?:担心|怕).{0,10}(?:暂停后|说停后).{0,10}(?:解释|追问原因)|(?:停下后|暂停后).{0,6}(?:不想|不要).{0,6}(?:解释理由|解释原因)/u.test(span);
    case "fears_no_retalk": return /(?:担心|怕).{0,12}(?:不知道|不确定).{0,12}(?:再谈|再聊|机会交流)/u.test(span);
    case "wants_less_touch": return positive(span, /(?:想|希望|先).{0,10}(?:身体接触|触碰).{0,6}(?:少一点|少些|放慢)/u);
    case "no_hug_now": return /(?:现在|目前|这次|今天).{0,8}(?:不想|不要|不愿).{0,5}(?:拥抱|抱抱|抱)/u.test(span);
    case "handholding_undecided": return /牵手.{0,8}(?:暂不确定|不确定|还没决定|没有决定|还没想好|没想好)/u.test(span);
    case "no_hug_handhold_without_check": return scope === "before_touch" && (/(?:不会|不).{0,8}(?:未确认|没确认|未问|没问).{0,8}(?:拥抱|抱).{0,8}(?:牵手|牵)/u.test(span)
      || /(?:没问清楚|没确认|未确认).{0,8}(?:不抱|不拥抱).{0,5}(?:不牵|不牵手)/u.test(span));
    case "ask_before_touch": return scope === "before_touch" && (/(?:需要|想|要).{0,8}(?:触碰|碰|牵手|拥抱).{0,8}(?:再|先)?(?:问|询问)/u.test(span)
      || /(?:碰|触碰|牵手|拥抱).{0,6}(?:之前|前).{0,8}(?:我会|我来|由我).{0,4}(?:先问|询问)/u.test(span));
    case "fears_slow_means_future_yes": return /(?:担心|怕).{0,12}(?:慢一点|慢点|放慢).{0,18}(?:迟早|以后|将来).{0,10}(?:答应|同意).{0,4}(?:拥抱|牵手|抱抱)/u.test(span);
    case "fears_questions_interrupt": return /(?:担心|怕).{0,10}(?:问太多|频繁问|一直问|老问).{0,8}(?:打断|影响)/u.test(span);
    case "wants_no_touch_response": return /(?:想|希望).{0,10}(?:对方|另一方).{0,8}(?:可以不碰|不碰也可以|不用碰)/u.test(span);
    case "fears_misunderstanding": return /(?:担心|怕).{0,8}(?:被误会|误会)/u.test(span);
    default: return false;
  }
}

const positiveCodes = new Set(["wants_evening_together", "wants_walk_together", "wants_rest_separately", "wants_overnight", "wants_leave_when_tired", "stops_if_other_leaves", "wants_end_time", "asks_overnight_after_dinner", "pause_stop_touch", "pause_stop_questions", "needs_one_hour_alone", "retalk_self_initiates", "waits_other_retalk", "wants_less_touch", "ask_before_touch", "wants_no_touch_response"]);
const negativeCodes = new Set(["no_overnight_now", "no_sex_now", "overnight_not_consent", "does_not_resume_touch_unprompted", "no_hug_now", "no_hug_handhold_without_check"]);
const ownerDesireCodes = new Set(["wants_evening_together", "wants_walk_together", "wants_rest_separately", "wants_overnight", "wants_leave_when_tired", "wants_end_time", "wants_less_touch"]);
const proposalCodes = new Set(["wants_evening_together", "wants_walk_together", "wants_rest_separately", "wants_overnight", "no_overnight_now", "wants_leave_when_tired", "wants_end_time", "asks_overnight_after_dinner", "needs_one_hour_alone", "retalk_self_initiates", "waits_other_retalk", "wants_less_touch", "ask_before_touch"]);
const decisionKey = (code: string) => {
  if (["retalk_self_initiates", "waits_other_retalk"].includes(code)) return "retalk-initiator";
  if (["wants_leave_when_tired", "stops_if_other_leaves"].includes(code)) return "leave-response";
  if (["wants_overnight", "no_overnight_now"].includes(code)) return "overnight-choice";
  if (["ask_before_touch", "no_hug_handhold_without_check"].includes(code)) return "touch-ask";
  return code;
};

export function validateFactLedger(value: unknown, input: RoomReportInput): FactLedger {
  const ledger = Ledger.parse(value);
  requireValid(ledger.scenarioId === input.scenarioId, "ledger-scenario");
  if (ledger.status !== "ready") return ledger;
  if (ledger.facts.some(fact => fact.code === "other")) return insufficientLedger(input.scenarioId);
  const facts = new Map<string, FactRecord>();
  const signatures = new Set<string>();
  for (const fact of ledger.facts) {
    requireValid(!facts.has(fact.id), "duplicate-fact-id");
    const [side, field] = fact.answerId.split(".") as ["A" | "B", keyof RoomReportInput["answers"]["A"]];
    requireValid(side === fact.owner, "fact-owner");
    const answer = input.answers[side][field];
    requireValid(Boolean(answer && answer.includes(fact.sourceSpan)), "fact-source-span");
    const entry = codes.get(fact.code);
    requireValid(entry && entry.allowedScopes.includes(fact.scope), "fact-code-scope");
    const offset = answer!.indexOf(fact.sourceSpan);
    const before = answer!.slice(Math.max(0, offset - 5), offset);
    const clause = answer!.slice(Math.max(answer!.lastIndexOf("。", offset - 1), answer!.lastIndexOf("；", offset - 1), answer!.lastIndexOf("，", offset - 1)) + 1, offset + fact.sourceSpan.length);
    if (!["wants_no_touch_response", "stops_if_other_leaves", "waits_other_retalk"].includes(fact.code)
      && /(?:对方|另一方|你|他|她)(?:说|表示|认为)/u.test(clause)) return insufficientLedger(input.scenarioId);
    if ((negativeCodes.has(fact.code) || fact.code === "handholding_undecided")
      && (/(?:不是|并非|没有说|不代表).{0,8}(?:不想|不愿|不把|不会|不确定|没想好)/u.test(clause)
        || (fact.scope === "current" && /(?:如果|假如|将来|以后|等到).{0,30}(?:不想|不愿|不确定|没想好)/u.test(clause)))) {
      return insufficientLedger(input.scenarioId);
    }
    if (positiveCodes.has(fact.code) && (/(?:不|没|未|别|对方|另一方|你|他|她)[^。；，]{0,3}$/u.test(before)
      || /(?:不觉得|不认为|不需要|不必|无需|没必要|不赞成).{0,30}$/u.test(clause.slice(0, -fact.sourceSpan.length))
      || (ownerDesireCodes.has(fact.code) && /(?:对方|另一方|你|他|她).{0,2}(?:想|希望|愿意)/u.test(clause))
      || (fact.scope === "current" && /(?:如果|假如|将来|以后|等到).{0,30}(?:想|希望|愿意|可以|会)/u.test(clause)))) {
      return insufficientLedger(input.scenarioId);
    }
    requireValid(sourceSupports(fact.code, fact.sourceSpan, answer!, fact.scope), `fact-source-meaning:${fact.code}`);
    const signature = `${fact.owner}:${fact.code}:${fact.scope}:${fact.answerId}:${fact.sourceSpan}`;
    requireValid(!signatures.has(signature), "duplicate-fact");
    signatures.add(signature);
    facts.set(fact.id, fact);
  }
  const relations = new Set<string>();
  let hasSharedOrCompatible = false;
  for (const relation of ledger.relations) {
    requireValid(!relations.has(relation.id), "duplicate-relation-id");
    relations.add(relation.id);
    const left = facts.get(relation.factIds[0]);
    const right = facts.get(relation.factIds[1]);
    requireValid(left && right && left.owner !== right.owner, "relation-sides");
    const leftCode = codes.get(left.code)!;
    const rightCode = codes.get(right.code)!;
    requireValid(leftCode.topic === relation.topic && rightCode.topic === relation.topic, "relation-topic");
    if (relation.kind === "shared") {
      requireValid(left.code === right.code && "sharedDisplay" in leftCode && typeof leftCode.sharedDisplay === "string", "relation-shared-code");
      const reciprocal = catalog.sharedScopePairs.some(pair => pair.code === left.code
        && pair.scopes.includes(left.scope) && pair.scopes.includes(right.scope));
      requireValid(left.scope === right.scope || reciprocal, "relation-shared-scope");
      hasSharedOrCompatible = true;
    } else if (relation.kind === "compatible") {
      requireValid(compatible(left.code, right.code), "relation-compatibility");
      hasSharedOrCompatible = true;
    } else {
      requireValid(left.code !== right.code && !compatible(left.code, right.code), "relation-difference");
    }
  }
  if (!hasSharedOrCompatible) return insufficientLedger(input.scenarioId);
  const opens = new Set<string>();
  for (const item of ledger.openItems) {
    requireValid(!opens.has(item.id), "duplicate-open-id");
    opens.add(item.id);
    if (item.kind === "one_sided_proposal") {
      const fact = facts.get(item.factId);
      requireValid(fact && proposalCodes.has(fact.code) && item.missingSide === other(fact.owner)
        && codes.get(fact.code)?.topic === item.topic, "one-sided-proposal");
      requireValid(!ledger.facts.some(candidate => candidate.owner === item.missingSide
        && decisionKey(candidate.code) === decisionKey(fact.code)), "one-sided-proposal-already-answered");
      const otherAnswers = Object.values(input.answers[item.missingSide]).filter((answer): answer is string => Boolean(answer)).join("；");
      const alreadyAnswered = (fact.code === "retalk_self_initiates" && /等(?:对方|你).{0,10}(?:提出|开启|发起)/u.test(otherAnswers))
        || (fact.code === "waits_other_retalk" && /(?:由我|我会|我来|主动).{0,10}(?:提出|开启|发起).{0,8}(?:再谈|再聊|话题)/u.test(otherAnswers))
        || (fact.code === "stops_if_other_leaves" && /(?:疲惫|累).{0,12}(?:我|自己).{0,8}(?:回家|离开)/u.test(otherAnswers))
        || (fact.code === "ask_before_touch" && /(?:先问我|先询问我|先征求我)/u.test(otherAnswers))
        || (["wants_overnight", "no_overnight_now"].includes(fact.code) && /(?:这次|今晚).{0,8}(?:不想|不要|希望|想).{0,8}(?:留宿|过夜|住下)/u.test(otherAnswers));
      requireValid(!alreadyAnswered, "one-sided-proposal-already-answered");
    } else {
      const left = facts.get(item.factIds[0]);
      const right = facts.get(item.factIds[1]);
      requireValid(left && right && left.owner !== right.owner && item.topic === "overnight"
        && new Set([left.code, right.code]).size === 2
        && [left.code, right.code].every(code => ["wants_overnight", "no_overnight_now"].includes(code)), "unresolved-choice");
    }
  }
  return ledger;
}

export async function validateReportPlan(value: unknown, ledger: ReadyFactLedger): Promise<ReportPlan> {
  const plan = Plan.parse(value);
  requireValid(plan.scenarioId === ledger.scenarioId, "plan-scenario");
  const [ledgerHash, catalogHash, templateHash] = await Promise.all([contentHash(ledger), contentHash(catalog), contentHash(templates)]);
  requireValid(plan.ledgerSha256 === ledgerHash && plan.catalogSha256 === catalogHash && plan.templatesSha256 === templateHash, "plan-hashes");
  const facts = new Map(ledger.facts.map(fact => [fact.id, fact]));
  const relations = new Map(ledger.relations.map(relation => [relation.id, relation]));
  const opens = new Map(ledger.openItems.map(item => [item.id, item]));
  const selected = plan.sections;
  const commonIds = [...selected.commonAndDifferences.sharedOrCompatibleRelationIds, ...selected.commonAndDifferences.differentRelationIds];
  requireValid(new Set(commonIds).size === commonIds.length, "plan-duplicate-common-relation");
  for (const id of selected.commonAndDifferences.sharedOrCompatibleRelationIds) requireValid(["shared", "compatible"].includes(relations.get(id)?.kind ?? ""), "plan-common-kind");
  for (const id of selected.commonAndDifferences.differentRelationIds) requireValid(relations.get(id)?.kind === "different", "plan-difference-kind");
  requireValid(Boolean(selected.commonAndDifferences.differentRelationIds.length) === ledger.relations.some(relation => relation.kind === "different"), "plan-difference-omitted-or-invented");
  const discussionTopics = new Set<string>();
  for (const id of selected.adviceForBoth.discussionRelationIds) {
    const relation = relations.get(id);
    requireValid(relation, "plan-discussion-relation");
    discussionTopics.add(relation.topic);
  }
  requireValid(discussionTopics.size === 1, "plan-discussion-topics");
  for (const code of selected.adviceForBoth.cautionCodes) requireValid(cautions.get(code)?.allowedScenarios.includes(ledger.scenarioId), "plan-caution-scenario");
  for (const code of selected.nextSteps.actionCodes) {
    const action = actions.get(code);
    requireValid(action?.allowedScenarios.includes(ledger.scenarioId), "plan-action-scenario");
    if (action && "requiredSharedCode" in action) requireValid(ledger.relations.some(relation => relation.kind === "shared"
      && facts.get(relation.factIds[0])?.code === action.requiredSharedCode), "plan-action-shared-prerequisite");
    if (action && "requiredTopic" in action) requireValid(ledger.relations.some(relation => relation.topic === action.requiredTopic), "plan-action-topic-prerequisite");
  }
  for (const id of selected.nextSteps.boundaryFactIds) requireValid(catalog.boundaryCodeAllowlist.includes(facts.get(id)?.code ?? ""), "plan-boundary-fact");
  for (const id of selected.nextSteps.openItemIds) requireValid(opens.has(id), "plan-open-item");
  return plan;
}

const INSUFFICIENT_MESSAGE = "目前没有足够的双方信息生成有依据的共同报告。可以各自补充、跳过，或结束本次填写。";
function insufficient(scenarioId: ReadyFactLedger["scenarioId"]): RoomReport {
  return { version: "paired-report-v0.2", scenarioId, status: "insufficient", message: INSUFFICIENT_MESSAGE };
}

export async function renderRoomReport(ledger: ReadyFactLedger, value: unknown): Promise<RoomReport> {
  const plan = await validateReportPlan(value, ledger);
  const facts = new Map(ledger.facts.map(fact => [fact.id, fact]));
  const relations = new Map(ledger.relations.map(relation => [relation.id, relation]));
  const opens = new Map(ledger.openItems.map(item => [item.id, item]));
  const display = (fact: FactRecord) => {
    const value = codes.get(fact.code)?.display;
    requireValid(typeof value === "string", "unrenderable-fact");
    return value.replaceAll("{side}", fact.owner).replaceAll("{other}", other(fact.owner));
  };
  const relationFacts = (relation: RelationRecord) => relation.factIds.map(id => facts.get(id)!).sort((a, b) => a.owner.localeCompare(b.owner));
  const relationText = (relation: RelationRecord) => {
    const [left, right] = relationFacts(relation);
    requireValid(left && right, "missing-relation-facts");
    if (relation.kind === "shared") {
      const shared = codes.get(left.code)?.sharedDisplay;
      requireValid(typeof shared === "string", "missing-shared-display");
      return templates.relationSentences.shared.replace("{sharedDisplay}", shared);
    }
    return templates.relationSentences[relation.kind].replace("{leftDisplay}", display(left)).replace("{rightDisplay}", display(right));
  };
  const evidence = (relationIds: string[], factIds: string[] = []) => Array.from(new Set([
    ...relationIds.flatMap(id => relations.get(id)!.factIds), ...factIds,
  ].map(id => facts.get(id)!.answerId)));
  const selected = plan.sections;
  const commonIds = [...selected.commonAndDifferences.sharedOrCompatibleRelationIds, ...selected.commonAndDifferences.differentRelationIds];
  const common = commonIds.map(id => relationText(relations.get(id)!)).join("")
    + (selected.commonAndDifferences.differentRelationIds.length ? "" : templates.noDifferenceSentence);
  const discussionIds = selected.adviceForBoth.discussionRelationIds;
  const discussionTopic = relations.get(discussionIds[0]!)!.topic;
  const advice = (selected.commonAndDifferences.differentRelationIds.length
    ? templates.discussionIntroByTopic[discussionTopic] : templates.noDifferenceAdviceIntro)
    + selected.adviceForBoth.cautionCodes.map(code => cautions.get(code)!.text).join("");
  const adviceSupport = selected.adviceForBoth.cautionCodes.includes("respect_stop")
    ? ledger.relations.find(relation => relation.kind === "shared" && facts.get(relation.factIds[0])?.code === "pause_stop_touch")?.id : undefined;
  const actionSupport: string[] = [];
  const actionTexts = selected.nextSteps.actionCodes.map(code => {
    const action = actions.get(code)!;
    const needed = "requiredSharedCode" in action
      ? ledger.relations.find(relation => relation.kind === "shared" && facts.get(relation.factIds[0])?.code === action.requiredSharedCode)
      : ledger.relations.find(relation => "requiredTopic" in action && relation.topic === action.requiredTopic);
    requireValid(needed, "action-evidence");
    actionSupport.push(needed.id);
    return action.text;
  }).join("");
  const boundaryIds = selected.nextSteps.boundaryFactIds;
  const boundaryTexts = boundaryIds.map(id => templates.boundarySentence.replace("{factDisplay}", display(facts.get(id)!))).join("");
  const openFactIds: string[] = [];
  const openTexts = selected.nextSteps.openItemIds.map(id => {
    const item = opens.get(id)!;
    if (item.kind === "one_sided_proposal") {
      openFactIds.push(item.factId);
      return templates.oneSidedOpenSentence.replace("{factDisplay}", display(facts.get(item.factId)!)).replace("{missingSide}", item.missingSide);
    }
    const [left, right] = item.factIds.map(factId => facts.get(factId)!).sort((a, b) => a.owner.localeCompare(b.owner));
    requireValid(left && right, "open-facts");
    openFactIds.push(left.id, right.id);
    return templates.unresolvedChoiceSentence.replace("{leftDisplay}", display(left)).replace("{rightDisplay}", display(right));
  }).join("") || templates.noOpenFallback;
  const nextSteps = actionTexts + boundaryTexts + openTexts;
  if ([common, advice, nextSteps].some(text => text.length < 20 || text.length > 220 || /\n/u.test(text))
    || common.length + advice.length + nextSteps.length > 660) return insufficient(ledger.scenarioId);
  return RoomReportSchema.parse({
    version: "paired-report-v0.2", scenarioId: ledger.scenarioId, status: "ready",
    sections: {
      commonAndDifferences: { text: common, evidence: evidence(commonIds) },
      adviceForBoth: { text: advice, evidence: evidence([...discussionIds, ...(adviceSupport ? [adviceSupport] : [])]) },
      nextSteps: { text: nextSteps, evidence: evidence(actionSupport, [...boundaryIds, ...openFactIds]) },
    },
  });
}
