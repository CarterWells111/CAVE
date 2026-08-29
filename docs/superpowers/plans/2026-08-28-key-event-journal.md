# 内界手记（关键事件专题日记）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有旅程、沟通卡与回顾整合为本机保存的“关键事件手记”，支持自由记录、后续追加、24 小时限时修改、时间线与用户主动发起的阶段复盘。

**Architecture:** 私密正文继续只保存在现有 SQLCipher 本机数据库；后端和邮箱账户均不接收事件、卡片、回顾或日记正文。以 `JournalRecord` 为关键事件根对象，以不可覆盖的 `JournalEntry` 表示后续变化；每个对象拥有独立的 24 小时编辑窗口，超时编辑转为新增补充。现有沟通卡和回顾保留原入口，并可由用户主动复制快照到手记，不做不可逆自动迁移。

**Tech Stack:** Expo Router、React Native、TypeScript、现有 SQLCipher/Expo SQLite 数据库管理器、Jest、Testing Library、pnpm monorepo。

---

## 已锁定的产品决策

- 顶层记录单位是“关键事件”，按用户标题和发生时间查找，不强制人物、关系或地点。
- 事件必须包含标题、发生时间，以及“最大的感受”或“最深刻的印象”之一；正文和主题可选。
- 主题仅允许用户主动选择：`亲密关系`、`自我边界`、`健康性生活`；系统不得静默推断或贴标签。
- 初始事件与每条后续补充分别拥有创建后 24 小时的修改窗口。窗口由本机 UTC 时间执行，是产品规则而非防篡改证据。
- 超时后不覆盖原文；保存中的文字必须能一键转成新补充，不能丢失。
- 用户可以永久删除事件或单条补充；不提供回收站，数据库、日志和后端均不保留正文副本。
- 沟通卡进入手记时保存当时快照，后续编辑卡片不会无痕改写过去事件。
- 系统只回引原话、提示比较、协助排版；不输出成长评分、关系判断、诊断或“应该离开/继续”的结论。
- 第一版阶段复盘由用户主动发起，不做通知；后续通知必须使用中性锁屏文案。
- 与邮箱登录计划的边界：登录只管理身份/权益，手记数据默认不上传、不跨设备同步。

## 文件结构

**新增领域与应用层**

- `apps/mobile/src/features/journal/domain/journal-record.ts`：事件、补充、主题、快照和 24 小时策略类型。
- `apps/mobile/src/features/journal/domain/journal-record.test.ts`：领域规则测试。
- `apps/mobile/src/features/journal/application/journal-service.ts`：创建、修改、追加、删除、列表与阶段复盘编排。
- `apps/mobile/src/features/journal/application/journal-service.test.ts`：服务测试。
- `apps/mobile/src/features/journal/infrastructure/journal-repository.ts`：仓储接口。
- `apps/mobile/src/features/journal/infrastructure/in-memory-journal-repository.ts`：Expo Go/测试实现。
- `apps/mobile/src/features/journal/infrastructure/sql-journal-repository.ts`：SQLCipher 实现。
- `apps/mobile/src/features/journal/infrastructure/sql-journal-repository.test.ts`：迁移、事务与硬删除测试。

**新增界面与路由**

- `apps/mobile/src/features/journal/ui/JournalListScreen.tsx`：按时间排列、标题搜索和主题筛选。
- `apps/mobile/src/features/journal/ui/JournalEditorScreen.tsx`：新建事件与 24 小时内编辑。
- `apps/mobile/src/features/journal/ui/JournalDetailScreen.tsx`：事件、卡片快照和后续时间线。
- `apps/mobile/src/features/journal/ui/JournalEntryEditorScreen.tsx`：新增/限时编辑补充。
- `apps/mobile/src/features/journal/ui/JournalPeriodReviewScreen.tsx`：用户主动发起的 30 天复盘。
- `apps/mobile/app/journal/_layout.tsx`、`index.tsx`、`new.tsx`、`[id].tsx`、`[id]/add.tsx`、`review.tsx`：Expo Router 路由。

**修改现有模块**

- `apps/mobile/src/core/storage/migrations.ts`：增加 schema v8。
- `apps/mobile/src/core/storage/database.test.ts`：迁移、删除和失败回滚测试。
- `apps/mobile/src/features/journey/runtime/journey-runtime.ts`：组合 journal repository/service，并纳入删除全部本机数据。
- `apps/mobile/src/features/journey/runtime/JourneyRuntimeProvider.tsx`：向受权页面暴露 journal service，不向公共成年门禁暴露正文。
- `apps/mobile/src/features/shell/ui/HomeScreen.tsx`：增加“记下一件事”和最近手记。
- `apps/mobile/src/features/shell/ui/ProfileScreen.tsx`：增加“内界手记”入口，保留沟通卡和旧回顾。
- `apps/mobile/src/features/shell/application/app-shell-service.ts`：装配手记列表元数据。
- `apps/mobile/src/features/reviews/ui/ReviewDetailScreen.tsx`：增加“保存到内界手记”。
- `apps/mobile/src/features/shell/ui/CardDetailScreen.tsx`：增加“保存到内界手记”。
- `apps/mobile/src/features/shell/ui/SettingsScreen.tsx`：删除说明覆盖手记；删除全部数据时清空三张新表。

### Task 1：建立关键事件领域模型和 24 小时规则

- [ ] 在 `journal-record.test.ts` 先写失败测试：必填标题会 trim，空标题拒绝；`occurredAt` 可早于 `createdAt`；`editableUntil = createdAt + 24h`；截止瞬间视为锁定；事件与补充分别计算；主题去重且只接受三个白名单值。
- [ ] 运行：`pnpm --filter @cave/mobile test -- src/features/journal/domain/journal-record.test.ts --runInBand`。预期因模块不存在失败。
- [ ] 在 `journal-record.ts` 定义：

```ts
export type JournalTopic = "intimate-relationship" | "self-boundaries" | "sexual-health";
export type JournalHighlight = Readonly<{ kind: "feeling" | "impression"; text: string }>;
export type JournalEntryKind = "event-change" | "feeling-change" | "action" | "insight" | "correction";
export type JournalSource =
  | Readonly<{ kind: "freeform" }>
  | Readonly<{ kind: "journey"; journeyId: string; reviewId?: string; cardId?: string }>;
export type JournalCardSnapshot = Readonly<{ cardId: string; capturedAt: string; sections: ReadonlyArray<{ id: string; text: string }> }>;
export type JournalRecord = Readonly<{
  id: string; title: string; occurredAt: string; createdAt: string; updatedAt: string;
  editableUntil: string; highlight: JournalHighlight; body: string;
  topics: readonly JournalTopic[]; source: JournalSource; cardSnapshot: JournalCardSnapshot | null;
}>;
export type JournalEntry = Readonly<{
  id: string; recordId: string; kind: JournalEntryKind; occurredAt: string;
  createdAt: string; updatedAt: string; editableUntil: string;
  highlight: JournalHighlight | null; body: string;
}>;
export const JOURNAL_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
```

- [ ] 提供 `createJournalRecord`、`createJournalEntry`、`canEditJournalItem(now, editableUntil)` 与纯校验错误码；不使用设备时区字符串比较，全部解析 ISO UTC。
- [ ] 重跑领域测试并通过；提交：`feat(journal): define key event journal domain`。

### Task 2：增加 schema v8 与仓储实现

- [ ] 先在 `database.test.ts` 和 `sql-journal-repository.test.ts` 写失败测试，覆盖 v7→v8、重复初始化、事件与补充排序、卡片快照 round-trip、硬删除补充、删除事件级联、事务失败不产生半条记录。
- [ ] 在 `migrations.ts` 将 `CURRENT_SCHEMA_VERSION` 改为 8，并增加：

```sql
CREATE TABLE IF NOT EXISTS journal_records (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  editable_until TEXT NOT NULL,
  highlight_kind TEXT NOT NULL CHECK (highlight_kind IN ('feeling', 'impression')),
  highlight_text TEXT NOT NULL,
  body TEXT NOT NULL,
  topics_json TEXT NOT NULL,
  source_json TEXT NOT NULL,
  card_snapshot_json TEXT
);
CREATE INDEX IF NOT EXISTS journal_records_occurred_at_idx ON journal_records(occurred_at DESC);
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  record_id TEXT NOT NULL REFERENCES journal_records(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  editable_until TEXT NOT NULL,
  highlight_json TEXT,
  body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_entries_record_time_idx ON journal_entries(record_id, occurred_at, created_at);
CREATE TABLE IF NOT EXISTS journal_period_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  created_at TEXT NOT NULL,
  editable_until TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_record_ids_json TEXT NOT NULL
);
```

- [ ] 实现仓储接口：`createRecord`、`updateRecord`、`listRecords`、`loadRecord`、`deleteRecord`、`createEntry`、`updateEntry`、`deleteEntry`、`listEntries`、`savePeriodReview`、`listPeriodReviews`、`clearAll`。
- [ ] SQL 查询仅返回列表所需的标题、时间、主题与摘要；详情正文只在打开单条记录时读取。
- [ ] 在 native runtime 使用 `SqlJournalRepository`，Expo Go 使用 `InMemoryJournalRepository`；运行仓储与数据库测试并通过；提交：`feat(journal): persist encrypted journal records`。

### Task 3：实现应用服务、锁定冲突和安全删除

- [ ] 先写失败测试：创建事件、在窗口内修改、窗口后返回 `journal-item-locked`、把超时编辑内容转为 correction entry、独立补充窗口、删除不存在对象不泄露、列表按 `occurredAt DESC` 排序。
- [ ] 实现 `JournalService`，注入 `now(): string`、`createId(): string` 和仓储。所有修改必须由 service 重新读取对象并校验截止时间，不能只相信 UI 状态。
- [ ] `updateRecord`/`updateEntry` 遇到锁定时抛出结构化 `JournalServiceError("journal-item-locked")`；UI 保存草稿仍留在内存中，并可调用 `createCorrectionFromExpiredEdit` 生成新的 correction entry。
- [ ] 删除事件使用仓储事务硬删除；不得把标题或正文写入 `console`、错误文本或 telemetry。
- [ ] 将 `runtime.deleteAllData()` 扩展为清空 journal repository，并写失败回滚测试，确保任一存储删除失败时不会显示“已全部删除”。
- [ ] 运行 service、runtime 和设置删除测试；提交：`feat(journal): enforce append-only journal history`。

### Task 4：实现列表、搜索、事件编辑和详情时间线

- [ ] 使用 Testing Library 先写屏幕失败测试：空态、按时间排序、标题大小写无关包含搜索、用户主题筛选、创建必填错误、倒计时、锁定态、删除二次确认、错误不显示正文。
- [ ] `JournalListScreen` 顶部显示“内界手记”和“记下一件事”；列表卡只显示标题、发生日期、重点提要和用户主题，不显示正文。
- [ ] `JournalEditorScreen` 只要求标题、发生时间、重点类型与重点文字；正文和主题可跳过。编辑时显示绝对截止时间，不用造成压力的逐秒倒计时。
- [ ] `JournalDetailScreen` 依次显示初始事件、当时卡片快照、按时间排列的补充；固定 CTA 为“为这件事增加一个后来”。
- [ ] `JournalEntryEditorScreen` 提供五种补充方向和可跳过提示；保存时若已锁定，显示“保留文字并新增为补充”，不得清空输入框。
- [ ] 新建 Expo Router 路由并做 route-boundary 测试；未成年/公共状态不得加载 journal service 或正文。
- [ ] 运行 UI、路由、类型检查；提交：`feat(journal): add key event journal experience`。

### Task 5：连接现有旅程、沟通卡和回顾

- [ ] 先写失败集成测试：完成旅程后只出现“保存为关键事件”邀请，不自动建档；从卡片/回顾创建时保存快照；取消不会改变原卡片或回顾；再次保存同一来源需要用户确认新建而不是覆盖。
- [ ] 在 `completeInitialJourney` 返回只含本机 opaque ID 的 receipt：`{ journeyId, reviewId, cardId }`，不把正文放入路由参数。
- [ ] 完成旅程后跳转首页并显示一次性邀请；用户选择后进入 `journal/new`，由本地 repository 按 ID 读取快照。
- [ ] 在 `CardDetailScreen` 和 `ReviewDetailScreen` 增加“保存到内界手记”；系统带入内容必须标记为“由本次引导整理”，且创建前可编辑。
- [ ] 旧卡片和旧回顾不自动迁移、不删除原入口；Profile 增加“内界手记”区块并保持旧数据可访问。
- [ ] 运行 journey production flow、卡片、回顾、Profile 与 shell 集成测试；提交：`feat(journal): connect journeys cards and reviews`。

### Task 6：增加首页入口和专题日记视图

- [ ] 先写失败测试：首页“记下一件事”、最近三条手记、无正文泄露；Profile 手记入口；三个用户主题筛选；无主题记录仍出现在“全部”。
- [ ] 首页保持主 CTA 简洁：有进行中旅程时优先“继续”，否则显示“记下一件事”；最近记录只显示元数据。
- [ ] 专题视图完全基于用户确认的 topics，不运行关键词分类，也不自动把健康内容归类。
- [ ] 搜索只匹配标题；第一版不做正文全文索引，降低隐私暴露和实现复杂度。
- [ ] 运行 shell UI 与 accessibility 测试；提交：`feat(journal): surface private journal timeline`。

### Task 7：实现用户主动发起的 30 天阶段复盘

- [ ] 先写失败测试：默认最近 30 天、用户可调整日期、只引用选中的记录、零记录空态、不生成判断性句子、保存后成为独立 period review、24 小时后锁定。
- [ ] 使用本地规则生成提示而不是结论：遇到的困难、采取的做法、什么有帮助、什么没有帮助、用户如何理解变化、下次想提醒自己什么。
- [ ] 屏幕可以显示用户原话摘录，但必须由用户勾选；生成的小结正文只有用户确认后才保存。
- [ ] 禁止输出成长分数、趋势标签、关系健康判断、医疗建议和人格推断。
- [ ] 第一版不创建定时通知；只在手记列表提供“回顾最近 30 天”。
- [ ] 运行 period review 测试；提交：`feat(journal): add user-led period reflection`。

### Task 8：隐私、失败恢复、可访问性与全量验证

- [ ] 更新设置文案，明确“手记、卡片和回顾只保存在本机；删除后无法恢复；邮箱登录不会同步这些正文”。
- [ ] 增加源代码策略测试，禁止 journal 模块调用 `fetch`、gateway client、analytics payload 或 console 正文日志。
- [ ] 覆盖数据库初始化失败、保存失败、删除失败、锁定竞争、损坏 JSON、未知 schema、应用重启后窗口状态、Expo Go memory-only 提示。
- [ ] 覆盖 VoiceOver 标签、动态字体、键盘遮挡、长标题、长正文、空正文、中文/英文/emoji、未来发生时间确认和夏令时边界。
- [ ] 运行：

```powershell
pnpm --filter @cave/mobile typecheck
pnpm --filter @cave/mobile lint
pnpm --filter @cave/mobile test -- --runInBand
pnpm validate:content:internal
pnpm verify:mobile-policy
```

- [ ] 真机验收：飞行模式创建/补充/搜索/删除；重启恢复；修改系统字体；保存卡片快照；删除全部数据后数据库三表为空。
- [ ] 确认邮箱登录后 journal 网络请求仍为零；提交：`test(journal): verify privacy and release behavior`。

## 验收标准

- 用户可在 30 秒内创建仅含标题、时间和重点提要的关键事件。
- 完整旅程、沟通卡和回顾均可由用户主动保存为事件快照，原对象不被删除或覆盖。
- 事件和每条补充各自仅在创建后 24 小时内可修改；过期文字可以无损转为新补充。
- 删除立即从本机数据库硬删除，详情、搜索、错误日志和后端均不保留正文。
- 时间线按事件发生时间展示，支持标题搜索与用户确认主题筛选。
- 30 天复盘只使用用户勾选的记录，只生成问题和用户确认的小结，不生成评分或关系结论。
- Native 使用 SQLCipher；Expo Go 明确为 memory-only；邮箱账户与后端不上传手记正文。
- 全量移动端测试、类型检查、lint、内容内部校验和源代码隐私策略全部通过。

## 明确不在本计划内

- 云端日记同步、多人共享、伴侣协作、自动正文分类、全文搜索、AI 自动扫描、成长评分、关系诊断、锁屏提醒、加密备份导出。
- 上述能力必须分别完成新的隐私设计和实施计划后才能进入开发。
