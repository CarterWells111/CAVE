# 05C Expo Go 演示运行时装配实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 05A/05B 已完成的八屏领域核心、repository、controller 与基础页面真正装配到 Expo Router，使 Expo Go 可用无落盘内存模式完整演示，同时保持 Development/Preview 只走 SQLCipher + SecureStore 的不可降级路径。

**Architecture:** `JourneyRuntimeComposition` 是唯一装配入口，以 Expo SDK 54 `Constants.executionEnvironment` 区分 Expo Go `storeClient` 与 Development/Preview。Expo Go 创建生命周期稳定的 in-memory draft/card repositories，并持续显示临时数据提示；Development/Preview 创建真实 Expo SQLite SQLCipher、SecureStore、clipboard adapters，任何原生初始化失败都进入可见错误状态而不回退内存。`JourneyProvider` 持有 service snapshot，route hooks 统一执行 controller command、刷新 snapshot、持久化当前页并应用 guard。

**Tech Stack:** Expo SDK 54、Expo Router 6、React Native 0.81、TypeScript strict、Jest、React Native Testing Library、`expo-constants`、`expo-sqlite`、`expo-secure-store`、`expo-clipboard`、`expo-file-system`。

**当前状态（2026-08-27）：** Gate 05C local `pass`；PR #7 已创建且 CI `pass`；native device evidence `external_pending`。Expo Go `storeClient` 选择不落盘的 `memory-only` runtime，Development/Preview 只装配 SQLCipher + SecureStore 且失败不降级，provider/guard/resume/back/reset、Page 1—8 生产 route 与恢复表单已接线，根入口显式跳转“进入八屏演示”。

**勾选规则：** 下方 `[x]` 只表示当前 source tree 可直接观察的测试/实现/依赖或入口；RED/GREEN 命令、完整回归、提交、CI 与 PR 在获得 fresh evidence 前保持 `[ ]`。

---

## 已批准边界与真实状态

- 基线为 `origin/main@faffd0544b89a5562d16e1f9dac3ef02595c1c37`，包含已合并的 05A/05B PR #6；不重做已提交领域能力。
- Expo Go 不得触发 SQLCipher、SecureStore、file adapter 或网络；repository 只保存当前 JS runtime 内的 clone。
- Development/Preview 不允许降级为内存或明文 SQLite；SQLCipher 插件与 SecureStore key lifecycle 保持现有实现。
- Page 1—8 不调用 `GatewayClient`、`ModelProvider`、`fetch` 或 Worker routes；云保存保持 disabled `coming-soon`。
- `content_review_paused/draft`：23 条 journey fixtures 保持 draft，不新增或修改 `reviewedAt`，production validation 预期仍为非零。
- Apple、签名、Development/Preview 真机 SQLCipher 与 cold-start delete-all 证据保持 `external_pending`；Expo Go 不能替代这些证据。
- Plan 04 Golden evaluator 保持 `blocked`，但不进入八页 runtime，也不阻塞本计划 Expo Go 演示验收。

## 文件职责锁定

**Create**

- `apps/mobile/src/features/journey/infrastructure/in-memory-journey-repositories.ts`：进程内 draft/card repositories；读写均 clone，reset 清空当前实例。
- `apps/mobile/src/features/journey/infrastructure/expo-journey-adapters.ts`：仅供 native Development/Preview composition 动态加载的 SQLite、file、SecureStore 与 clipboard adapters。
- `apps/mobile/src/features/journey/runtime/journey-runtime.ts`：runtime mode 判定、依赖集合、clock/id、in-memory/native composition factory。
- `apps/mobile/src/features/journey/runtime/JourneyRuntimeProvider.tsx`：实例生命周期、`JourneyProvider` 挂载、controller/action/navigation context 与演示模式提示。
- `apps/mobile/src/features/journey/ui/JourneyRouteScreen.tsx`：共享 route guard、back/next current-page persistence 和 shell composition。
- `apps/mobile/src/features/journey/journey-production-flow.integration.test.tsx`：真实 provider/controller/pages 的 Page 1→8、underage、resume、back-edit-recompute、reset、clipboard failure 与 offline 流程。
- 与上述模块同目录的 `*.test.ts(x)`：runtime isolation、stable lifecycle、native no-fallback、guard/navigation/action-state contracts。

**Modify**

- `apps/mobile/package.json`、`pnpm-lock.yaml`：通过 Expo CLI 安装 SDK 54 兼容的 `expo-clipboard@~8.0.8` 与对齐版 `expo-file-system`。
- `apps/mobile/app/index.tsx`：所有 composition tests 通过后，替换 HealthScreen 为显式“进入八屏演示”入口。
- `apps/mobile/app/journey/_layout.tsx`：挂载唯一 `JourneyRuntimeProvider`，保证 service/controller/repositories 只创建一次。
- `apps/mobile/app/journey/*.tsx`：删除硬编码 props/no-op；只从 runtime snapshot/controller 读取和派发。
- `apps/mobile/src/features/journey/application/page-controllers.ts`：补齐 diagram、正向导航、reset 与 clipboard typed result；不直接 import Expo 模块。
- `apps/mobile/src/features/journey/ui/JourneyProvider.tsx`：公开统一 `runAndRefresh`，异步 command 完成后刷新 snapshot。
- `apps/mobile/src/features/journey/ui/pages/JourneyPages.tsx`：加入初始表单值和结构化 action status；不做最终视觉或长文案。
- `apps/mobile/src/features/journey/ui/route-boundary.test.ts`：把 HealthScreen 临时门槛改为完整 composition/no-noop/入口门槛。
- Plan 05 与 master roadmap：登记 05C、fresh evidence 与 pending 状态。

## Task 1：Runtime mode 与 in-memory repositories

- [x] **Step 1: 写 RED contracts**

  在 `in-memory-journey-repositories.test.ts` 断言 round-trip clone、card upsert、delete/reset；在 `journey-runtime.test.ts` 断言 `storeClient` 选择 `expo-go-demo`，且 factory 未调用 `createNativeRuntime`。

  ```ts
  expect(resolveJourneyRuntimeMode("storeClient")).toBe("expo-go-demo");
  const runtime = createJourneyRuntime({ executionEnvironment: "storeClient", createNativeRuntime });
  expect(createNativeRuntime).not.toHaveBeenCalled();
  expect(runtime.persistence).toBe("memory-only");
  ```

- [x] **Step 2: 运行 RED 并确认只因模块缺失而失败**

  ```powershell
  corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/infrastructure/in-memory-journey-repositories.test.ts src/features/journey/runtime/journey-runtime.test.ts
  ```

- [x] **Step 3: 实现最小 contract**

  ```ts
  export type JourneyRuntimeMode = "expo-go-demo" | "native-secure";
  export type JourneyRuntime = {
    mode: JourneyRuntimeMode;
    persistence: "memory-only" | "sqlcipher-secure-store";
    service: DefaultJourneyApplicationService;
    controller: JourneyPageController;
  };
  ```

  repository 的 `load/list/save` 返回 `structuredClone`，禁止 AsyncStorage、SQLite、SecureStore 或文件 API。

- [x] **Step 4: 运行 Step 2 得到 GREEN，并回归完整 mobile test。**
- [x] **Step 5: 提交 `feat(mobile): define isolated journey runtimes`。**

## Task 2：Development/Preview secure composition 与 Clipboard

- [x] **Step 1: 用官方 Expo 命令安装锁定模块**

  ```powershell
  corepack pnpm --filter @cave/mobile exec expo install expo-clipboard expo-file-system
  ```

  Expected: `expo-clipboard` 为 SDK 54 推荐 `~8.0.8`，Expo Doctor 不报告版本偏差。

- [x] **Step 2: 写 native RED tests**

  测试 native factory 注入 `openDatabaseAsync`、`deleteDatabaseAsync`、SecureStore adapter、32-byte random source 和 Clipboard adapter；SQLCipher/SecureStore 初始化失败时 rejection 向上冒泡且 memory factory 调用次数为 0。

  ```ts
  await expect(createNativeSecureJourneyRuntime(failingDeps)).rejects.toThrow();
  expect(createInMemoryRuntime).not.toHaveBeenCalled();
  ```

- [x] **Step 3: 运行 RED**

  ```powershell
  corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/runtime/journey-runtime.test.ts src/features/journey/infrastructure/expo-journey-adapters.test.ts
  ```

- [x] **Step 4: 实现动态 native adapter 边界**

  `journey-runtime.ts` 顶层只 import types；`storeClient` 分支在任何 `expo-sqlite`/`expo-secure-store` loader 前返回内存 runtime。native branch 使用 `createEncryptedDatabaseManager`、`SqlJourneyDraftRepository`、`SqlCommunicationCardRepository`、`createSecretRepository` 和 `Clipboard.setStringAsync`；禁止 catch 后创建内存 repository。

- [x] **Step 5: 运行 Step 3、mobile typecheck 和 Expo dependency contract 得到 GREEN。**
- [x] **Step 6: 提交 `feat(mobile): compose secure native journey storage`。**

## Task 3：稳定 Provider、route guard、resume/back/reset

- [x] **Step 1: 写 provider/navigation RED tests**

  用 rerender 断言 composition factory 只调用一次；`runAndRefresh` 在 command 后更新 snapshot；无成年 draft 访问 Page 2—8 时 replace 到 welcome；恢复 draft 时 welcome 的继续按钮 replace 到 `getResumePath(snapshot)`；back 先保存 previous page 再导航；restart 二次确认后 reset 并回 welcome。

- [x] **Step 2: 运行 RED**

  ```powershell
  corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/runtime/JourneyRuntimeProvider.test.tsx src/features/journey/ui/JourneyRouteScreen.test.tsx
  ```

- [x] **Step 3: 实现 provider/context**

  ```ts
  type JourneyRuntimeContextValue = {
    mode: JourneyRuntimeMode;
    snapshot: JourneyDraft | null;
    controller: JourneyPageController;
    runAndRefresh<T>(action: () => Promise<T>): Promise<T>;
    restart(): Promise<void>;
  };
  ```

  使用 ref-guarded effect 保证实例稳定（包括 React StrictMode effect replay）；Expo Go ready state 持续渲染“Expo Go 演示模式，数据仅在本次打开期间暂存”。native 初始化失败显示 structured error，绝不改 mode。

- [x] **Step 4: 实现 `JourneyRouteScreen` guard/back/next**：每次 navigation 先 `service.navigateTo(page)`；redirect 期间不渲染受保护表单。
- [x] **Step 5: 运行 Step 2 得到 GREEN。**
- [x] **Step 6: 提交 `feat(mobile): mount guarded journey composition`。**

## Task 4：Page 1—5 snapshot/controller 接线与表单恢复

- [x] **Step 1: 写 route/page RED tests**

  覆盖成年确认创建 draft、未成年无 repository write、preface read、Page 2 初始多选/文本 hydration、Page 3 diagram/read、Page 4 attitude hydration、Page 5 reflection/save-choice hydration，以及每页继续后的 persisted current page。

- [x] **Step 2: 运行 RED**

  ```powershell
  corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/ui/pages/JourneyPages.test.tsx src/features/journey/journey-production-flow.integration.test.tsx
  ```

- [x] **Step 3: 扩展最小 initial props**：Page 2 接收三个现有值，Page 4 接收 current attitudes，Page 5 接收当前 reflection fields；只在 draft identity/sourceRevision 变化时恢复，不在输入期间覆盖。
- [x] **Step 4: 替换 Page 1—5 route no-op**：只调用 `controller` 与 `runAndRefresh`；Page 3 source UI 只读 local catalog；成年确认成功才进入 Page 2。
- [x] **Step 5: 运行 GREEN 和 no-op scan**

  ```powershell
  rg -n "=>\s*(undefined|\{\s*\})" apps/mobile/app/journey
  ```

  Expected: production callback 零命中（rg exit 1）。

- [x] **Step 6: 提交 `feat(mobile): connect journey pages one through five`。**

## Task 5：Page 6—8、重算、积分、保存/复制/展示

- [x] **Step 1: 写 RED tests**

  真实 controller + provider 覆盖 preset engine、checklist edit、Page 4 back-edit 后 checklist/card 重算、积分幂等、Page 8 user text preservation、explicit card save、fullscreen、clipboard success/failure。

  ```ts
  clipboard.setStringAsync.mockRejectedValueOnce(new Error("denied"));
  fireEvent.press(screen.getByText("复制当前卡片"));
  expect(await screen.findByText("复制失败，请重试")).toBeTruthy();
  ```

- [x] **Step 2: 运行 RED**

  ```powershell
  corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/application/page-controllers.test.ts src/features/journey/journey-production-flow.integration.test.tsx
  ```

- [x] **Step 3: 实现真实接线**：Page 6 只用已选 behavior + catalog phrase + `LocalPresetPracticeEngine`；Page 7 映射 snapshot checklist；Page 8 映射六 section 和 `getPointSummary`。
- [x] **Step 4: 实现 clipboard structured state**

  ```ts
  type ClipboardActionState =
    | { status: "idle" }
    | { status: "pending" }
    | { status: "success" }
    | { status: "error"; code: "clipboard-write-failed" };
  ```

- [x] **Step 5: 运行 Step 2 和完整 mobile tests 得到 GREEN；重复动作不增加积分。**
- [x] **Step 6: 提交 `feat(mobile): complete local journey actions`。**

## Task 6：Production route contract 与根入口切换

- [x] **Step 1: 写最终入口 RED test**

  `route-boundary.test.ts` 断言八个 route 无 no-op/hard-coded derived data、layout 挂 provider、Expo Go branch 不加载 secure native adapters、root 显式进入 `/journey/welcome`、HealthScreen 不再是默认入口。

- [x] **Step 2: 运行 RED**

  ```powershell
  corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/ui/route-boundary.test.ts src/features/journey/journey-production-flow.integration.test.tsx
  ```

  Expected: root 仍是 HealthScreen，测试失败。

- [x] **Step 3: 仅在 Tasks 1—5 全绿后切换入口**：`apps/mobile/app/index.tsx` 渲染最小“进入八屏演示”按钮并跳转 welcome；不做 Plan 06 最终视觉。
- [x] **Step 4: 运行 GREEN、offline 与边界 scans**

  ```powershell
  corepack pnpm --filter @cave/mobile test
  rg -n "GatewayClient|ModelProvider|/v1/practice|fetch\(" apps/mobile/app/journey apps/mobile/src/features/journey
  rg -n "=>\s*(undefined|\{\s*\})" apps/mobile/app/journey
  ```

  Expected: tests exit 0；两项 scan 零命中、rg exit 1。

- [x] **Step 5: 提交 `feat(mobile): expose the eight-page demo entry`。**

## Task 7：Fresh verification、证据与 PR

> 本地 Gate 已由主代理新鲜运行；PR/CI URL 在 push 后回填。真机证据仍单独保持 `external_pending`。

- [x] **Step 1: 运行完整本地 Gate**

  ```powershell
  corepack pnpm --filter @cave/mobile typecheck
  corepack pnpm --filter @cave/mobile lint
  corepack pnpm --filter @cave/mobile test
  corepack pnpm test:content
  corepack pnpm validate:content:draft
  corepack pnpm test:safety
  corepack pnpm --filter @cave/mobile expo:doctor
  git diff --check
  ```

  Expected: 全部 exit 0；记录 suite/test 数量和 Expo Doctor checks。

- [x] **Step 2: 保留 production content 的真实 draft 状态**

  ```powershell
  corepack pnpm validate:content
  ```

  Expected: exit 1，只报告既有 23 条 journey `DRAFT_CONTENT`；记录 `content_review_paused/draft`，不得修改 fixture 或 `reviewedAt`。

- [x] **Step 3: 运行敏感边界检查**

  ```powershell
  rg -n "GatewayClient|ModelProvider|/v1/practice|fetch\(" apps/mobile/app/journey apps/mobile/src/features/journey
  rg -n "AsyncStorage|unencrypted|useSQLCipher:\s*false" apps/mobile/app apps/mobile/src/features/journey
  rg -n "expo-sqlite|expo-secure-store" apps/mobile/src/features/journey/infrastructure/in-memory-journey-repositories.ts
  git status --short
  ```

- [x] **Step 4: 更新 Plan 05、05C 与 master roadmap**：记录 local Gate、commit、CI/PR URL；Apple/签名/SQLCipher 真机 `external_pending`，Plan 04 Golden evaluator `blocked`，内容 `content_review_paused/draft`。
- [x] **Step 5: 提交 `docs: record Expo Go journey composition evidence`。**
- [x] **Step 6: push 并创建 PR**

  ```powershell
  git push -u origin codex/plan-05c-expo-go-demo
  gh pr create --base main --head codex/plan-05c-expo-go-demo --title "feat(mobile): compose Expo Go eight-page demo"
  ```

  不执行 `gh pr merge`。

## 最终验收矩阵

| 行为 | Expo Go | Development/Preview | 自动化证据 |
|---|---|---|---|
| Draft/card repository | in-memory only | SQLCipher + SecureStore only | mode、no-native-call、no-fallback tests |
| 数据提示 | 持续可见临时数据提示 | 本机安全存储说明 | provider/page tests |
| Page 1—8 | 完整可操作 | 同一 UI/controller | production flow integration |
| underage | 不创建/保存 draft | 不创建/保存 draft | repository call-count test |
| resume/restart/guard/back | 当前 session 内有效 | encrypted active draft | route/provider tests |
| upstream recompute | deterministic | deterministic | back-edit integration |
| points | 幂等且不读敏感选择 | 同左 | ledger/controller tests |
| clipboard | `expo-clipboard`；失败可见 | 同左 | adapter/page failure tests |
| offline | 0 fetch | 0 fetch | global fetch sentinel |
| native security evidence | 不作 SQLCipher 声称 | code/tests complete；device `external_pending` | docs + native unit tests |

## 实现检查点（2026-08-27，非最终 Gate）

```text
Branch: codex/plan-05c-expo-go-demo
Implementation observed: Expo Go memory-only runtime; Development/Preview SQLCipher + SecureStore composition with no memory fallback; stable runtime/provider lifecycle; route guard/resume/back/reset; recovered Page 1—8 props/actions; explicit root entry to /journey/welcome
Content state: content_review_paused/draft — 23 journey fixtures remain draft; reviewedAt unchanged
Plan 04 dependency: Golden evaluator remains blocked; it is not imported by the eight-page runtime and does not block the Expo Go demo, but still blocks Plan 07/release
Native evidence: Apple membership/signing, Development/Preview installation, real-iPhone SQLCipher/no-key and cold-start delete-all remain external_pending
Final local Gate: PASS — mobile typecheck/lint exit 0；workspace 65 files / 399 tests（mobile 38 suites / 172 tests）；content 3 files / 19 tests；draft validation 1 course / 1 lesson / 3 scenarios；safety 4 files / 53 tests；Expo Doctor 18/18；diff check exit 0
Production content: expected exit 1 with exactly 23 DRAFT_CONTENT entries and no other category；content_review_paused/draft；reviewedAt unchanged
Boundary scans: production journey no no-op callback、GatewayClient、ModelProvider、fetch、AsyncStorage、unencrypted mode、useSQLCipher false；Expo Go in-memory repository has no SQLite/SecureStore import
Implementation/docs commits: `725dcb9`, `b852f42`, `1a8600b`, `d88d927`, `3336a5d`, `50ec3f0`, `ac289a0`, `421e60a`, `39663cc`, `a09bd4b`
CI/PR: PR #7 `https://github.com/CarterWells111/CAVE/pull/7` open；CI pass `https://github.com/CarterWells111/CAVE/actions/runs/33073504107`；未合并 main
```

## 计划自检

- Spec coverage：固定决策 1—7 与验收项均映射到 Tasks 1—7。
- Placeholder scan：无 TBD/TODO/“稍后实现”。
- Type consistency：runtime mode、persistence、clipboard state 和 context signatures 在首次定义后保持一致。
- Scope check：不修改最终视觉、医学插图或长文案；不触碰 Gateway/ModelProvider；不尝试内容审核或 main merge。
