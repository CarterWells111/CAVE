# 05 八页移动端 MVP 总实施计划

> 本文件是 Plan 05 的执行索引与联合 Gate。具体领域与基础页面实现由 05A、05B 负责；05C 只关闭 production runtime composition 与 Expo Go 演示接线缺口，避免重做已提交能力。

**目标（Goal）：** 在不依赖 Apple 会员状态和模型 API 的条件下，把 CAVE 建成可离线完成、可返回修改、可本地恢复的八页 MVP。

**架构（Architecture）：** Expo Router 薄页面调用移动端私有的 `JourneyApplicationService`；`JourneyReducer` 管原始选择，确定性 builder 生成清单和沟通卡，`JourneyDraftRepository` 通过 Plan 04 的 SQLCipher 底座保存 v1 草稿。

**技术栈（Tech Stack）：** Expo SDK 54、Expo Router、React Native、TypeScript strict、SQLCipher SQLite、SecureStore、Jest、React Native Testing Library。

## 依赖、输入与输出

**依赖计划：** Gate 02A/02B `pass`；Plan 04 的本地 database、key lifecycle、delete-all tests `pass`。Plan 04 的 Golden evaluator blocker、Apple 签名、真实 iPhone SQLCipher 证据在发布前仍需关闭，但不阻止不依赖它们的 05A/05B 本地实现。

**输入：** reviewed local content 基础设施、Plan 04 加密存储、已批准的[八页 MVP 框架设计](../specs/2026-08-27-eight-page-mvp-framework-design.md)。

**输出：** 八页 route/state/persistence 框架、基础交互、预设练习、确定性清单与沟通卡、幂等积分、离线恢复和本机数据控制。

**明确排除：** 最终视觉与文案、医学插图成品、AI 调用、账号、云同步、准备度评分、社区、商城、CMS。

**预计时间：** 6—7 小时，其中 05A 2.5—3 小时、05B 3.5—4 小时。
**负责人：** 全栈工程师；内容与产品队友并行审核 catalog key、来源和基础措辞。

## 准确文件路径

```text
docs/superpowers/specs/2026-08-27-eight-page-mvp-framework-design.md
docs/superpowers/plans/2026-08-27-05a-eight-page-mvp-framework.md
docs/superpowers/plans/2026-08-27-05b-eight-page-mvp-functions.md
docs/superpowers/plans/2026-08-27-05c-expo-go-demo-composition.md
apps/mobile/app/journey/**
apps/mobile/src/features/journey/**
apps/mobile/src/core/storage/**
packages/content/data/journey-*.json
```

## 子计划和执行顺序

| 子计划 | 文件 | 输入 | 输出 | 解锁门槛 |
|---|---|---|---|---|
| 05A | `2026-08-27-05a-eight-page-mvp-framework.md` | storage/content 基线 | routes、draft、reducer、repository、派生同步、页面薄壳 | Gate 05A `pass` |
| 05B | `2026-08-27-05b-eight-page-mvp-functions.md` | Gate 05A | 八页基础功能与完整本地演示路径 | Gate 05B `pass` |
| 05C | `2026-08-27-05c-expo-go-demo-composition.md` | 05A/05B local core | Expo Go 内存演示与 Development/Preview secure production composition | Gate 05C local `pass`；native evidence `external_pending` |

05A 必须先冻结移动端私有接口；05B 只能消费这些接口。05C 只能装配和消费现有 domain/repository/controller，并可增加明确的 runtime/adapters/UI hydration contracts；不得复制 05A/05B 领域能力。若 05C 确需修改 `JourneyDraft`、repository 或派生规则，先返回 05A 更新测试和本文件的接口登记。

## 固定运行时边界

- 八页 routes 不得 import `GatewayClient`、`ModelProvider`、raw SQL 或 `@cave/scenario-engine`。
- Page 6 使用 `PresetPracticeEngine`；Page 7—8 使用纯本地 builder。
- `EXPO_PUBLIC_MODEL_MODE` 不影响八页流程，断网不禁用八页任何 P0 action。
- 云端保存只渲染 `coming-soon` 状态，控件必须 disabled，点击不能写网络或改变保存方式。
- Journey 类型只存在于 `apps/mobile/src/features/journey/domain/`，不修改 `@cave/contracts`。
- 未满18岁不创建草稿；年龄确认不记录生日或具体年龄。

## 联合执行 Gate

### Gate 05A：框架

- [x] 八页 route、guard、返回和恢复测试通过。
- [x] `JourneyDraft` v1、reducer、repository migration 和 delete-all 测试通过。
- [x] 上游修改会重算下游；用户编辑字段被保留并标记复核。
- [x] 页面薄壳不包含最终视觉、长文案或 AI/network import。

### Gate 05B：基础闭环

- [x] 从 Page 1 到 Page 8 的本地 integration test 通过。
- [x] Page 6 明示预设对话，所有分支可由 fixture 完成。
- [x] Page 7—8 输出可编辑，且无准备度分数。
- [x] 积分幂等，且不读取开放程度、私密文字或文字长度。
- [x] local save、resume、delete-all、offline 和 app restart 测试通过。

### Gate 05C：联合验收

**当前状态：** Gate 05A/05B/05C local `pass`；Development/Preview 真机证据 `external_pending`。Expo Go `memory-only` 装配、Development/Preview SQLCipher + SecureStore 不降级装配、provider/route 生产接线、恢复/guard/back/reset 和根页“进入八屏演示”入口均已完成并通过本地 Gate。

在 05A、05B 各自命令通过后新鲜运行：

```powershell
corepack pnpm --filter @cave/mobile typecheck
corepack pnpm --filter @cave/mobile lint
corepack pnpm --filter @cave/mobile test
corepack pnpm test:content
corepack pnpm validate:content:draft
corepack pnpm test:safety
git diff --check
git status --short
```

预期：typecheck、lint、mobile/content/journey tests、draft validation 与 diff check 退出码均为 0；mobile tests 明确报告 journey domain、storage、screens 和 full-flow suites。`test:safety` 不得出现 journey 引入的新回归；已登记的 Plan 04 Golden evaluator blocker继续如实保留，且阻塞 Plan 07/release，不阻塞 Expo Go 八屏演示。23 条 journey fixtures 保持 `content_review_paused/draft`，production validation 的非零结果由主代理 fresh Gate 如实回填，不修改 `reviewedAt`。

## 提交节点

05A 和 05B 按各自计划为每项独立能力使用英文 commit。联合 Gate 证据单独提交：

```powershell
git add docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md docs/superpowers/plans/2026-08-26-05-mobile-mvp-integration.md
git commit -m "docs: record eight-page MVP gate"
```

## 故障、回滚与降级

- Apple 会员、签名或真机安装不可用：记录 Gate 01B/05C device evidence 为 `external_pending`，继续完成 simulator/Jest 范围；不得声称真机通过。
- Plan 04 Golden evaluator 未关闭：八页流程不调用 evaluator，可继续；Plan 07 发布 Gate 仍保持阻塞。
- SQLCipher adapter 在开发环境不可加载：使用只注入测试的 in-memory fake 验证领域逻辑；Preview Build 不得降级为明文数据库。
- 新需求需要云端或模型：记录到 Plan 09，不在 05A/05B 接入隐藏开关。
- 内容尚未审核：保留 draft fixture 和 production validation 的真实失败，不伪造 `reviewedAt`。

## 验收证据清单

- [x] 05A、05B commit 清单和全部 fresh command exit code。
- [x] 八页 full-flow 测试数量与输出。
- [x] offline、restart、back-edit-recompute、underage-exit 的自动化证据。
- [x] source tree scan 证明八页 feature 不 import Gateway/Provider。
- [x] database migration、local-only 保存和 delete-all 证据。
- [x] 真实 iPhone 证据不可取得，已明确标记 `external_pending`。

**解锁下一计划：** Gate 05A 与 05B 完成后解锁 Plan 06；Gate 05C 的真机部分必须在 Plan 07 前补齐。

## 历史缩减范围 Gate 记录（2026-08-27，已由 05C 工作树接线取代）

```text
Branch: codex/plan-05a-05b
Main sync: existing Plan05 commits preserved; origin/main ca3152c integrated through non-destructive merge commit 553c890; no reset or overwrite
Result: local framework/domain/storage/controllers/basic pages/offline harness implemented and verified; final native composition intentionally not claimed
Gate 05A: in_progress — local framework tests pass, production route composition and route guard/resume consumption pending
Gate 05B: in_progress — local core flow tests pass, production routes and native clipboard/recovered-form integration pending
Gate 05C: not run as a passing Gate because 05A/05B product wiring is incomplete
Plan 06/07: locked
No deploy, no main merge, no secret output
No PR created; Expo SDK 54 remains the active technical baseline
```

## Plan 05C 工作树实现检查点（2026-08-27）

```text
Branch: codex/plan-05c-expo-go-demo
Status: local_pass — native device evidence external_pending；PR/CI URL pending push
Expo Go: storeClient selects a process-lifetime in-memory draft/card runtime and visibly labels temporary data; it does not claim SQLCipher persistence
Development/Preview: native-secure composition uses SQLCipher + SecureStore and Expo clipboard; initialization failures remain visible and do not fall back to memory
Production wiring: one JourneyRuntimeProvider mounts the journey layout; Page 1—8 routes consume runtime snapshot/controller/actions; guard/resume/back/reset and recovered form values are wired
Entry: app root explicitly renders “进入八屏演示” and routes to /journey/welcome
Content: content_review_paused/draft; 23 journey fixtures remain draft and reviewedAt is unchanged
Plan 04: Golden evaluator remains blocked, does not enter the eight-page runtime, and does not block the Expo Go demo; it still blocks Plan 07/release
External pending: Apple membership/signing, Development/Preview build/install, real-iPhone SQLCipher/no-key and cold-start delete-all
Final fresh Gate: PASS — workspace 65 files / 399 tests；mobile 38 suites / 172 tests；typecheck/lint/content draft/safety/diff exit 0；Expo Doctor 18/18；production validation expected exit 1 with exactly 23 DRAFT_CONTENT
Implementation commits: `725dcb9`, `b852f42`, `1a8600b`, `d88d927`, `3336a5d`, `50ec3f0`, `ac289a0`, `421e60a`, `39663cc`
CI / PR: PENDING push 后回填
Plan 06: unlocked but not started；content_review_paused/draft remains；Plan 07 remains locked by Plan 04/native/external prerequisites
```
