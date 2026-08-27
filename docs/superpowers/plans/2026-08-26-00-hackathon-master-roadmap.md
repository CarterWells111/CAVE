# 00 四天黑客松总路线图

> 本文件是 01—08 的唯一总索引与变更入口。执行单份计划时逐项勾选，并把命令、产物和 commit 证据回填到本文件。

**目标（Goal）：** 用一个共享的 Expo/Worker 产品完成五个批次，以本地优先的八页引导旅程作为黑客松主演示，并从同一套代码生成萨福与 Eazo 两种提交叙事。

**架构（Architecture）：** pnpm workspace 包含 Expo 移动端、无状态 Cloudflare Worker 网关，以及共享契约、内容与领域 Package。客户端 local-first；成年确认后的八页草稿自动保存到本地加密数据库，沟通卡只在用户明确操作后保存。独立 AI 模块的原始 transcript 默认只在内存存在，网关永不保存会话正文。

**技术栈（Tech Stack）：** TypeScript、Node 22、pnpm 10、Expo SDK 57、Expo Router、Cloudflare Workers、Hono、Zod、SQLCipher SQLite、SecureStore、Vitest/Jest、Maestro、EAS Build/Update。

## 不可随意修改的决策

| 决策 | 固定值 |
|---|---|
| 产品品牌 | `内界 CAVE` |
| GitHub Repository | `https://github.com/CarterWells111/CAVE` |
| 仓库结构 | pnpm workspace；不使用 Nx/Turborepo |
| Expo owner/project | `carter_wells/cave` |
| Expo slug | `cave` |
| URL scheme | `cave` |
| Package scope | `@cave/*` |
| 移动端路径 | `apps/mobile` |
| 网关路径 | `apps/gateway` |
| iOS Bundle ID | `com.neijie.cave` |
| Android package | 本轮不配置；启用 Android 前另走固定决策变更 |
| Worker name | `neijie-cave-gateway` |
| 主验收 | 使用 Apple Developer 凭证的真实 iPhone |
| Android 验收 | 延期；仅在未来独立固定决策获批并配置 Android package 后定义与执行 |
| 模型协议 | 通过原生 `fetch` 调用 OpenAI-compatible HTTP |
| AI 输出 | non-streaming structured JSON |
| AI 限时 | 15 秒；一次网络重试；一次结构修复 |
| 黑客松主演示 | 本地离线八页引导旅程；Page 6 为明确标识的预设对话 |
| 八页 AI 边界 | Page 1—8 不调用 Worker/模型；Page 7—8 使用确定性本地规则 |
| 八页状态所有权 | `JourneyDraft` 是 mobile-private v1，不加入 `@cave/contracts` |
| 结果表达 | 不生成准备度分数、百分比或自动决定 |
| 云端保存 | MVP 固定 `coming-soon` 且不可选择；本机加密保存为唯一可选方式 |
| 积分规则 | 只奖励学习、练习、自我观察与回顾；不读取开放程度、隐私文字或长度 |
| 数据默认值 | 八页草稿本地加密自动保存；沟通卡显式保存；AI transcript 仅内存存在 |
| 加密持久化 | SQLCipher；key 存入 SecureStore |
| 发布目标 | EAS preview build + Cloudflare Worker |
| 双命题 | 单一构建；只分离 `submissions/sappho` 与 `submissions/eazo` 素材 |

若要改变任何固定决策，必须先修改本文件；涉及共享契约时再修改 Plan 02；最后修改所有消费者计划与测试。

## 五批次依赖图

```text
01 Repository/Infrastructure
        |
02 Contracts/Content/Domain
       / \
03 AI Gateway   04 Security/Privacy
       \ /              |
      05A Framework ----|
              |
      05B Basic Functions
        |
06 Product Completion
        |
07 Quality/Performance
        |
08 Release/Submissions
```

Plan 03 与 Plan 04 可在 Plan 02 完成后并行。八页 MVP 不消费 Plan 03 运行时接口；05A/05B 只要求 Plan 04 的本地加密存储与删除能力通过，因此 Plan 04 的 Golden evaluator 和 Apple 真机证据可并行关闭，但必须在 Plan 07 前完成。其余为顺序验收门槛，依赖图无循环。

## 计划登记表

| ID | 文件 | 负责人 | 工时 | 解锁条件 | 状态 | 输入 | 输出 | 验收证据 | Git commit |
|---|---|---|---:|---|---|---|---|---|---|
| 01 | `2026-08-26-01-repository-infrastructure-ios-build.md` | Engineer | 4h | 无 | `blocked` | 空仓库、账号、iPhone | workspace、CI、dev build、`/health` | Gate 01A `pass`；Gate 01B `external_pending` | `17554bb`, `44a3609`, `f547cad`, `b21d9d8`, `03c1808`, `1fb7b44` |
| 02 | `2026-08-26-02-contracts-content-domain.md` | Engineer + Content | 3-4h | Gate 01A pass | `complete` | Package shells、内容草稿 | v1 contracts、内容校验、状态机 | Gate 02A `pass`；Gate 02B `pass` | `9d48b68`, `73d28d2`, `a51a8a1`, `05ce733`, `ca6586b`, `cc1495e`, `32123c5`, `a1c03e8` |
| 03 | `2026-08-26-03-ai-gateway-prompt-spec.md` | Engineer | 4-5h | 02 complete | `complete` | v1 contracts、scenario fixtures | routes、providers、prompts | local provider/route/prompt/evidence suites `pass`；live API credential not required for P0 | `3e83282`, `fbbb749`, `fe2c024`, `4c96f5d`, `aed8270` |
| 04 | `2026-08-26-04-security-privacy-code-hardening.md` | Engineer + Content | 4h | 02 complete | `blocked` | v1 safety/storage shapes | encrypted repo、安全策略、CI security | local storage/guard/log/bundle checks `pass`；Golden evaluator integration `blocked`；native checks `external_pending` | `dc90739`, `6f642c9`, `3c875c1`, `dbc085e`, `371c905` |
| 05 | `2026-08-26-05-mobile-mvp-integration.md` | Engineer | 6-7h | 02 complete；04 local storage pass | `in_progress` | 八页设计、安全存储、local content | 八页本地端到端闭环 | 05A/05B local core pass；production composition pending；05C pending | `43afb05`…`d8fd1be` |
| 05A | `2026-08-27-05a-eight-page-mvp-framework.md` | Engineer | 2.5-3h | 02 complete；04 local storage pass | `in_progress` | storage/content 基线 | routes、draft、repository、同步框架 | mobile 25 suites / 106 tests；core pass；route composition/guard consumption pending | `43afb05`, `37581ca`, `62de80f`, `54e2be7`, `995400a`, `3b5750c`, `d76f7a8`, `0d86225` |
| 05B | `2026-08-27-05b-eight-page-mvp-functions.md` | Engineer + Content | 3.5-4h | 05A core interfaces | `in_progress` | 冻结接口、local catalogs | 八页基础功能、预设练习、卡片 | local harness/offline pass；production routes/native adapters pending | `12a83be`, `3e28838`, `7420113`, `407b979`, `14c029c`, `186752b`, `cd98348`, `d8fd1be` |
| 06 | `2026-08-26-06-product-completion-ux.md` | Both | 5h | Gate 05B pass | `not_started` | 可运行八页闭环、最终内容 | 完整 UI、医学图示、可访问性、披露 | state/accessibility matrix | 执行后填写 |
| 07 | `2026-08-26-07-quality-performance-demo-hardening.md` | Both | 3-4h | 06、Gate 01B、Plan 04 final Gate complete | `not_started` | feature-frozen build | RC、三轮彩排 | test/rehearsal matrix | 执行后填写 |
| 08 | `2026-08-26-08-release-demo-submissions.md` | Both | 3h | 07 complete | `not_started` | verified RC | build、gateway、四层降级、双提交 | URLs、manifest、checklists | 执行后填写 |
| 09 | `2026-08-27-09-post-mvp-cloud-ai-expansion.md` | Engineer + Reviewers | 4-6d | 01—08 complete + privacy review | `not_started` | released local MVP | opt-in encrypted sync、独立 AI practice | privacy/security/E2E evidence | 不计入黑客松 |

允许状态只有 `not_started`、`in_progress`、`blocked`、`complete`；Plan 09 在黑客松期间登记为 `not_started` 且不得启动。Plan 01—08 工程总量仍为 32—36 小时；内容与提交工作由队友并行，不计入工程串行关键路径，Plan 09 不计入该工时。

## 两人分工

### 全栈工程师

- 负责仓库、Expo、Worker、共享契约、storage、model adapter、tests、CI/CD 与 builds。
- 每个技术验收项必须提供 command output、device record 或 artifact URL。
- Plan 02 完成时冻结 v1 公共契约；之后不得在消费者中复制或改写类型。

### 内容与产品队友

- 负责审核内容 fixture、scenario fixture、Golden conversation 期望、披露文案、可访问性文案和双命题叙事。
- 未走变更流程不得修改共享 TypeScript contracts。
- Plan 04 完成前审核 Golden set 的安全结果；Plan 06 完成前审核最终内容装配。

## 四天进度

| Day | 全栈工程师 | 内容与产品队友 | 当日硬门槛 |
|---|---|---|---|
| 1 | Plan 01—02 | 内容 fixture 与来源 metadata | iPhone dev build、`/health`、contract/domain tests |
| 2 | Plan 03—04；启动 05A | Golden set、八页 catalog key 与来源 | AI/security 基线、storage tests、八页状态框架 |
| 3 | 完成 05A/05B；执行 06 | 最终八页内容、医学素材审核与提交初稿 | 八页本地闭环、accessibility pass |
| 4 | Plan 07—08 | demo/video/submission materials | installable build、四层降级、两套提交 |

Day 4 只修 P0/P1 缺陷，不增加功能。

## P0 / P1 / P2 范围

### P0

- 真实 iPhone Development/Preview Build。
- 八页内容、选择、返回修改、恢复和确定性派生离线可用。
- Page 6 使用明确标识的预设分支完成练习；Page 7—8 使用本地规则整理。
- `MockProvider`、OpenAI-compatible `LiveProvider`、安全状态机与 secret 隔离作为已完成基础设施保留，但不进入八页 Demo 路径。
- 本地加密草稿/沟通卡、逐条删除/删除全部、网关不保存正文、key/bundle scan。
- Page 3 内容可追溯来源；不输出准备度分数；cloud 保存不可选择。
- 萨福与 Eazo 两个提交目录及现场 Runbook。

### P1

- 更多预设分支、医学图示成品、沟通卡最终版式和用品 guide 内容。
- SQLCipher 真机验证、Worker rate limit。
- Android smoke test 延期，不属于当前黑客松 Gate；仅在未来独立固定决策获批并配置 Android package 后执行。
- Maestro core flow 与 EAS preview update。

### P2

- 额外动画、iOS E2E 自动化、crash service、高级 metrics。
- 账号、opt-in cloud sync 与独立 AI practice 属于 Plan 09，不是黑客松 P2。

任一 P0 失败时立即停止 P1/P2。

## 公共接口所有权

**Plan 02 独占：** `Course`、`Lesson`、`LessonBlock`、`QuizQuestion`、`ScenarioConfig`、`ScenarioStage`、`StopRule`、`DebriefRubric`、`PracticeTurnRequest`、`PracticeTurnResponse`、`DebriefRequest`、`DebriefResponse`、`SafetyDecision`、`ApiErrorCode`、`ApiErrorResponse`。

**Plan 03 独占：** `ModelProvider`、`ProviderTurnInput`、`ProviderDebriefInput`，以及 `/health`、`/v1/meta`、`/v1/practice/turn`、`/v1/practice/debrief`。

**Plan 04 独占：** `LocalDataRepository`、`SecretRepository`、key lifecycle、safety policy 与 log allowlist。

**Plan 05A 独占：** mobile-private `JourneyDraft`、`JourneyCommand`、`JourneyDraftRepository`、`CommunicationCardRepository`、`JourneyApplicationService`、派生同步协议与八页 route manifest。

**Plan 05B 独占：** `PresetPracticeEngine`、`PracticeIntent`、`PartnerResponseBranch`、`PointEvent`、八页 page controllers 和 local catalog assembly；不得创建 Gateway Client 消费路径。

**Plan 06 独占：** UI component contracts、design tokens、最终 content/asset assembly；不得改变 05A mobile domain/repository 或 Plan 02 API 契约。

**Plan 07—08：** 只验证和发布，不新增公共接口。

**Plan 09：** 仅在黑客松结束和独立隐私审查后拥有 v2 sync/AI expansion；不得改变当前 MVP 的默认 local-only 行为。

## 固定环境变量

| 名称 | 位置 | Secret | 用途 |
|---|---|---:|---|
| `EXPO_PUBLIC_GATEWAY_URL` | Mobile | No | Gateway base URL |
| `EXPO_PUBLIC_MODEL_MODE` | Mobile | No | `mock` 或 `live` |
| `MODEL_BASE_URL` | Worker | No | OpenAI-compatible base URL |
| `MODEL_API_KEY` | Worker Secret | Yes | Provider credential |
| `MODEL_NAME` | Worker | No | Provider model identifier |
| `MODEL_MODE` | Worker | No | `mock` 或 `live` |
| `PROMPT_VERSION` | Worker | No | Prompt release identifier |
| `POLICY_VERSION` | Worker | No | Safety policy identifier |

任何 AI credential 都不得使用 `EXPO_PUBLIC_` 前缀。

`EXPO_PUBLIC_MODEL_MODE` 和所有 Worker model variables 只服务 Plan 03 的独立 AI infrastructure tests 与 Plan 09 未来模块；八页 routes 不读取这些变量，也不因其缺失而阻止启动。

## 固定根命令

Plan 01 先创建基础 scripts；Plan 02 与 Plan 04 补齐内容和安全 scripts。进入 Plan 05 前，根 `package.json` 必须准确提供：

```json
{
  "scripts": {
    "dev:mobile": "pnpm --filter @cave/mobile start",
    "dev:gateway": "pnpm --filter @cave/gateway dev",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:contracts": "pnpm --filter @cave/contracts test",
    "test:content": "pnpm --filter @cave/content test",
    "test:safety": "pnpm --filter @cave/gateway test:safety",
    "validate:content": "pnpm --filter @cave/content validate:content",
    "security:audit": "pnpm audit --prod",
    "security:scan-bundle": "node scripts/scan-bundle-secrets.mjs",
    "build:gateway": "pnpm --filter @cave/gateway build",
    "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm validate:content && pnpm build:gateway"
  }
}
```

## 跨计划变更流程

### CR-2026-08-27-02：八页本地 MVP 主路径

- 原因：产品已明确以个人身体认识与边界为共同核心，黑客松主演示需要先验证完整产品框架，不在前期展开 AI、云端和最终页面细节。
- 决策：Plan 05 拆为 05A/05B；Page 1—8 使用 mobile-private `JourneyDraft`、预设练习和确定性本地派生；Plan 06 承接最终内容、医学图、版式和可访问性；Plan 09 独立登记云端与 AI 扩展。
- 影响：Plan 05/06 的目标、P0 唯一归属、Day 2—3 进度和 Plan 07 演示验收。Plan 02/03/04 的现有公共接口与实现不回退。
- 验收：八页 offline full-flow、underage guard、back/edit/recompute、source validation、points independence、local save/delete 和 no-AI import scan 全部提供 fresh evidence。
- 分支策略：从 `codex/plan-03-04-implementation` 的已提交 HEAD 建立独立文档/实现分支，不 merge `main`，不覆盖已有 Plan 03/04 commits。

### CR-2026-08-27：发布前产品标识迁移

- 原因：仓库初始 `Body Voice` 标识与批准的“内界 CAVE”产品定义不符，且尚未创建 EAS 项目或发行记录。
- 决策：采用 `carter_wells/cave`、`com.neijie.cave`、`@cave/*`、`neijie-cave-gateway` 与 `cave-basics`；本轮删除 Android package。
- 影响：Plan 01 App/EAS/Worker Gate、Plan 02 内容主 ID、Plan 04 SQLCipher 平台边界、Plans 03/05/06 的消费者名称，以及 Plans 07/08 的质量与发布验收边界。
- 验收：本地 identity tests、完整 Plan 01—02 技术验证、feature-branch CI、EAS 项目差异审查和真实 iPhone Development Build。

- [ ] 在本文件记录 change request、原因与受影响的 acceptance criterion。
- [ ] 类型、enum、route、error code 或 environment variable 变化时，先改 Plan 02 或 Plan 03。
- [ ] safety policy 变化时，先改 Plan 04 与 Golden set，再改 Plan 03 或 Plan 05。
- [ ] 先更新 contract tests，再更新实现测试与所有消费者计划。
- [ ] 运行 `pnpm verify` 并把完整输出登记到受影响计划。
- [ ] 以 `git commit -m "docs: update implementation contract"` 同时提交本索引和受影响计划。

## 统一验收证据模板

```text
Plan:
Commit:
Commands run:
Expected result:
Observed result:
Artifacts/build URLs:
Known non-blocking issues:
Next plan unlocked:
```

## 执行证据

### Plan 01 / Gate 01A（2026-08-26）

```text
Plan: 01 Repository/Infrastructure
Commit: 1fb7b44 (with prerequisite commits 17554bb, 44a3609, f547cad, b21d9d8, 03c1808)
Commands run: corepack pnpm -r list --depth -1; corepack pnpm verify:foundation; corepack pnpm --filter @hackathon/mobile expo:doctor; corepack pnpm --filter @hackathon/gateway test; corepack pnpm --filter @hackathon/gateway build; git diff --check; git status --short
Expected result: all local commands exit 0
Observed result: Gate 01A pass; 7 workspaces listed; foundation tests 9/9; Expo Doctor 21/21; gateway 1/1; dry-run build 62.70 KiB / gzip 15.40 KiB; clean status
Artifacts/build URLs: GitHub CI pass (2026-08-27), https://github.com/CarterWells111/CAVE/actions/runs/33026972088; EAS build URL pending
Known non-blocking issues: Gate 01B external_pending — EAS owner/project linking, Apple Team/device registration, and iPhone install/offline launch
Next plan unlocked: Plan 02 local implementation
```

### Plan 02 / Gate 02A—02B（2026-08-26）

```text
Plan: 02 Contracts/Content/Domain
Commit: 32123c5 (with prerequisite commits 9d48b68, 73d28d2, a51a8a1, 05ce733, ca6586b, cc1495e)
Commands run: corepack pnpm typecheck; corepack pnpm lint; corepack pnpm test:contracts; corepack pnpm test:content; corepack pnpm --filter @hackathon/scenario-engine test; corepack pnpm --filter @hackathon/test-fixtures test; corepack pnpm validate:content:draft; corepack pnpm validate:content
Expected result: technical tests and draft validation pass; production validation blocks unreviewed content
Observed result: Gate 02A pass — contracts 19/19, content 10/10, scenario engine 18/18, fixture/domain 11/11; 21-schema v1 public export inventory frozen; deep imports blocked; draft validation passed
Artifacts/build URLs: none
Known non-blocking issues: Gate 02B content_review_pending — production validation exits 1 for 7 draft entries; Golden set has no content-owner signature
Next plan unlocked: none until content review completes and production validation passes
```

### CAVE 产品标识迁移 / Gate 01A、01B、02A—02B（2026-08-27）

```text
Plan: CR-2026-08-27 / Product identity migration Tasks 1—7
Commit: 5d23a20 (with task commits 4a9f7c8, b3a5862, 854cc4b, abfc721, 9cfc544; Expo SDK dependency alignment a057e09; design/plan prerequisites e63bd27, 2f97163)
Commands run: legacy identifier rg scan; corepack pnpm -r list --depth -1; corepack pnpm test:ci-config; corepack pnpm verify:foundation; corepack pnpm --filter @cave/mobile expo:doctor; corepack pnpm --filter @cave/gateway test; corepack pnpm --filter @cave/gateway build; corepack pnpm test:contracts; corepack pnpm test:content; corepack pnpm --filter @cave/scenario-engine test; corepack pnpm --filter @cave/test-fixtures test; corepack pnpm validate:content:draft; corepack pnpm validate:content; git diff --check; git status --short; GitHub CI foundation
Expected result: active legacy scan has zero matches; all local technical commands exit 0; production validation exits 1 only for the seven unsigned draft entries; feature-branch CI passes
Observed result: active legacy scan exit 1 with zero matches; 7 approved workspaces listed; ci-config 2 files / 5 tests; exact elevated foundation rerun exit 0 with typecheck/lint pass, 14 files / 68 tests, and Wrangler dry-run 62.70 KiB / gzip 15.40 KiB; Expo Doctor exact network-enabled rerun 21/21; gateway 1/1; contracts 19/19; content 11/11; scenario engine 18/18; fixture/domain 11/11; draft validation passed for 1 course / 1 lesson / 3 scenarios; production validation exit 1 for exactly 7 DRAFT_CONTENT entries including courses.cave-basics and no other error; diff check exit 0; status clean; Gate 01A pass and Gate 02A pass
Artifacts/build URLs: GitHub CI pass for 5d23a20, https://github.com/CarterWells111/CAVE/actions/runs/33033160786; EAS project/build URL pending
Known non-blocking issues: initial sandbox-only Expo cache/network and Wrangler AppData/parent-path failures passed on exact authorized reruns; Gate 01B external_pending — EAS project linking, Apple Team/device registration, iPhone Development Build, install, and two Metro-disconnected launches; Gate 02B content_review_pending — seven entries remain draft and Golden outcomes have no content-owner signature
Next plan unlocked: identity migration Task 8 only; Plan 03/04 remain outside this execution scope
```

### Expo Go 临时真机验收决策 / Gate 01B（2026-08-27）

```text
Decision: Apple Developer 会员已付款但仍为 Pending；等待激活期间先用 Expo Go 验收当前 JavaScript bundle，会员激活后继续真实 iOS Development Build
Current project evidence: EAS project @carter_wells/cave is linked at https://expo.dev/accounts/carter_wells/projects/cave with project ID 1ddc0761-af43-491c-b969-ec2f6c415013; GitHub CI passed at commit 3badcd7583fb35bc5539cf569c6c03e26c03bafd, https://github.com/CarterWells111/CAVE/actions/runs/33034040119
Interim command: from apps/mobile run .\node_modules\.bin\expo.CMD start --go, then scan the QR code with Expo Go on the intended iPhone
Interim acceptance scope: observe whether the JS bundle opens without a red error and record the exact product name, slogan, version, build, and environment displayed on the real device
Non-substitution rule: Expo Go does not prove bundle identifier, Apple Team/signing, device provisioning, Development Build inclusion/installation, or two launches after Metro is stopped
Gate status: Gate 01A=pass; Gate 01B=external_pending until membership is active and the planned Development Build, installation, and Metro-disconnected launch evidence are complete
Next action: execute the Expo Go observation now; do not run EAS device registration or build while membership remains Pending
```

### Plan 02 / Gate 02B 内容审核闭环（2026-08-27）

```text
Approval source: 当前 Codex 任务中的用户明确回复“批准，本地相关修改，计划内的都批准”
Reviewed at: 2026-08-27T05:51:49Z
Reviewed entries: courses.cave-basics; lessons.lesson-boundaries; scenarios.scenario-boundary; scenarios.scenario-preview-space; scenarios.scenario-preview-request; guide.categories.guide-boundaries; guide.categories.guide-next-steps
Golden outcome checklist: approved by the same user instruction; no claim is made about Plan 04's later evaluator implementation
Commit: a1c03e8
Verification: content tests 11/11; production validation passes for 1 course / 1 lesson / 3 scenarios; Golden fixture/domain tests 11/11
Gate status: Gate 02A=pass; Gate 02B=pass
```

### Plan 03 / Plan 04 本地联合实现（2026-08-27）

```text
Branch: codex/plan-03-04-implementation
Baseline: 1df9d66773c59bacd1c6f88dcd19e0a79802d1d2 from codex/plan-01-02-implementation (descendant of 3badcd7); main was not merged
Plan 03 commits: 3e83282, fbbb749, fe2c024, 4c96f5d, aed8270
Plan 04 commits: dc90739, 6f642c9, 3c875c1, dbc085e, 371c905; shared dependency commit 248b87d
Local evidence: gateway typecheck/lint pass; gateway 16 files / 160 tests; mobile 9 suites / 26 tests; safety 4 files / 53 tests; repository security config/scanner 4 files / 15 tests; exported iOS JS bundle 1101 modules / 2.3 MB and bundle scan passed 25 files; Wrangler dry-run 688.11 KiB / gzip 113.54 KiB with independent 10/min turn and 5/min debrief bindings
Plan 03 status: complete locally with deterministic MockProvider and mocked-fetch LiveProvider; no real model credential was requested, emitted, or required for P0
Plan 04 status: blocked — createTurnSafetyEvaluator still classifies the Golden clear-boundary text as uncertain/safety_stop instead of safe/resolution after two root-cause fix rounds; no third masking fix was attempted
External pending: Gate 01B Apple membership/Development Build/iPhone evidence; SQLCipher/no-key and delete-all cold-start checks on a real iPhone; deployed Worker canary-log inspection; repository Code Scanning and Secret Scanning settings; CodeQL extracted/scanned 95/95 TypeScript, 2/2 Actions, and 2/2 JavaScript files but GitHub rejected SARIF upload because Code Scanning is disabled; npm production audit pending explicit approval to send package/version metadata to the public npm advisory endpoint
Next plan unlocked: none; Plan 05 remains locked until Plan 04's Golden evaluator issue and required native evidence are closed
```

### Plan 05A / Gate 05A（2026-08-27）

```text
Plan: 05A Eight-page MVP framework
Branch: codex/plan-05a-05b
Baseline: 2436773 from merged main
Commits: 43afb05, 37581ca, 62de80f, 54e2be7, 995400a, 3b5750c
Commands run: corepack pnpm --filter @cave/mobile typecheck; corepack pnpm --filter @cave/mobile lint; corepack pnpm --filter @cave/mobile test; corepack pnpm test:safety; rg -n "GatewayClient|ModelProvider|/v1/practice|fetch\(" apps/mobile/app/journey apps/mobile/src/features/journey; git diff --check
Expected result: technical commands exit 0; import scan exits 1 with zero matches
Observed result: mobile typecheck/lint pass; 19 suites / 66 tests pass; safety 4 files / 53 tests pass; exact journey import scan exits 1 with zero matches; diff check passes
Known non-blocking issues: Plan 04 Golden evaluator remains blocked; Apple membership/signing and real-iPhone SQLCipher/delete-all evidence remain external_pending; these do not affect the local-only journey framework
Gate status correction after independent review: Gate 05A in_progress; local core evidence passes, but production routes do not consume the service/provider guard and resume/back navigation. Gate 05B implementation proceeded only in the user-approved reduced local-core scope. Plan 06 and Plan 07 remain locked.
```

### Plan 05B / reduced local-core evidence（2026-08-27）

```text
Branch: codex/plan-05a-05b
Commits: 12a83be, 3e28838, 7420113, 407b979, 14c029c, 186752b, cd98348, d8fd1be; framework hardening d76f7a8, 0d86225
Fresh evidence: mobile typecheck/lint pass and 25 suites / 106 tests; content 3 files / 18 tests and draft validation pass; production validation reports exactly 23 DRAFT_CONTENT entries; contracts 4/19; scenario 2/18; fixtures 2/11; gateway 16/160; safety 4/53; CI config 4/15; Wrangler no-deploy dry-run 692.70 KiB / gzip 113.77 KiB
Boundary evidence: journey AI/network scan zero matches; production-only readiness/score/percentage/cloudEnabled scan zero matches; cloud save remains disabled coming-soon
Gate status: Gate 05B in_progress — local catalogs, preset engine, points, controllers, basic components and offline harness pass; production route composition, native clipboard recovery, recovered form hydration and route-level resume/guard/back integration remain pending
Environment blocker: current host minimum-release-age policy rejects 49 dependencies already pinned on merged main, preventing restoration of standard pnpm fresh commands; direct binaries from the same pinned dependency tree were used and pnpm-lock.yaml was unchanged
External pending: journey content review; Plan 04 Golden evaluator blocked; Apple/signing/real-iPhone SQLCipher evidence external_pending
Next plan unlocked: none; Plan 06 and Plan 07 remain locked
```

## P0 唯一归属

| P0 结果 | 唯一负责计划 |
|---|---|
| 真实 iPhone build、workspace、CI、Worker health | 01 |
| 公共契约、内容校验、确定性状态机 | 02 |
| Mock/Live adapter、prompts、gateway routes 与未来 AI 基线 | 03 |
| SQLCipher、SecureStore、safety policy、request/log/code security | 04 |
| 八页 route、private draft、repository、back/edit/recompute 框架 | 05A |
| 八页基础交互、预设练习、清单/沟通卡、积分与 offline flow | 05B |
| 最终八页内容/医学资产、完整状态、accessibility/disclosures | 06 |
| release tests、performance/security recheck、三轮彩排 | 07 |
| installed preview、deployed gateway、四层降级、双提交 | 08 |

## 总体验收清单

- [ ] Plan 01—08 无依赖循环，且每份可独立验收。
- [ ] 每个 P0 恰好归属一份计划，不遗漏、不重复负责。
- [ ] path、type、route、error code、environment variable 跨文档一致。
- [ ] iPhone 签名与真机构建在 Plan 01 完成。
- [ ] 八页主演示在无模型 API、无网络时仍可完整运行，且不把预设逻辑伪装成 AI。
- [ ] Plan 03 的 Mock/Live 基础设施仍通过自己的契约测试，但不被八页 routes 消费。
- [ ] 安全、隐私与删除底座在 Plan 05A 前完成本地测试；真机证据在 Plan 07 前补齐。
- [ ] 返回修改会确定性更新下游，且保留用户编辑字段并提示复核。
- [ ] MVP 不产生准备度分数，云端保存不可选择，积分不依赖敏感选择。
- [ ] Day 4 无新功能任务。
- [ ] 萨福与 Eazo 共用 build、version 与 repository，只分离材料。
- [ ] 工程总量保持 32—36 小时。
- [ ] MVP 不包含 account、cloud sync、AI practice、CMS、community、store 或生产化扩展；这些能力只登记在非关键路径 Plan 09。
