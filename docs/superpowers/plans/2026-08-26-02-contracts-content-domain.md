# 02 共享契约、内容包与领域引擎实施计划

> 执行要求：契约先于消费者实现；每项能力都按“失败测试 → 最小实现 → 通过测试 → commit”推进。

**目标（Goal）：** 建立内容、API、error code、安全结果与情境状态转换的唯一事实来源。

**架构（Architecture）：** `@cave/contracts` 用 Zod 同时提供 runtime validation 与 inferred TypeScript types；`@cave/content` 校验版本化 JSON；`@cave/scenario-engine` 以 provider-independent pure state machine 决定合法转换与结束条件；`@cave/test-fixtures` 提供 Mock/Golden fixtures。

**技术栈（Tech Stack）：** TypeScript、Zod、Vitest、JSON fixtures、pnpm workspace。

---

**依赖计划：** Plan 01 complete。  
**输入：** 四个共享 Package 外壳、内容队友提供的课程/场景草稿和来源 metadata。  
**输出：** frozen v1 public contracts、validated content package、deterministic state engine、Mock/Golden fixtures。  
**明确排除：** HTTP routes、model prompts、React Native UI、persistence。  
**预计时间：** 3—4 小时。**负责人：** 工程师；内容队友审核 fixtures 与来源。

## 准确文件路径

```text
packages/contracts/src/{content,practice,safety,errors,index}.ts
packages/contracts/src/*.test.ts
packages/content/src/{catalog,load,validate,index}.ts
packages/content/data/{courses,lessons,quizzes,scenarios,guide}.json
packages/content/src/validate.test.ts
packages/scenario-engine/src/{machine,reducer,index}.ts
packages/scenario-engine/src/machine.test.ts
packages/test-fixtures/src/{practice,golden,invalid,index}.ts
```

## v1 公共契约（规范性定义）

消费者必须从 `@cave/contracts` 导入这些类型，不得新增字段或声明副本。

```ts
type ReviewStatus = "draft" | "reviewed";
type ScenarioStage =
  | "setup" | "opening" | "response" | "clarification"
  | "resolution" | "debrief" | "safety_stop";

type LessonBlock =
  | { id: string; kind: "text"; body: string }
  | { id: string; kind: "image"; assetId: string; alt: string }
  | { id: string; kind: "callout"; tone: "info" | "caution"; body: string };

type Course = {
  id: string; version: number; title: string; moduleIds: string[];
  reviewStatus: ReviewStatus; reviewedAt?: string; sourceRefs: string[];
};

type Lesson = {
  id: string; version: number; courseId: string; order: number; title: string;
  blocks: LessonBlock[]; quizIds: string[]; linkedScenarioIds: string[];
  reviewStatus: ReviewStatus; reviewedAt?: string; sourceRefs: string[];
};

type QuizQuestion = {
  id: string; lessonId: string; prompt: string;
  options: Array<{ id: string; text: string; isCorrect: boolean; feedback: string }>;
};

type StopRuleCode =
  | "explicit_exit" | "max_turns" | "clear_boundary"
  | "danger" | "violence" | "self_harm" | "medical_emergency" | "minor";
type StopRule = { code: StopRuleCode; terminalStage: "resolution" | "safety_stop" };
type DebriefKey = "feeling" | "willingness" | "boundary" | "next_step";
type DebriefRubric = { dimensions: DebriefKey[] };

type ScenarioConfig = {
  id: string; version: number; title: string; allowedStages: ScenarioStage[];
  maxTurns: number; learningObjectives: string[]; allowedPressureLevel: 0 | 1;
  stopRules: StopRule[]; debriefRubric: DebriefRubric; linkedLessonIds: string[];
  reviewStatus: ReviewStatus; reviewedAt?: string; sourceRefs: string[];
};

type PracticeTurn = { role: "user" | "assistant"; text: string };
type SafetyDecision = {
  level: "safe" | "stop";
  reasonCode: "none" | StopRuleCode | "policy_violation" | "uncertain";
  resourceCategory?: "emergency" | "violence" | "self_harm" | "medical" | "minor";
};

type PracticeTurnRequest = {
  contractVersion: "1"; requestId: string; installationToken: string; locale: "zh-CN";
  scenarioId: string; scenarioVersion: number; scenarioStage: ScenarioStage;
  selectedOptions: Record<string, string>; recentTurns: PracticeTurn[]; userMessage: string;
};

type PracticeTurnResponse = {
  contractVersion: "1"; requestId: string; roleMessage: string;
  nextStage: ScenarioStage; shouldEnd: boolean; safety: SafetyDecision;
  promptVersion: string; policyVersion: string;
};

type DebriefDimension = {
  key: DebriefKey; status: "expressed" | "could_be_clearer" | "not_observed";
  evidenceQuote?: string; explanation: string; optionalAlternative?: string;
};
type ExpressionCard = {
  feeling?: string; willingness?: string; boundary?: string; nextStep?: string;
};
type DebriefRequest = {
  contractVersion: "1"; requestId: string; installationToken: string; locale: "zh-CN";
  scenarioId: string; scenarioVersion: number; turns: PracticeTurn[];
};
type DebriefResponse = {
  contractVersion: "1"; requestId: string; dimensions: DebriefDimension[];
  expressionCard: ExpressionCard; linkedLessonIds: string[];
  promptVersion: string; policyVersion: string;
};

type ApiErrorCode =
  | "INVALID_REQUEST" | "CONTRACT_MISMATCH" | "RATE_LIMITED"
  | "MODEL_TIMEOUT" | "MODEL_UNAVAILABLE" | "UNSAFE_CONTEXT"
  | "INVALID_MODEL_OUTPUT" | "INTERNAL_ERROR";
type ApiErrorResponse = {
  contractVersion: "1"; requestId: string; code: ApiErrorCode;
  messageKey: string; retryAfterSeconds?: number;
};
```

## 任务 1：内容契约

- [ ] 先写失败测试：合法 `Course`、`Lesson`、`QuizQuestion`、`ScenarioConfig` 可解析，unknown fields 与缺失字段被拒绝。
- [ ] 运行 `pnpm test:contracts`，预期因 schema 未实现而失败。
- [ ] 创建 strict Zod schemas：ID 为 kebab-case、version 为正整数、`maxTurns` 为 1—8、`allowedPressureLevel` 只能为 0/1，并导出 inferred types。
- [ ] 重跑 `pnpm test:contracts`，预期合法 fixtures 通过、非法 fixtures 失败。
- [ ] 提交：`git commit -am "feat: define content contracts"`。

## 任务 2：练习、安全与错误契约

- [ ] 先写失败测试：`contractVersion: "1"`、`locale: "zh-CN"`、`userMessage` 上限 500 字符、`recentTurns` 最多八轮、response 拒绝 extra fields。
- [ ] 写 refinement：`level: safe` 必须对应 `reasonCode: none`；`level: stop` 禁止 `none`；`evidenceQuote` 存在时不能为空。
- [ ] 实现本文件中的 `PracticeTurnRequest/Response`、`DebriefRequest/Response`、`SafetyDecision`、`ApiErrorResponse`。
- [ ] 运行 `pnpm test:contracts`，预期所有 boundary cases 通过。
- [ ] 提交：`git commit -am "feat: define practice and safety contracts"`。

## 任务 3：版本化内容与引用校验

- [ ] 创建最小 reviewed catalog：唯一 course ID 精确为 `cave-basics`；完整 lesson 的 `courseId` 必须反向引用 `cave-basics`；另含两个 quiz items、一个完整 scenario、两个 preview scenarios、guide category metadata。
- [ ] 先写失败测试：missing linked lesson、duplicate order、duplicate ID、production 中出现 `draft`、unsupported stage、`maxTurns > 8`。
- [ ] 实现 `load.ts` 与 `validate.ts`，检查 ID 引用、version、review status、course order、scenario rounds、lesson/scenario 双向关系和 source refs。
- [ ] 添加 `validate:content` script，并让生产校验只接受 `reviewed` 且带 `reviewedAt` 的内容。
- [ ] 运行 `pnpm validate:content`，预期错误 fixture 非零退出，正式数据零退出。
- [ ] 提交：`git commit -am "feat: validate versioned learning content"`。

## 任务 4：确定性情境状态机

- [ ] 先写 table-driven 失败测试：initial stage、合法转换、非法倒退、`maxTurns`、`explicit_exit`、`clear_boundary` 与所有 `safety_stop` codes。
- [ ] 定义 pure function `advanceScenario(config, state, event): ScenarioState`；禁止依赖 React Native、HTTP、storage 或 provider。
- [ ] 明确模型只提交候选 `nextStage`；状态机根据 config、turn count、stop rules 与 safety result 做最终裁决。
- [ ] 让 terminal state idempotent，进入 `resolution` 或 `safety_stop` 后不能恢复普通角色扮演。
- [ ] 运行 `pnpm --filter @cave/scenario-engine test`，预期全通过。
- [ ] 提交：`git commit -am "feat: add deterministic scenario engine"`。

## 任务 5：Mock 与 Golden fixtures

- [ ] 定义 fixture export：`validPracticeRequest`、`mockTurnSequence`、`validDebrief`、`invalidContractCases`、`goldenSafetyCases`。
- [ ] Golden conversation 每条包含 `id`、`scenarioId`、`turns`、`expectedSafety`、`expectedFinalStage`、`expectedDebriefKeys`；不保存真实个人数据。
- [ ] 先写消费测试，用纯领域流程完整跑完 learn → practice → debrief；预期 fixtures 缺失时失败。
- [ ] 补齐 `@cave/test-fixtures` fixtures；运行 `pnpm test:contracts && pnpm test:content && pnpm --filter @cave/scenario-engine test`，预期通过且无网络访问。
- [ ] 由内容队友签署 Golden outcome；提交：`git commit -am "test: add domain and golden fixtures"`。

## 任务 6：冻结 v1 公共表面

- [ ] 在 `packages/contracts/src/index.ts` 只导出本文件列出的 schemas/types。
- [ ] 先写 compile-time consumer test，证明 mobile/gateway 只能从公共入口导入；deep import 应失败。
- [ ] 运行 `pnpm typecheck && pnpm test:contracts && pnpm validate:content`，预期退出码为 0。
- [ ] 在总索引登记 contract version、export inventory、测试输出和 commit。
- [ ] 提交：`git commit -am "chore: freeze version one contracts"`。

## 故障、回滚与降级

- 内容审核未完成：P0 只保留一个完整 reviewed scenario，其余不进入 production catalog。
- 引用校验失败：拒绝构建，不允许运行时忽略坏引用。
- 新需求要求改契约：先走总索引变更流程并升级 tests；消费者不得自行扩展。
- 状态机与内容配置冲突：以状态机安全终止为准，移除冲突 fixture 后重新审核。

## 验收证据清单

- [ ] v1 schemas 与本文件一致，消费者无重复类型。
- [ ] `pnpm test:contracts`、`pnpm validate:content`、scenario-engine tests 全通过。
- [ ] invalid references、draft production content 与 illegal transitions 均被拒绝。
- [ ] Mock fixtures 可驱动一次完整无 UI、无网络领域流程。
- [ ] 内容队友已记录 Golden set 审核结论。

**解锁下一计划：** 完成后同时解锁 Plan 03 与 Plan 04。
