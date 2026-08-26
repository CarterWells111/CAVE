# 05 Expo 移动端核心闭环实施计划

> 执行要求：route 只负责导航与 presentation；SQL、network 与领域规则必须留在 Repository、Gateway Client 或 Use Case。

**目标（Goal）：** 把本地内容、确定性练习状态、加密 Repository 与 AI 网关集成成一个可恢复的 iPhone 完整闭环。

**架构（Architecture）：** Expo Router 文件保持薄层并调用 feature-level application use cases；Zustand 管 transient session；TanStack Query 管可取消 gateway operations；Repository interfaces 隔离 SQLite/SecureStore 与 UI。

**技术栈（Tech Stack）：** Expo SDK 57、Expo Router、React Native、Zustand、TanStack Query、Zod、SQLCipher SQLite、SecureStore、Jest、React Native Testing Library。

---

**依赖计划：** Plan 03 与 Plan 04 complete。  
**输入：** frozen contracts/content/state engine、gateway routes、safety policy、encrypted repositories。  
**输出：** offline content/progress、完整 Mock/Live practice flow、debrief、显式 save/delete、error/safety states。  
**明确排除：** 最终视觉打磨、额外动画、account/cloud sync、新公共契约。  
**预计时间：** 6—7 小时。**负责人：** 全栈工程师。

## 准确文件路径

```text
apps/mobile/app/_layout.tsx
apps/mobile/app/(tabs)/{index,learn,practice,profile}.tsx
apps/mobile/app/lesson/[lessonId].tsx
apps/mobile/app/practice/{setup,session,debrief}.tsx
apps/mobile/src/app/providers.tsx
apps/mobile/src/core/config/env.ts
apps/mobile/src/core/network/{gateway-client,errors}.ts
apps/mobile/src/core/network/*.test.ts
apps/mobile/src/features/courses/{domain,application,infrastructure,ui}/**
apps/mobile/src/features/practice/{domain,application,infrastructure,ui}/**
apps/mobile/src/features/privacy/{application,ui}/**
apps/mobile/src/test/render.tsx
```

## Application Use Cases（规范性定义）

```ts
interface CourseUseCases {
  listCourses(): Promise<Course[]>;
  getLesson(lessonId: string): Promise<Lesson>;
  completeLesson(input: CourseProgressRecord): Promise<void>;
  getProgress(): Promise<CourseProgressRecord[]>;
}

interface PracticeUseCases {
  startPractice(scenarioId: string, selectedOptions: Record<string, string>): void;
  sendPracticeTurn(message: string): Promise<void>;
  cancelPracticeTurn(): void;
  finishPractice(): Promise<void>;
  createDebrief(): Promise<DebriefResponse>;
  savePractice(options: { includeTranscript: boolean }): Promise<void>;
  resetPractice(): void;
}

interface PrivacyUseCases {
  acknowledgeLiveModel(): Promise<void>;
  listSavedRecords(): Promise<SavedPracticeRecord[]>;
  deleteRecord(id: string): Promise<void>;
  deleteAllData(): Promise<void>;
}
```

`CourseProgressRecord` 与 `SavedPracticeRecord` 从 Plan 04 的 storage types 导入，不得在 feature 中复制。

## 任务 1：App providers 与公开环境变量

- [ ] 先写失败测试：缺少/非法 `EXPO_PUBLIC_GATEWAY_URL`、`EXPO_PUBLIC_MODEL_MODE` 时显示 blocking configuration error。
- [ ] 实现 client env schema，只允许 `mock | live`；明确所有 `EXPO_PUBLIC_*` 都是公开值。
- [ ] 在 `src/app/providers.tsx` 组合 SafeArea、QueryClient、SQLite provider、theme、global error boundary。
- [ ] `app/_layout.tsx` 只组合 Provider 与 routes。
- [ ] 创建 deterministic QueryClient 与 in-memory repository fakes 的 test renderer。
- [ ] 运行 mobile tests，预期 env/provider tests 通过；提交：`git commit -am "feat: compose mobile application providers"`。

## 任务 2：本地内容与课程进度

- [ ] 先写失败测试：offline listing、missing lesson、idempotent completion、restart 后 progress 保留。
- [ ] 实现 `CourseUseCases`，只消费 `@hackathon/content` 与 `LocalDataRepository`。
- [ ] domain/application code 禁止 import React Native；repository adapter 隔离基础设施。
- [ ] 添加薄 `learn` 与 lesson routes，使用 view model 并提供稳定 accessibility labels。
- [ ] 模拟无网络，catalog、lesson、quiz fixture、progress 必须行为不变。
- [ ] 提交：`git commit -am "feat: integrate offline learning progress"`。

## 任务 3：Gateway Client 与 error mapping

- [ ] 先写 fetch-mocked 失败测试：valid response、timeout、cancel、429 retry-after、wrong contract version、5xx、invalid JSON、safety stop。
- [ ] 本地生成 request ID，从 `SecretRepository` 读取 installation token。
- [ ] 每个 response 进入 application code 前必须通过 shared Zod schema。
- [ ] 固定 15 秒 AbortController timeout；只对 network error/5xx 重试一次，user cancellation 不重试。
- [ ] 把 `ApiErrorCode` 映射为 typed client error，只带 retryability 与 safe UI message key，不带 server body。
- [ ] practice mutation result 的 TanStack Query cache time 固定为 0。
- [ ] 运行 network tests；提交：`git commit -am "feat: add resilient gateway client"`。

## 任务 4：Transient practice session store

- [ ] 先写失败测试：start、append turn、cancel pending、legal transition、max-turn end、safety stop、reset、app-background reset policy。
- [ ] Zustand state 仅含 scenario ID/version、options、stage、turn count、transient turns、request status、completion reason。
- [ ] raw turns 禁止进入 persistence middleware；storage mock 在普通练习期间必须零 transcript writes。
- [ ] stage transition 只调用 `@hackathon/scenario-engine`；store 不得直接赋值 stage。
- [ ] 提交：`git commit -am "feat: manage transient practice sessions"`。

## 任务 5：Practice Use Cases

- [ ] 先用 Mock gateway fixtures 写 setup → turns → debrief 的完整 integration test，预期 use cases 未实现时失败。
- [ ] 实现 `startPractice`、`sendPracticeTurn`、`cancelPracticeTurn`、`finishPractice`、`createDebrief`、`resetPractice`。
- [ ] send 顺序固定为：append user turn → call gateway → validate → scenario engine accept state → append assistant turn。
- [ ] `safety.level === "stop"` 时禁止追加普通 roleplay continuation，记录 completion reason 并进入 safety state。
- [ ] timeout/unavailable 时保留 unsent text 与 local progress，提供 retry、透明 Mock switch 或 exit。
- [ ] explicit exit 先 abort pending network，再清除 transient state。
- [ ] 提交：`git commit -am "feat: integrate constrained practice workflow"`。

## 任务 6：连接 setup/session/debrief routes

- [ ] 增加 ESLint restriction：route 不得 import storage、raw network、scenario reducer。
- [ ] 先写 component tests：setup validation、pending 时 send disabled、cancel、retry、safety stop、debrief load、pending send 时 back prevention。
- [ ] 用已测 Use Cases 实现 `practice/setup`、`practice/session`、`practice/debrief`。
- [ ] UI 显示 model mode 与 request failure，不向普通用户暴露 provider internals。
- [ ] 增加 developer-only diagnostics sheet，显示 contract/prompt/policy/app versions。
- [ ] 提交：`git commit -am "feat: connect mobile practice routes"`。

## 任务 7：显式保存与删除

- [ ] 先写失败 integration tests，证明 debrief/transcript 默认不持久化。
- [ ] save action 提供 expression card only 或 card + transcript；默认选 card only，且每次重新选择。
- [ ] 断言 Repository 只收到用户本次选定 payload。
- [ ] 为 list、detail、per-record delete、delete-all 建 profile/history view models。
- [ ] `deleteAllData()` 必须顺序清理 Query cache、Zustand state、database、database connection、installation token。
- [ ] 提交：`git commit -am "feat: add explicit local record controls"`。

## 任务 8：Offline 与 failure states

- [ ] 先写 view-state tests：offline、timeout、rate-limit countdown、contract mismatch、model unavailable、invalid output、storage reset、safety stop。
- [ ] offline 时课程/进度继续可用，practice send disabled 并说明原因。
- [ ] rate limit 使用 server `retryAfterSeconds`，不得自动切 provider。
- [ ] contract mismatch 阻止 online practice，并提示安装匹配 preview build。
- [ ] Mock switch 必须可见确认“下一段回复为预设演示内容”。
- [ ] 提交：`git commit -am "feat: handle mobile recovery states"`。

## 执行命令与预期结果

- [ ] `pnpm --filter @hackathon/mobile typecheck`：退出码 0。
- [ ] `pnpm --filter @hackathon/mobile lint`：无 route boundary violation。
- [ ] `pnpm --filter @hackathon/mobile test`：全部 unit/component/integration tests 通过。
- [ ] 重跑 Plan 02—04 contract/security tests：无回归。
- [ ] 真实 iPhone 连续三次：Mock success、Live success（凭证可用时）、forced-timeout recovery。
- [ ] 关闭网络：local course/progress 全部可操作。
- [ ] 检查 SQLCipher tables：普通练习后无 transcript rows。

## 故障、回滚与降级

- LiveProvider 不可用：只切换可见 Mock mode，不改变 route/state logic。
- encrypted saved records 失败：关闭 save-record P1 UI，禁止 plaintext persistence。
- 新 mobile 需求需要 public type：停止实现，先修订 Plan 02。
- route 需要直接 SQL/network：把操作移入 Use Case，不放宽 boundary。

## 验收证据清单

- [ ] 真实 iPhone 从 first launch 到 debrief 连续完成三次。
- [ ] Mock/Live 切换只影响配置/provider，不分叉业务逻辑。
- [ ] offline course/progress 可用。
- [ ] timeout、429、mismatch、unavailable、invalid output、safety stop 都有测试 UI。
- [ ] raw transcript 默认不持久化。
- [ ] delete-all 后 database 有效且为空，installation token 已重生。

**解锁下一计划：** 验收完成后解锁 Plan 06。
