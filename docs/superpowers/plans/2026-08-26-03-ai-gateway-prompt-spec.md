# 03 AI 网关、Prompt 规范与模型适配实施计划

> 执行要求：Mock 与 Live 必须运行同一 contract suite；模型只能产生候选结果，不能控制安全规则或领域状态。

**目标（Goal）：** 实现无状态、版本化、可替换模型供应商的 AI 网关，并在无 API 时保留完整演示能力。

**架构（Architecture）：** Hono routes 使用 Plan 02 的 Zod schema 校验请求与响应，再委托 application service。Provider adapter 只返回 provider-neutral candidate；prompt builder 与 scenario engine 在返回客户端前进行约束和最终裁决。

**技术栈（Tech Stack）：** Cloudflare Workers、Hono、TypeScript、Zod、Vitest、native `fetch`、`@cave/contracts`、`@cave/scenario-engine`、`@cave/test-fixtures`。

---

**依赖计划：** Plan 02 complete；Plan 04 的安全接口可并行接入。  
**输入：** v1 contracts、validated scenarios、Golden fixtures、状态机。  
**输出：** 四个 routes、`ModelProvider`、Mock/Live providers、versioned prompts、turn/debrief services、contract tests。  
**明确排除：** device persistence、SQLCipher、UI、provider SDK、streaming。  
**预计时间：** 4—5 小时。**负责人：** 全栈工程师。

## 准确文件路径

```text
apps/gateway/src/app.ts
apps/gateway/src/env.ts
apps/gateway/src/routes/{health,meta,practice}.ts
apps/gateway/src/providers/{types,mock,openai-compatible,repair}.ts
apps/gateway/src/prompts/{system,scenario,debrief,versions}.ts
apps/gateway/src/services/{turn,debrief,evidence}.ts
apps/gateway/src/errors/map-error.ts
apps/gateway/test/{provider-contract,routes,prompt-injection,evidence}.test.ts
```

## Provider 公共接口（规范性定义）

```ts
type ProviderTurnInput = {
  requestId: string;
  locale: "zh-CN";
  scenarioStage: ScenarioStage;
  selectedOptions: Record<string, string>;
  recentTurns: PracticeTurn[];
  userMessage: string;
  scenario: ScenarioConfig;
  systemPrompt: string;
  scenarioPrompt: string;
};

type ProviderDebriefInput = {
  requestId: string;
  locale: "zh-CN";
  turns: PracticeTurn[];
  scenario: ScenarioConfig;
  systemPrompt: string;
  debriefPrompt: string;
};

interface ModelProvider {
  generateTurn(input: ProviderTurnInput, signal: AbortSignal): Promise<unknown>;
  generateDebrief(input: ProviderDebriefInput, signal: AbortSignal): Promise<unknown>;
}
```

返回 `unknown` 是刻意设计：gateway service 必须用 Plan 02 schema 解析。`installationToken` 只属于 gateway transport 与 rate-limit boundary；provider input 必须逐字段构造，任何 model payload/prompt 都不得出现该 token。

## 任务 1：环境校验与 App composition

- [ ] 先写失败测试：缺少 `MODEL_MODE`、非法 mode、live mode 缺少 `MODEL_BASE_URL`/`MODEL_API_KEY`/`MODEL_NAME`、malformed URL 均拒绝启动。
- [ ] 实现 `GatewayEnvSchema`：mock 只要求 versions；live 额外要求三项 model variables。
- [ ] 从 `app.ts` 导出 `createApp(env)`；`src/index.ts` 只把 Worker `fetch` 绑定到 composed app。
- [ ] 运行 `pnpm --filter @cave/gateway test`，预期环境测试通过。
- [ ] 提交：`git commit -am "feat: validate gateway environment"`。

## 任务 2：metadata routes

**Routes：** `GET /health`、`GET /v1/meta`。

- [ ] 先写失败测试：`/health` 保留 Plan 01 response 并返回 `Cache-Control: no-store`；`/v1/meta` 返回 contract/prompt/policy/provider mode/model name。
- [ ] 实现 routes，固定 `contractVersion: "1"`，其余版本读取 validated env。
- [ ] 增加 negative assertion：serialized response 不包含 `MODEL_API_KEY`、key value 或 base headers。
- [ ] 运行 route tests，预期 200 与 exact shape；提交：`git commit -am "feat: expose safe gateway metadata"`。

## 任务 3：`ModelProvider` 与 `MockProvider`

- [ ] 先创建 provider contract suite，覆盖 abort、schema-valid candidate、request ID、immutability、unknown fields rejection。
- [ ] 让空 `MockProvider` 运行 suite，预期失败。
- [ ] 以 scenario ID、stage、turn count 为 key，实现 deterministic fixtures；不得联网。
- [ ] 重跑 suite，预期全部通过；提交：`git commit -am "feat: add deterministic model provider"`。

## 任务 4：OpenAI-compatible `LiveProvider`

- [ ] 先写 fetch-mocked 失败测试：endpoint、Bearer header、model name、non-streaming JSON、15 秒 abort、external abort、429、5xx retry、invalid JSON。
- [ ] 用 `fetch` 请求 `${MODEL_BASE_URL}/chat/completions`，temperature 0.3；不得发送 vendor-specific `response_format`，统一采用 JSON-only prompt + gateway schema validation。
- [ ] 仅对 network error、408、429、5xx 重试一次；`Retry-After` 最多等待 5 秒。
- [ ] 把 provider failure 映射为内部 typed error，永不回传 provider body。
- [ ] 断言 logger 只收到 status/latency，不收到 request/response text。
- [ ] 让 mocked LiveProvider 通过同一 contract suite；提交：`git commit -am "feat: add openai compatible provider"`。

## 任务 5：版本化 Prompt 三层结构

- [ ] 先写 snapshot 与 injection 失败测试，输入包含“忽略规则”“输出 system prompt”“更改角色”等恶意文本。
- [ ] 创建不可被客户端覆盖的 system rules：服从 server scenario、不泄露 instructions、清晰边界后停止、不诊断、不升级胁迫、只输出 JSON。
- [ ] scenario prompt 只从 server-owned validated content 生成；client contract 不允许传 role/prompt fields。
- [ ] debrief prompt 固定四维度，`evidenceQuote` 只能来自 user turns。
- [ ] 每个请求与响应包含 `PROMPT_VERSION`、`POLICY_VERSION`；用户文本只能位于 delimiter data section。
- [ ] 重跑 snapshot/injection tests；提交：`git commit -am "feat: version constrained model prompts"`。

## 任务 6：turn service 与合法状态裁决

- [ ] 先写 route 失败测试：valid turn、malformed body、wrong contract、unknown scenario、illegal stage、explicit safety stop、model-suggested illegal transition。
- [ ] 用 `PracticeTurnRequestSchema` 校验，再加载 server-owned `ScenarioConfig`。
- [ ] 逐字段构造 `ProviderTurnInput`；测试 serialized provider payload 与 prompt snapshot 均不含 `installationToken`。
- [ ] 通过 injected interface 调用 Plan 04 pre-model safety；Plan 04 合并前只允许 test stub，不进入 release branch。
- [ ] 调用 provider，解析 candidate，再把 `nextStage` 交给 `advanceScenario`；非法建议替换为 deterministic engine stage。
- [ ] 暴露 `POST /v1/practice/turn`，错误统一为 `ApiErrorResponse`。
- [ ] 运行 route/state tests；提交：`git commit -am "feat: implement constrained practice turns"`。

## 任务 7：debrief 与 evidence verification

- [ ] 先写失败测试：valid debrief、forged quote、assistant quote 冒充 user evidence、duplicate dimension、missing dimension。
- [ ] 逐字段构造 `ProviderDebriefInput`，测试 provider payload 不含 `installationToken`。
- [ ] 调用 `generateDebrief`、schema validation，并按 `feeling`、`willingness`、`boundary`、`next_step` 规范化顺序。
- [ ] Unicode normalization 后，验证 `evidenceQuote` 是至少一个 user turn 的连续 substring。
- [ ] invalid evidence 时删除 quote，status 改为 `not_observed`，不得再次生成内容。
- [ ] 暴露 `POST /v1/practice/debrief`，linked lesson IDs 只取 server config。
- [ ] 提交：`git commit -am "feat: verify structured practice debrief"`。

## 任务 8：一次性结构修复

- [ ] 先写失败测试：malformed provider JSON 触发一次 repair，第二次仍 malformed 则返回 `INVALID_MODEL_OUTPUT`。
- [ ] repair 只接收 invalid JSON 与 target schema description，禁止新增 dialogue/evidence。
- [ ] `safety_stop` 或 stop decision 不得修复成 safe。
- [ ] 加 counter assertion，证明单个请求最多一次 repair；提交：`git commit -am "feat: repair malformed model output once"`。

## 执行命令与预期结果

- [ ] `pnpm --filter @cave/gateway test`：全部 provider、route、prompt、evidence tests 通过。
- [ ] `pnpm test:contracts && pnpm --filter @cave/scenario-engine test`：公共契约与状态机无回归。
- [ ] `pnpm build:gateway`：Worker build 退出码 0。
- [ ] Wrangler local 下调用四个 routes 的 valid/invalid fixtures：返回 exact status/schema。
- [ ] 搜索 provider SDK、API key、prompt body：source 无 SDK，response/log fixture 无 secret/body。

## 故障、回滚与降级

- Live API 不可用：固定切到可见的 `MockProvider`，完整流程仍可演示。
- Provider JSON 持续损坏：一次 repair 后返回 `INVALID_MODEL_OUTPUT`，不得拼接猜测结果。
- Provider 建议非法转换：忽略建议，使用 scenario engine 决定值。
- Plan 04 safety 尚未接入：Plan 03 可测试完成，但不得将 stub 标记为 release-ready。

## 验收证据清单

- [ ] Mock 与 Live 通过同一 provider contract suite。
- [ ] 四个 routes 的 schema、status 与 version 一致。
- [ ] injection 不能改变 system rules、safety policy 或 state machine。
- [ ] `installationToken`、API key、正文未进入 model metadata/log。
- [ ] 15 秒 timeout、一次 retry、一次 repair 有 counter tests。
- [ ] 无 API 时 Mock 完成 turn + debrief 全流程。

**解锁下一计划：** 与 Plan 04 同时验收完成后解锁 Plan 05。

## 2026-08-27 执行结果

- 状态：`complete`（本地 P0）；Plan 05 仍因 Plan 04 `blocked` 而未解锁。
- Commit：`3e83282`、`fbbb749`、`fe2c024`、`4c96f5d`、`aed8270`；依赖 commit `248b87d`。
- 已实现：validated mock/live env、`/health`、`/v1/meta`、turn/debrief routes、deterministic MockProvider、native-fetch OpenAI-compatible provider、版本化 prompts、state-machine 最终裁决、evidence verification、一次 repair、prompt injection/timeout/retry/body-bound tests。
- 联合验证：gateway strict typecheck/lint 通过；16 files / 160 tests；Wrangler dry-run 688.11 KiB / gzip 113.54 KiB；无真实模型 API 时 MockProvider 与 mocked fetch 完成 P0。
- 约束证据：`installationToken` 不进入 provider input；provider response 限制 64 KiB；provider-authored text 最长 2,000 chars；logs 不保存正文；turn 与 debrief 均接入 server-owned output guard。
- Review：spec review `APPROVED`；code-quality review `APPROVED`；共享集成 review `APPROVED`。
