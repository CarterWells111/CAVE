# 05B 八页 MVP 基础功能实施计划

> 执行方式：以 05A 冻结接口为前提，逐页只完成可演示的基础功能。页面最终文案、插图和精细版式属于 Plan 06。

**目标（Goal）：** 用本地 catalog、预设分支和确定性规则连接八页基础交互，完成一条不调用 AI、断网可用、结果可编辑并能本机保存的 MVP 演示路径。

**架构（Architecture）：** 每页由 `JourneyPageController` 把 UI event 转成 05A command；内容来自版本化 local catalog；Page 6 使用 `PresetPracticeEngine`；Page 7/8 消费 05A builders；积分使用独立幂等 ledger selector。

**技术栈（Tech Stack）：** Expo Router、React Native、TypeScript strict、React Native Testing Library、Jest、Expo Clipboard、Plan 04 SQLCipher storage。

## 依赖、输入、输出与排除项

**依赖计划：** Gate 05A `pass`。
**输入：** 冻结的 `JourneyDraft`/commands/repositories、八页 route shells、reviewed content framework。
**输出：** 八页基础表单、draft catalog 与来源入口、预设练习、清单、沟通卡、积分、本地保存、复制和全屏展示、完整离线 integration test。
**明确排除：** 最终 copy、成品医学图、复杂动画、AI 生成、云同步、账号、真实分享链接、准备度分数。
**预计时间：** 3.5—4 小时。**负责人：** 全栈工程师；内容队友审核选项 key 与 P0 安全表述。

## 准确文件路径

```text
apps/mobile/package.json
apps/mobile/app/journey/{welcome,overnight,body-knowledge,behavior-attitudes,reflection,preset-practice,checklist,communication-card}.tsx
apps/mobile/src/features/journey/application/{page-controllers,journey-view-models,points-ledger}.ts
apps/mobile/src/features/journey/application/*.test.ts
apps/mobile/src/features/journey/domain/{preset-practice-engine,practice-types}.ts
apps/mobile/src/features/journey/domain/*.test.ts
apps/mobile/src/features/journey/infrastructure/{journey-content-catalog,journey-source-catalog}.ts
apps/mobile/src/features/journey/infrastructure/*.test.ts
apps/mobile/src/features/journey/ui/pages/{WelcomePage,OvernightPage,BodyKnowledgePage,BehaviorAttitudesPage,ReflectionPage,PresetPracticePage,ChecklistPage,CommunicationCardPage}.tsx
apps/mobile/src/features/journey/ui/pages/*.test.tsx
apps/mobile/src/features/journey/ui/components/{ChoiceGroup,SourceSheet,CloudComingSoon,FullscreenPauseCard}.tsx
apps/mobile/src/features/journey/ui/components/*.test.tsx
apps/mobile/src/features/journey/__tests__/eight-page-flow.integration.test.tsx
packages/content/data/{journey-options,journey-knowledge,journey-practice,journey-sources}.json
packages/content/src/{catalog,validate}.ts
packages/content/src/*.test.ts
```

若 `expo-clipboard` 尚未存在，只通过 `corepack pnpm --filter @cave/mobile add expo-clipboard@~57.0.1` 安装与 SDK 57 对齐的版本，并提交 lockfile。不得为了 copy action 引入通用 share/analytics SDK。

## 05B 消费的固定功能接口

```ts
export type PracticeIntent =
  | "slow-down"
  | "adjust-touch"
  | "pause-and-decide"
  | "stop-current-action"
  | "choose-another-closeness"
  | "pause-to-feel";

export type PartnerResponseBranch =
  | "supportive"
  | "disappointed-follow-up"
  | "ignores-pause";

export type PointEvent = {
  key: string;
  kind: "learning" | "reflection" | "practice" | "review";
  points: number;
};

export interface PresetPracticeEngine {
  start(input: { behaviorId: string; intent: PracticeIntent }): PresetPracticeState;
  selectPhrase(state: PresetPracticeState, phraseId: string): PresetPracticeState;
  choosePartnerResponse(
    state: PresetPracticeState,
    branch: PartnerResponseBranch
  ): PresetPracticeState;
}
```

Page 7/8 不新增第二套生成器，必须调用 05A 的 `buildChecklist()` 与 `buildCommunicationCard()`。Page controller 不得写任意 draft path。

## 任务 1：八页 local catalog 与生产校验

- [ ] 3 分钟：先写 content RED tests，要求四个 JSON catalog 可加载、ID 唯一、顺序显式、引用的 `sourceIds` 存在。
- [ ] 3 分钟：增加规则测试：behavior catalog 不含 level/rank/progress 字段；知识卡和健康项至少一个 source ID；practice response 明确 `scripted: true`。
- [ ] 4 分钟：创建最小 draft catalogs，只提供页面运行所需 key、短占位说明和来源 metadata，不制作最终长文案。
- [ ] 4 分钟：扩展 content validator，production 模式拒绝未审核条目；内容负责人未批准时保持 `content_review_pending`。
- [ ] 3 分钟：运行 `corepack pnpm test:content` 和 `corepack pnpm validate:content:draft`，预期 tests/草稿校验退出码 0。
- [ ] 2 分钟：提交 `git commit -am "content: add eight-page journey catalogs"`。

## 任务 2：Page 1 成年确认与恢复入口

- [ ] 3 分钟：先写 component RED tests：确认18岁以上后创建草稿；未满18岁跳转温和退出；不收集生日；短笺可读/可跳过。
- [ ] 3 分钟：增加 resume RED test：已有 active draft 时显示“继续”与“重新开始”，重新开始必须二次确认。
- [ ] 5 分钟：实现 `WelcomePage`、preface overlay 与 controller commands。
- [ ] 3 分钟：验证未成年路径对 `JourneyDraftRepository.saveActive` 调用次数为 0。
- [ ] 2 分钟：提交 `git commit -am "feat: add adult journey entry"`。

## 任务 3：Page 2 期待与在意

- [ ] 3 分钟：先写 RED tests：期待/在意分别多选，自定义文本可空，情境不预设发生性行为。
- [ ] 3 分钟：增加返回修改 test，移除选项后保存新集合并提升 `sourceRevision`。
- [ ] 4 分钟：实现两个 `ChoiceGroup` 与有长度上限的可选补充输入；页面不显示分数。
- [ ] 3 分钟：验证点击继续只派发 page-owned commands，不直接写 repository。
- [ ] 2 分钟：提交 `git commit -am "feat: capture overnight expectations"`。

## 任务 4：Page 3 身体知识与来源

- [ ] 3 分钟：先写 RED tests：医学图示默认折叠、主动展开、三类知识卡可分别标记阅读、来源入口可达。
- [ ] 3 分钟：先写 source resolution test，任何缺失 source ID 使 catalog test 失败。
- [ ] 4 分钟：实现使用占位图框的 `BodyKnowledgePage` 和 `SourceSheet`；占位框必须明确“医学图示将在内容完善阶段替换”。
- [ ] 3 分钟：阅读事件通过幂等 key `learning:<cardId>:v1` 计分；重复展开/进入不重复记分。
- [ ] 2 分钟：提交 `git commit -am "feat: add sourced body knowledge flow"`。

## 任务 5：Page 4 行为态度

- [ ] 4 分钟：先写 RED tests，逐项覆盖五个固定态度值、暂时不回答、自定义行为添加/删除和返回修改。
- [ ] 3 分钟：增加无层级 test：改变 catalog 顺序不会改变任何 attitude 值，也不生成总分、百分比或 `readiness` 字段。
- [ ] 5 分钟：实现行为卡和单项 attitude selector；不以颜色或位置暗示更好选择。
- [ ] 3 分钟：自定义行为使用安装内稳定 UUID，空白/重复 label 在 controller 层拒绝。
- [ ] 2 分钟：提交 `git commit -am "feat: record non-ranked behavior attitudes"`。

## 任务 6：Page 5 反思与本地保存说明

- [ ] 3 分钟：先写 RED tests：动机/安心条件多选、表达支持三态、加入记录本选择。
- [ ] 3 分钟：增加 privacy test：默认 `device` 并解释本机加密保存；用户可改为 `not-saved`；cloud 卡固定 disabled 和 `coming-soon`。
- [ ] 4 分钟：实现 `ReflectionPage` 与 `CloudComingSoon`；任何操作不得触发 fetch 或生成 cloud identifier。
- [ ] 3 分钟：完成反思时记录 `reflection:page-5:v1`，选择内容和文字长度不影响分值。
- [ ] 2 分钟：提交 `git commit -am "feat: add local-only reflection choices"`。

## 任务 7：Page 6 预设情境练习

- [ ] 4 分钟：先写 engine RED tests：只从已选择 behavior 产生入口；六个 intent 均映射到版本化 phrase IDs；非法 branch 被拒绝。
- [ ] 3 分钟：增加安全 RED tests：`ignores-pause` 分支只能进入安全结束/资源提示，不产生继续推进的 scripted response。
- [ ] 4 分钟：实现纯 `PresetPracticeEngine`，输出始终包含 `scripted: true` 和 catalog version；禁止 import gateway/fetch。
- [ ] 4 分钟：先写 component RED tests：页面可见“预设对话”；采用句子、编辑表达、对镜练习和全屏暂停卡可达。
- [ ] 4 分钟：实现 supportive、disappointed-follow-up、ignores-pause 三类分支；后两类必须由用户主动进入。
- [ ] 3 分钟：完成事件 key 为 `practice:<scenarioId>:<catalogVersion>`，重复演练不重复计分。
- [ ] 2 分钟：提交 `git commit -am "feat: add transparent preset boundary practice"`。

## 任务 8：Page 7 确定性准备清单

- [ ] 3 分钟：先写 page RED tests：显示由 Page 2/4/5/6 生成的条目，每项支持 `considered`、`prepare-more`、`not-relevant` 与补充文字。
- [ ] 3 分钟：增加 conditional health tests：只有与所选行为的本地规则相关时显示健康模块；规则不推断疾病、怀孕或实际性行为。
- [ ] 4 分钟：实现 `ChecklistPage`，说明清单不是必须全部勾选的通关表。
- [ ] 3 分钟：返回 Page 4 改动后验证稳定条目保留状态，新/移除条目符合 05A builder tests。
- [ ] 3 分钟：完成回顾事件 key 为 `review:checklist:v1`，条目状态不影响分值。
- [ ] 2 分钟：提交 `git commit -am "feat: connect editable preparation checklist"`。

## 任务 9：Page 8 沟通卡、本机保存、复制与展示

- [ ] 3 分钟：先写 RED tests：固定六个 section、可见“根据妳刚才的选择整理”、字段可编辑、`needsReview` 有明确提示。
- [ ] 3 分钟：增加 local save RED test：只有用户点击保存才写 `CommunicationCardRepository`；重复保存同一 card ID 为 upsert。
- [ ] 3 分钟：增加 clipboard RED tests：只复制当前可见 card；取消/失败显示可恢复状态，不进入 analytics。
- [ ] 3 分钟：增加 fullscreen display test：隐藏编辑控件但不隐藏暂停/确认内容，退出后返回原编辑状态。
- [ ] 5 分钟：安装并封装 `expo-clipboard`，实现 `CommunicationCardPage` 的 edit/save/copy/display actions。
- [ ] 3 分钟：显示探索积分总计和已完成任务；断言开放态度、私密文字长度、保存/复制/展示均不产生积分。
- [ ] 2 分钟：提交 `git commit -am "feat: finish local communication card"`。

## 任务 10：完整流程、离线和数据删除

- [ ] 5 分钟：先写 `eight-page-flow.integration.test.tsx`，完成 adult confirm → Page 2—8 → save card → restart/resume。
- [ ] 4 分钟：增加 back-edit-recompute test：Page 8 返回 Page 4 修改，自动字段更新，用户编辑字段保留并标复核。
- [ ] 3 分钟：增加 offline test：mock global fetch 抛错，八页 P0 流程仍完整，fetch 调用次数为 0。
- [ ] 3 分钟：增加 delete-all test：active draft、saved cards 和 point ledger 清空，course progress/既有 privacy 行为遵循 Plan 04 定义。
- [ ] 4 分钟：实现缺失 glue code，只修使 tests 通过的最小范围。
- [ ] 2 分钟：提交 `git commit -am "test: verify offline eight-page journey"`。

## 任务 11：05B 新鲜验证

- [ ] 3 分钟：运行 `corepack pnpm --filter @cave/mobile typecheck`，预期退出码 0。
- [ ] 3 分钟：运行 `corepack pnpm --filter @cave/mobile lint`，预期退出码 0。
- [ ] 5 分钟：运行 `corepack pnpm --filter @cave/mobile test`，记录 suites/tests，预期退出码 0。
- [ ] 4 分钟：运行 `corepack pnpm test:content` 与 `corepack pnpm validate:content:draft`，预期退出码 0；另运行 production validation，未审核内容预期非零并真实标记 `content_review_pending`，由 Plan 06 关闭。
- [ ] 2 分钟：运行 `rg -n "GatewayClient|ModelProvider|/v1/practice|fetch\(" apps/mobile/app/journey apps/mobile/src/features/journey`，预期无命中、退出码 1。
- [ ] 2 分钟：运行 `rg -n "readiness|score|percentage|cloudEnabled" apps/mobile/src/features/journey apps/mobile/app/journey`，预期无命中、退出码 1。
- [ ] 3 分钟：运行 `corepack pnpm test:safety` 与 `git diff --check`，记录真实结果。
- [ ] 3 分钟：把 Gate 05B 证据、commits 和外部待办写入总路线图。
- [ ] 2 分钟：提交 `git commit -am "docs: record eight-page function evidence"`。

## 故障、回滚与降级

- 最终医学图未就绪：保留可访问占位框和已审核三条核心知识；不得使用未经确认的生成图充当医学成品。
- `expo-clipboard` 版本不兼容：隐藏 copy P1 action，保留本地保存和现场展示；不得使用未经审核的原生模块。
- 内容审核未完成：draft validation 可通过，production validation 保持 `content_review_pending`；功能测试使用明确 draft fixture。
- 预设分支缺少安全文案：该分支不进入可选 catalog，`ignores-pause` 仍必须终止普通流程。
- 真机不可用：记录 `external_pending`，完成 Jest/模拟器范围；不得以 Expo Go 代替 SQLCipher/签名验收。
- 同一错误两轮后仍失败：记录命令、退出码、根因和独立已完成项，不删除测试或放宽断言。

## 验收证据清单

- [ ] 八页各自 component/controller tests 和 full-flow integration test 数量。
- [ ] 本地 catalog validation 与 source ID 证据。
- [ ] Page 6 `scripted: true`、无 Gateway/AI import 的扫描结果。
- [ ] Page 7/8 back-edit-recompute 和 user edit preservation 证据。
- [ ] points independence、offline zero-fetch、local save/delete-all 证据。
- [ ] content review、真机与 Apple 依赖的真实状态；内容待审不冒充 Gate 05B 技术失败。
- [ ] branch、HEAD、独立英文 commits 与 git status。

**解锁下一计划：** Gate 05B 与 Plan 05 联合 Gate 的本地部分通过后解锁 Plan 06；发布前仍需补齐真实 iPhone 验收。
