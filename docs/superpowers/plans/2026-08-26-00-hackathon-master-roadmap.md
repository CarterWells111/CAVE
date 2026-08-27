# 00 四天黑客松总路线图

> 本文件是 01—08 的唯一总索引与变更入口。执行单份计划时逐项勾选，并把命令、产物和 commit 证据回填到本文件。

**目标（Goal）：** 用一个共享的 Expo/Worker 产品完成五个批次，并从同一套代码生成萨福与 Eazo 两种提交叙事。

**架构（Architecture）：** pnpm workspace 包含 Expo 移动端、无状态 Cloudflare Worker 网关，以及共享契约、内容与领域 Package。客户端 local-first；原始练习文本默认不持久化，只有用户逐次明确保存时才进入本地加密数据库，网关永不保存会话正文。

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
| 数据默认值 | 课程进度本地保存；原始 transcript 仅内存存在 |
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
       \ /
05 Mobile Integration
        |
06 Product Completion
        |
07 Quality/Performance
        |
08 Release/Submissions
```

Plan 03 与 Plan 04 可在 Plan 02 完成后并行；其余均是顺序验收门槛，依赖图无循环。

## 计划登记表

| ID | 文件 | 负责人 | 工时 | 解锁条件 | 状态 | 输入 | 输出 | 验收证据 | Git commit |
|---|---|---|---:|---|---|---|---|---|---|
| 01 | `2026-08-26-01-repository-infrastructure-ios-build.md` | Engineer | 4h | 无 | `blocked` | 空仓库、账号、iPhone | workspace、CI、dev build、`/health` | Gate 01A `pass`；Gate 01B `external_pending` | `17554bb`, `44a3609`, `f547cad`, `b21d9d8`, `03c1808`, `1fb7b44` |
| 02 | `2026-08-26-02-contracts-content-domain.md` | Engineer + Content | 3-4h | Gate 01A pass | `complete` | Package shells、内容草稿 | v1 contracts、内容校验、状态机 | Gate 02A `pass`；Gate 02B `pass` | `9d48b68`, `73d28d2`, `a51a8a1`, `05ce733`, `ca6586b`, `cc1495e`, `32123c5` |
| 03 | `2026-08-26-03-ai-gateway-prompt-spec.md` | Engineer | 4-5h | 02 complete | `not_started` | v1 contracts、scenario fixtures | routes、providers、prompts | provider/route tests | 执行后填写 |
| 04 | `2026-08-26-04-security-privacy-code-hardening.md` | Engineer + Content | 4h | 02 complete | `not_started` | v1 safety/storage shapes | encrypted repo、安全策略、CI security | device/log/scan evidence | 执行后填写 |
| 05 | `2026-08-26-05-mobile-mvp-integration.md` | Engineer | 6-7h | 03、04 complete | `not_started` | gateway、安全存储、内容 | 端到端移动闭环 | iPhone integration evidence | 执行后填写 |
| 06 | `2026-08-26-06-product-completion-ux.md` | Both | 5h | 05 complete | `not_started` | 可运行闭环、最终内容 | 完整 UI、可访问性、披露 | state/accessibility matrix | 执行后填写 |
| 07 | `2026-08-26-07-quality-performance-demo-hardening.md` | Both | 3-4h | 06 complete | `not_started` | feature-frozen build | RC、三轮彩排 | test/rehearsal matrix | 执行后填写 |
| 08 | `2026-08-26-08-release-demo-submissions.md` | Both | 3h | 07 complete | `not_started` | verified RC | build、gateway、四层降级、双提交 | URLs、manifest、checklists | 执行后填写 |

允许状态只有 `not_started`、`in_progress`、`blocked`、`complete`。工程总量为 32—36 小时；内容与提交工作由队友并行，不计入工程串行关键路径。

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
| 2 | Plan 03—04；启动 05 | Golden set、披露与 UI copy | Mock/Live provider contract、安全与 storage tests |
| 3 | 完成 05；执行 06 | 最终内容与提交初稿 | iPhone 完整闭环、accessibility pass |
| 4 | Plan 07—08 | demo/video/submission materials | installable build、四层降级、两套提交 |

Day 4 只修 P0/P1 缺陷，不增加功能。

## P0 / P1 / P2 范围

### P0

- 真实 iPhone Development/Preview Build。
- 课程内容与进度离线可用。
- 使用 `MockProvider` 完成一次完整练习闭环。
- OpenAI-compatible `LiveProvider` 接口与 secret 隔离。
- 状态机最终裁决、`safety_stop`、结构化 debrief。
- 本地逐条删除/删除全部、网关不保存正文、key/bundle scan。
- 萨福与 Eazo 两个提交目录及现场 Runbook。

### P1

- 多个 scenario fixture、保存 expression card、guide 内容。
- SQLCipher 真机验证、Worker rate limit。
- Android smoke test 延期，不属于当前黑客松 Gate；仅在未来独立固定决策获批并配置 Android package 后执行。
- Maestro core flow 与 EAS preview update。

### P2

- 额外动画、iOS E2E 自动化、crash service、高级 metrics。

任一 P0 失败时立即停止 P1/P2。

## 公共接口所有权

**Plan 02 独占：** `Course`、`Lesson`、`LessonBlock`、`QuizQuestion`、`ScenarioConfig`、`ScenarioStage`、`StopRule`、`DebriefRubric`、`PracticeTurnRequest`、`PracticeTurnResponse`、`DebriefRequest`、`DebriefResponse`、`SafetyDecision`、`ApiErrorCode`、`ApiErrorResponse`。

**Plan 03 独占：** `ModelProvider`、`ProviderTurnInput`、`ProviderDebriefInput`，以及 `/health`、`/v1/meta`、`/v1/practice/turn`、`/v1/practice/debrief`。

**Plan 04 独占：** `LocalDataRepository`、`SecretRepository`、key lifecycle、safety policy 与 log allowlist。

**Plan 05 独占：** Application Use Cases、移动端 Repository implementation 与 Gateway Client。

**Plan 06 独占：** UI component contracts、design tokens 与 content assembly；不得改变领域/API 契约。

**Plan 07—08：** 只验证和发布，不新增公共接口。

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

### Plan 02 / Gate 02B 内容负责人审核（2026-08-27）

```text
Plan: 02 Contracts/Content/Domain
Review authority: the user explicitly confirmed content-owner signing authority; no reviewer name was recorded
Approved production entries: cave-basics; lesson-boundaries; scenario-boundary; scenario-preview-space; scenario-preview-request; guide-boundaries; guide-next-steps
Approved related fixtures: quiz-boundary-clear; quiz-boundary-next-step; golden-clear-boundary; golden-danger-stop; golden-violence-stop; golden-self-harm-stop; golden-medical-stop; golden-minor-stop; four-dimension debrief expectations
Source decision: source-editorial-draft is an approved internal original-editorial source identifier
Scope boundary: approval is for the current app display and flow framework; safety Golden cases are synthetic stop-routing expectations, not medical, legal, or crisis-response conclusions
Requested content changes: none
Review date applied to the seven production entries: 2026-08-27
Commands run: corepack pnpm validate:content:draft; corepack pnpm validate:content; corepack pnpm test:contracts; corepack pnpm test:content; corepack pnpm --filter @cave/scenario-engine test; corepack pnpm --filter @cave/test-fixtures test; corepack pnpm typecheck; corepack pnpm lint
Observed result: draft and production validation exit 0 for 1 course / 1 lesson / 3 scenarios; contracts 19/19; content 12/12; scenario engine 18/18; fixture/domain 11/11; workspace typecheck and lint exit 0
Gate result: Gate 02B pass
Next plan unlocked: Plan 03 and Plan 04; neither is executed by this review
```

## P0 唯一归属

| P0 结果 | 唯一负责计划 |
|---|---|
| 真实 iPhone build、workspace、CI、Worker health | 01 |
| 公共契约、内容校验、确定性状态机 | 02 |
| Mock/Live adapter、prompts、gateway routes、debrief evidence | 03 |
| SQLCipher、SecureStore、safety policy、request/log/code security | 04 |
| 移动端端到端集成、offline/error/delete flows | 05 |
| 最终内容装配、完整状态、accessibility/disclosures | 06 |
| release tests、performance/security recheck、三轮彩排 | 07 |
| installed preview、deployed gateway、四层降级、双提交 | 08 |

## 总体验收清单

- [ ] Plan 01—08 无依赖循环，且每份可独立验收。
- [ ] 每个 P0 恰好归属一份计划，不遗漏、不重复负责。
- [ ] path、type、route、error code、environment variable 跨文档一致。
- [ ] iPhone 签名与真机构建在 Plan 01 完成。
- [ ] 无模型 API 时，`MockProvider` 仍覆盖完整演示。
- [ ] 安全、隐私与删除契约在 Plan 05 前完成并测试。
- [ ] Day 4 无新功能任务。
- [ ] 萨福与 Eazo 共用 build、version 与 repository，只分离材料。
- [ ] 工程总量保持 32—36 小时。
- [ ] MVP 不包含 account、cloud sync、CMS、community、store 或生产化扩展。
