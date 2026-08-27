# 05A 八页 MVP 路由、状态与本地数据框架实施计划

> 执行方式：严格按 RED → GREEN → verification → English commit。每次只实现使当前失败测试通过的最小代码，不提前填充最终页面细节。

**目标（Goal）：** 冻结八页旅程的移动端私有数据模型，建立薄路由、确定性状态变更、加密草稿持久化、恢复和上游修改后的下游同步框架。

**架构（Architecture）：** `JourneyApplicationService` 是 UI 唯一写入口；它调用纯 TypeScript `JourneyReducer` 和 builders，再通过 `JourneyDraftRepository` 原子保存。Expo routes 只读取 view model、派发 command 和导航。

**技术栈（Tech Stack）：** TypeScript strict、Expo SDK 54、Expo Router、React Context、SQLCipher SQLite、SecureStore、Jest、React Native Testing Library。

## 依赖、输入、输出与排除项

**依赖计划：** Gate 02A/02B `pass`；Plan 04 database/key/delete-all 本地 tests `pass`。
**输入：** `packages/content` catalog、`EncryptedDatabaseManager`、[八页 MVP 框架设计](../specs/2026-08-27-eight-page-mvp-framework-design.md)。
**输出：** `JourneyDraft` v1、commands/reducer/selectors、v2 database migration、repository、application service、八页 route shells、route guards、resume/back/edit/recompute。
**明确排除：** 页面完整选项、最终中文文案、医学插图、预设练习分支内容、积分展示、复制/现场展示 UI、AI/network、云端写入。
**预计时间：** 2.5—3 小时。**负责人：** 全栈工程师。

## 准确文件路径

```text
apps/mobile/app/_layout.tsx
apps/mobile/app/index.tsx
apps/mobile/app/journey/_layout.tsx
apps/mobile/app/journey/{welcome,overnight,body-knowledge,behavior-attitudes,reflection,preset-practice,checklist,communication-card}.tsx
apps/mobile/app/journey/underage-exit.tsx
apps/mobile/src/app/providers.tsx
apps/mobile/src/features/journey/domain/{types,commands,reducer,selectors,derive-checklist,derive-communication-card}.ts
apps/mobile/src/features/journey/domain/*.test.ts
apps/mobile/src/features/journey/application/{journey-application-service,journey-navigation}.ts
apps/mobile/src/features/journey/application/*.test.ts
apps/mobile/src/features/journey/infrastructure/{journey-draft-repository,sql-journey-draft-repository}.ts
apps/mobile/src/features/journey/infrastructure/*.test.ts
apps/mobile/src/features/journey/ui/{JourneyProvider,JourneyScreenShell}.tsx
apps/mobile/src/features/journey/ui/*.test.tsx
apps/mobile/src/core/storage/{migrations,types,local-data-repository}.ts
apps/mobile/src/core/privacy/delete-all-data.ts
apps/mobile/src/test/{fixtures,render}.ts
```

## 移动端私有接口冻结

以下接口由 05A 独占。05B/06 可消费，不得复制；Plan 02、03、04 的公共接口不修改。

```ts
export type JourneyPageId =
  | "welcome"
  | "overnight"
  | "body-knowledge"
  | "behavior-attitudes"
  | "reflection"
  | "preset-practice"
  | "checklist"
  | "communication-card";

export type BehaviorAttitude =
  | "looking-forward"
  | "decide-in-moment"
  | "unsure"
  | "not-this-time"
  | "skip";

export type ChecklistItemStatus = "considered" | "prepare-more" | "not-relevant";
export type JournalSaveChoice = "not-saved" | "device";
export type CloudSaveAvailability = "coming-soon";

export type EditableDerivedField = {
  generatedText: string;
  userText?: string;
  sourceRevision: number;
  needsReview: boolean;
};

export type ChecklistItem = {
  id: string;
  category: "attitude" | "expression" | "comfort" | "communication" | "logistics" | "health" | "aftercare";
  sourceIds: string[];
  status: ChecklistItemStatus;
  userNote?: string;
};

export type JourneyDraft = {
  id: string;
  schemaVersion: 1;
  currentPage: JourneyPageId;
  ageConfirmed: boolean;
  prefaceRead: boolean;
  expectationIds: string[];
  concernIds: string[];
  overnightCustomNote: string;
  readKnowledgeCardIds: string[];
  medicalDiagramOpened: boolean;
  behaviorAttitudes: Record<string, BehaviorAttitude>;
  customBehaviors: Array<{ id: string; label: string }>;
  motivationIds: string[];
  comfortNeedIds: string[];
  expressionSupportNeeded: boolean | null;
  journalSaveChoice: JournalSaveChoice;
  cloudSaveAvailability: CloudSaveAvailability;
  practice: {
    behaviorId?: string;
    intent?: string;
    selectedPhraseId?: string;
    editedPhrase?: string;
    partnerResponseBranch?: string;
    completed: boolean;
  };
  checklistItems: ChecklistItem[];
  communicationCard: Record<string, EditableDerivedField>;
  pointEventKeys: string[];
  sourceRevision: number;
  createdAt: string;
  updatedAt: string;
};

export interface JourneyDraftRepository {
  loadActive(): Promise<JourneyDraft | null>;
  saveActive(draft: JourneyDraft): Promise<void>;
  deleteActive(): Promise<void>;
}

export type SavedCommunicationCardRecord = {
  id: string;
  journeyId: string;
  card: JourneyDraft["communicationCard"];
  savedAt: string;
};

export interface CommunicationCardRepository {
  list(): Promise<SavedCommunicationCardRecord[]>;
  save(record: SavedCommunicationCardRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface JourneyApplicationService {
  getSnapshot(): JourneyDraft | null;
  confirmAdult(): Promise<void>;
  dispatch(command: JourneyCommand): Promise<void>;
  navigateTo(page: JourneyPageId): Promise<void>;
  resetJourney(): Promise<void>;
}
```

`JourneyCommand` 使用 discriminated union，每个 command 只修改一个页面拥有的原始字段。不得提供 `replaceDraft`、任意 path setter 或接受不受控 JSON 的接口。

## 任务 1：冻结 domain types 与初始草稿

- [ ] 2 分钟：创建 `types.test.ts`，用 `satisfies JourneyDraft` 写最小有效 fixture；在类型不存在时运行 `corepack pnpm --filter @cave/mobile typecheck`，预期非零。
- [ ] 3 分钟：增加编译期负例，拒绝 `ageConfirmed: "yes"`、未知 attitude、`cloud` 保存选择和 `schemaVersion: 2`。
- [ ] 4 分钟：实现 `types.ts` 中的固定类型，不添加 UI 字符串或 network 字段。
- [ ] 3 分钟：创建 `createJourneyDraft({ id, now })` 测试，预期所有 collection 为空、cloud 为 `coming-soon`、记录本保存默认为 `device`。
- [ ] 5 分钟：实现 deterministic factory；再次 typecheck，预期退出码 0。
- [ ] 2 分钟：运行 `git diff --check`，提交 `git commit -am "feat: define private journey draft model"`。

## 任务 2：Commands、reducer 与不变式

- [ ] 4 分钟：先写 reducer RED tests，覆盖 Page 2 多选/自定义文本、Page 3 read/open、Page 4 attitude/custom behavior、Page 5 reflection。
- [ ] 3 分钟：增加不变式 RED tests：空白 custom label 被拒绝、重复 ID 去重、未确认成年不能写 Page 2—8、attitude 不排序。
- [ ] 5 分钟：定义 `JourneyCommand` discriminated union 和 `JourneyDomainError`。
- [ ] 5 分钟：实现纯 reducer；禁止 import React、Expo、SQLite 或 gateway。
- [ ] 3 分钟：增加 frozen fixture 测试，证明 reducer 不修改输入对象。
- [ ] 3 分钟：运行 `corepack pnpm --filter @cave/mobile test -- --runTestsByPath src/features/journey/domain/reducer.test.ts`，预期全绿。
- [ ] 2 分钟：提交 `git commit -am "feat: add deterministic journey reducer"`。

## 任务 3：清单与沟通卡派生协议

- [ ] 4 分钟：先写 `derive-checklist.test.ts`，证明相同输入生成相同稳定 ID，行为没有进度排序，健康项只在相关规则命中时出现。
- [ ] 4 分钟：写回退修改 RED tests：仍适用 item 保留 status/note；失效 item 被移除；新 item 使用 `prepare-more` 初始状态。
- [ ] 4 分钟：先写 `derive-communication-card.test.ts`，覆盖固定 section、来源 revision、未编辑字段自动刷新。
- [ ] 4 分钟：增加用户编辑保护 RED tests：上游改变时保留 `userText`，设置 `needsReview: true`；确认复核后可清除标记。
- [ ] 5 分钟：实现 `buildChecklist` 与 `buildCommunicationCard` 的最小纯函数，所有模板只使用 fixture key，不加入终稿文案。
- [ ] 3 分钟：运行两个 builder test files，预期全绿且 snapshot 无分数/百分比字段。
- [ ] 2 分钟：提交 `git commit -am "feat: derive stable journey outputs"`。

## 任务 4：加密草稿 Repository 与 schema v2

- [ ] 3 分钟：先写 migration RED test，断言 v1 → v2 创建 `journey_drafts`，保留已有 `course_progress`、`saved_records`、`privacy_settings`。
- [ ] 4 分钟：固定 `journey_drafts` 表结构：`id TEXT PRIMARY KEY`、`schema_version INTEGER CHECK(schema_version = 1)`、`payload TEXT`、`created_at TEXT`、`updated_at TEXT`；同时创建 `journey_cards(id, journey_id, payload, saved_at)`；不得新建明文旁路数据库。
- [ ] 4 分钟：先写 repository RED tests：empty load、upsert/load round trip、invalid schema rejection、delete active、malformed payload returns typed storage error。
- [ ] 5 分钟：实现 `SqlJourneyDraftRepository`，复用 `EncryptedDatabaseManager` 连接；JSON parse 后做显式 v1 validation。
- [ ] 4 分钟：先写再实现 `SqlCommunicationCardRepository` 的 list/upsert/delete round-trip tests；card payload 使用同一加密连接。
- [ ] 3 分钟：更新 `delete-all-data.test.ts`，先证明旧实现遗留 `journey_drafts`；再把 repository 清理接入 delete-all 顺序。
- [ ] 3 分钟：运行 storage/journey repository tests，预期全绿。
- [ ] 2 分钟：提交 `git commit -am "feat: persist encrypted journey drafts"`。

## 任务 5：Application Service 原子更新与恢复

- [ ] 4 分钟：先写 RED tests：`confirmAdult` 首次创建草稿；每个 command 执行 reducer → builders → single save；save 失败时内存 snapshot 不前移。
- [ ] 4 分钟：增加 concurrent command test，要求同一 service 内顺序执行，后一次不得覆盖前一次更新。
- [ ] 3 分钟：增加 resume test，数据库已有草稿时恢复 `currentPage`；未知 schema 进入明确 recovery state，不猜测迁移。
- [ ] 5 分钟：实现 `JourneyApplicationService` 和 clock/id 依赖注入。
- [ ] 3 分钟：实现 `resetJourney()`：删除 active draft、清空内存、返回 welcome；不删除课程进度。
- [ ] 3 分钟：运行 application tests，预期全绿。
- [ ] 2 分钟：提交 `git commit -am "feat: orchestrate resumable journey state"`。

## 任务 6：八页 routes、guard 与薄页面壳

- [ ] 3 分钟：先写 route manifest test，期望八个规范 page IDs、一个 underage exit 和一个 preface overlay；不存在 tabs/course/AI 作为主演示入口。
- [ ] 4 分钟：先写 navigation RED tests：未确认成年只能访问 welcome/underage exit；已确认成年可按顺序前进并返回；恢复落在保存页。
- [ ] 5 分钟：创建 `journey/_layout.tsx` 与九个薄 route 文件，每个 route 只组合 `JourneyScreenShell` 和对应 page key。
- [ ] 4 分钟：实现 `JourneyProvider`，初始化期间显示单一 loading state；初始化失败提供 reset/retry，不显示空白页。
- [ ] 3 分钟：增加 import-boundary test，扫描 `app/journey`，遇到 `core/storage`、`core/network`、`gateway`、`ModelProvider`、raw SQL 时失败。
- [ ] 4 分钟：用 placeholder test IDs 渲染八页，验证返回按钮和 progress 文本是“第 n 页，共 8 页”，不使用准备度语言。
- [ ] 3 分钟：运行 route/ui tests，预期全绿。
- [ ] 2 分钟：提交 `git commit -am "feat: scaffold guarded eight-page journey"`。

## 任务 7：05A 新鲜验证与接口冻结

- [ ] 3 分钟：运行 `corepack pnpm --filter @cave/mobile typecheck`，预期退出码 0。
- [ ] 3 分钟：运行 `corepack pnpm --filter @cave/mobile lint`，预期无 route boundary violation。
- [ ] 5 分钟：运行 `corepack pnpm --filter @cave/mobile test`，记录 suite/test 数量，预期退出码 0。
- [ ] 3 分钟：运行 `corepack pnpm test:safety`，预期不因 journey 代码产生回归；既有已记录的 Golden evaluator blocker 不得被掩盖。
- [ ] 2 分钟：运行 `rg -n "GatewayClient|ModelProvider|/v1/practice|fetch\(" apps/mobile/app/journey apps/mobile/src/features/journey`，预期无命中并得到退出码 1。
- [ ] 2 分钟：运行 `git diff --check`，预期退出码 0。
- [ ] 3 分钟：把 Gate 05A 命令、退出码、测试数和 commits 写入总路线图。
- [ ] 2 分钟：提交 `git commit -am "docs: record journey framework evidence"`。

## 故障、回滚与降级

- v2 migration 失败：停止 UI 集成，保留 v1 数据库原样；不得删除旧表或改用明文 AsyncStorage。
- fixture 尚无最终 catalog key：使用明确的 `draft-*` ID 并让 production content validation 保持失败；不得伪造审核。
- route shell 需要领域判断：把判断移到 selector/application service，再由 route 消费 view model。
- Apple/真机仍 pending：记录 device acceptance 为 `external_pending`；本计划本地 Gate 可完成。
- 同一失败最多两轮有根因依据的修复；仍失败时记录命令、退出码和独立可继续项。

## 验收证据清单

- [ ] `JourneyDraft` v1 接口与负类型测试。
- [ ] reducer、builder、repository、application、route/ui 的 fresh test 数量。
- [ ] v1 → v2 migration 与 delete-all 证据。
- [ ] resume、underage guard、back/edit/recompute 证据。
- [ ] AI/network import scan 零命中。
- [ ] branch、HEAD、独立英文 commits 和 clean/deliberate git status。

**解锁下一计划：** Gate 05A `pass` 后解锁 Plan 05B。Plan 06 仍保持锁定。

## 执行证据（2026-08-27）

```text
Branch: codex/plan-05a-05b
Baseline: 2436773 from merged main
Commits: 43afb05, 37581ca, 62de80f, 54e2be7, 995400a, 3b5750c, d76f7a8, 0d86225
Mobile core at initial checkpoint: typecheck pass; lint pass; 19 suites / 66 tests pass
Fresh shared mobile verification after 05B hardening: typecheck pass; lint pass; 25 suites / 106 tests pass
Safety regression: 4 files / 53 tests pass
Journey AI/network scan: exit 1, zero matches
Gate 05A: in_progress — domain/reducer/builders/SQLCipher repository/application/provider shells pass, but production routes do not yet mount the provider/service composition root or consume resume/guard/back navigation
Environment blocker: standard pnpm fresh commands cannot currently restore this worktree because the host minimum-release-age policy rejects 49 entries already pinned on merged main; direct lockfile-equivalent test binaries were used without changing the lockfile
External state: Plan 04 Golden evaluator blocked; Apple/signing/real-iPhone evidence external_pending; Plan 06 and Plan 07 locked
```
