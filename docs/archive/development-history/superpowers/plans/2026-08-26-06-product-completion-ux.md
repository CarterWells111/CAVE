# 06 八页产品细节与体验完善实施计划

> 本计划在八页 MVP 框架和基础功能已经稳定后执行。只完善内容、表现和可访问性，不改变 05A 冻结的 journey/domain/repository 接口。

**目标（Goal）：** 把基础八页闭环收口成内容可信、状态完整、视觉一致、可由 VoiceOver 完成的主演示体验。

**架构（Architecture）：** reviewed local catalogs 提供最终文字与来源；design tokens 和 reusable primitives 统一呈现；医学图示由带 metadata 的受控 asset manifest 装配；页面继续只消费 05A/05B view models。

**技术栈（Tech Stack）：** Expo/React Native、Expo Router、React Native SVG、semantic design tokens、React Native Testing Library、VoiceOver 真机测试。

## 依赖、输入、输出与排除项

**依赖计划：** Gate 05A/05B `pass`。
**输入：** 可运行八页闭环、内容队友审核稿、来源清单、医学图示候选资产。
**输出：** 最终内容装配、医学图示、设计系统、全状态 UI、沟通卡版式、披露、Dynamic Type/VoiceOver 证据。
**明确排除：** 修改 `JourneyDraft`、新增 public API、AI、云同步、账号、CMS、社区、商城、赞助商 runtime fork。
**预计时间：** 5 小时。**负责人：** 两人共同；队友拥有内容审核，工程师拥有实现与验证。

## 准确文件路径

```text
apps/mobile/src/config/brand.ts
apps/mobile/src/core/design/{tokens,theme,motion}.ts
apps/mobile/src/core/ui/{Screen,Card,Button,ChoiceChip,ProgressHeader,StatusBanner,EmptyState,ErrorState}.tsx
apps/mobile/src/core/ui/*.test.tsx
apps/mobile/src/features/journey/ui/pages/*.tsx
apps/mobile/src/features/journey/ui/pages/*.test.tsx
apps/mobile/src/features/journey/ui/components/*.tsx
apps/mobile/src/features/journey/ui/components/*.test.tsx
packages/content/data/{journey-options,journey-knowledge,journey-practice,journey-sources}.json
packages/content/assets/body-knowledge/*
packages/content/assets/manifest.json
packages/content/src/{catalog,validate}.ts
packages/content/src/*.test.ts
docs/content/eight-page-review-record.md
```

## 不可改变的 UI/内容契约

- 八页标题可以改文案，`JourneyPageId` 和路由顺序不变。
- 行为卡没有等级、默认排序不表达进展，五个 `BehaviorAttitude` 值不变。
- Page 5 不显示准备完成度；Page 7 不是通关清单；Page 8 明示“根据妳刚才的选择整理”。
- Page 6 始终显示“预设对话”，不能用拟人加载、输入中动画或语言暗示实时 AI。
- 本地保存是唯一可选保存方式；cloud `coming-soon` 保持 disabled。
- 内容审核只能由内容负责人记录，工程实现者不能自行填写 `reviewedAt`。

## 任务 1：最终内容、来源与审核记录

- [ ] 3 分钟：先写 content RED tests，要求八页每个 production item 有 reviewer、`reviewedAt`、source IDs 和明确 page owner。
- [ ] 4 分钟：增加 wording lint，拒绝“准备度”“合格/不合格”“应该更开放”“第一次必须疼”和暗示身体反应等于同意的表达。
- [ ] 5 分钟：内容队友逐条审核 Page 1—8 catalog；审核记录写入 `docs/content/eight-page-review-record.md`，包含 item ID、来源、决定和时间。
- [ ] 4 分钟：把批准文本装配到 JSON catalog，不在 `.tsx` hardcode 长文案。
- [ ] 3 分钟：运行 production content validation，预期所有正式条目通过；未审核项保持真实阻塞。
- [ ] 2 分钟：提交 `git commit -am "content: freeze reviewed eight-page copy"`。

## 任务 2：医学图示与 asset manifest

- [ ] 3 分钟：先写 asset RED tests：文件不存在、dimensions 缺失、alt text 缺失、license/source metadata 缺失均失败。
- [ ] 4 分钟：内容队友确认医学准确性、非色情表达和来源许可；将确认结果加入审核记录。
- [ ] 5 分钟：加入外阴医学线稿资产和 manifest；资产默认折叠，仅由用户主动展开。
- [ ] 4 分钟：实现可缩放但不自动放大的图示组件，VoiceOver 读取简洁 alt text，并提供来源入口。
- [ ] 3 分钟：运行 asset/content tests，预期退出码 0。
- [ ] 2 分钟：提交 `git commit -am "content: add reviewed medical illustration"`。

## 任务 3：Brand、Design Tokens 与基础组件

- [ ] 3 分钟：定义 `brand.ts`，固定 `slug = "cave"`、`displayName = "内界 CAVE"` 和已批准 slogan；routes 禁止 hardcode brand。
- [ ] 4 分钟：定义 semantic colors、typography、spacing、radii、surface、focus、minimum touch size 和 reduced-motion duration。
- [ ] 3 分钟：先写 contrast RED tests；正文/背景和交互状态未达到 WCAG AA 时失败。
- [ ] 5 分钟：实现 `Screen`、`Card`、`Button`、`ChoiceChip`、`ProgressHeader`、`StatusBanner` 的 default/pressed/disabled/loading/focus 状态。
- [ ] 4 分钟：替换八页 raw color/spacing literals，保留必要 platform system color 时写明确测试说明。
- [ ] 3 分钟：运行 primitives 与 contrast tests。
- [ ] 2 分钟：提交 `git commit -am "feat: style eight-page design system"`。

## 任务 4：Page 1—3 表现收口

- [ ] 3 分钟：先写 largest-font/small-device tests，覆盖 welcome、preface、underage exit、Page 2 多选、Page 3 图示与来源 sheet。
- [ ] 4 分钟：完善 Page 1 品牌氛围、能力与局限说明，不加入诊断或承诺结果措辞。
- [ ] 4 分钟：完善 Page 2 情境说明，始终保留“不默认发生性行为”的语义。
- [ ] 4 分钟：完善 Page 3 三条核心知识、来源展示和图示展开状态。
- [ ] 3 分钟：检查 keyboard、Safe Area、返回后 focus restoration。
- [ ] 2 分钟：提交 `git commit -am "feat: polish journey pages one to three"`。

## 任务 5：Page 4—6 表现收口

- [ ] 3 分钟：先写长 label、五态选择、动态字体和自定义行为输入 tests。
- [ ] 4 分钟：统一 Page 4 行为卡视觉权重，五种答案没有好坏色或隐含进度。
- [ ] 4 分钟：完善 Page 5 动机/安心/保存说明，cloud 卡清楚解释未开放且不可选择。
- [ ] 4 分钟：完善 Page 6 scripted label、句子编辑、镜前练习和全屏暂停卡；“暂停不需要道歉”作为非交互核心信息。
- [ ] 3 分钟：为不理想回应分支增加清晰退出与安全资源入口，不提供继续说服用户的路径。
- [ ] 2 分钟：提交 `git commit -am "feat: polish journey pages four to six"`。

## 任务 6：Page 7—8 与沟通卡版式

- [ ] 3 分钟：先写 long-content tests，覆盖大量 checklist items、所有 section、用户编辑与 `needsReview` 状态。
- [ ] 4 分钟：完善清单 category、三态控件、健康模块和实际安排，不加入全部完成按钮或进度百分比。
- [ ] 5 分钟：完成沟通卡视觉层级：期待、当时再感受、不希望、安心条件、改变时表达、确认与暂停。
- [ ] 4 分钟：优化 edit/save/copy/fullscreen display feedback；复制成功不显示内容全文到日志或 toast。
- [ ] 3 分钟：积分展示只呈现已完成任务和总分，隐藏任何敏感输入细节。
- [ ] 2 分钟：提交 `git commit -am "feat: polish checklist and communication card"`。

## 任务 7：完整状态矩阵与隐私披露

- [ ] 4 分钟：先为八页建立 loading、content、validation error、storage error、saved、copy failure、empty derived output、reset confirmation 状态矩阵 tests。
- [ ] 4 分钟：实现每个 recoverable state 的明确 action；terminal state 提供原因和安全返回路径，不留死路。
- [ ] 3 分钟：隐私入口准确说明本地加密草稿、主动保存卡片、删除全部和 cloud 未启用。
- [ ] 3 分钟：披露 Page 6/7/8 为预设/规则整理，不提模型 provider。
- [ ] 3 分钟：验证错误与 crash logging fixture 不包含 `overnightCustomNote`、`editedPhrase`、`userText`。
- [ ] 2 分钟：提交 `git commit -am "feat: complete journey states and disclosures"`。

## 任务 8：Accessibility 与设备体验

- [ ] 4 分钟：为标题、选择组、知识卡、医学图、输入、暂停卡、清单、沟通卡和 destructive action 补 labels/hints/roles。
- [ ] 4 分钟：largest Dynamic Type 只纵向增长或滚动，不截断暂停、退出、保存和来源信息。
- [ ] 3 分钟：所有 touch target 至少 44×44 pt；状态不只依赖颜色。
- [ ] 3 分钟：submit/validation/storage failure 后 focus 移到 status banner。
- [ ] 5 分钟：真实 iPhone 用 VoiceOver 完成 Page 1—8；记录 device、iOS、app commit、字体级别和失败恢复。
- [ ] 2 分钟：提交 `git commit -am "fix: complete eight-page accessibility pass"`。

## 任务 9：双命题与运行时中立性

- [ ] 2 分钟：运行 `rg -n "sappho|eazo" apps/mobile packages/content`，除批准的 attribution metadata 外预期无命中。
- [ ] 3 分钟：两套提交脚本引用同一 bundle ID、version、commit、八页结构和隐私事实。
- [ ] 3 分钟：命题差异只写入 `submissions/sappho` 与 `submissions/eazo`，不创建 runtime feature flag。
- [ ] 2 分钟：提交 `git commit -am "docs: verify submission-neutral eight-page build"`。

## 执行命令与预期结果

- [ ] `corepack pnpm verify`：退出码 0，production content validation 通过。
- [ ] `corepack pnpm --filter @cave/mobile test`：包含 large-text、state-matrix 和 accessibility suites，全部通过。
- [ ] `corepack pnpm test:safety`：无八页内容引入的回归；发布前既有 Plan 04 blocker 已关闭。
- [ ] `rg -n "readiness|percentage|AI generated|cloudEnabled" apps/mobile/src/features/journey packages/content/data`：预期无命中，退出码 1。
- [ ] `git diff --check`：退出码 0。
- [ ] 真实 iPhone 完成 VoiceOver、keyboard、background/resume 与 offline path。

## 故障、回滚与降级

- 医学图示审核未完成：继续使用明确占位框，Page 3 文字知识可交付；不得把候选资产标成 reviewed。
- 最终 copy 影响 domain 字段：调整 catalog mapping，不改 05A 类型；确需改接口时先走总路线图 change request。
- 动画导致不稳定或 reduced-motion 回归：删除动画，不推迟 Plan 07。
- 单页细节威胁主演示路径：降为 P1，保留基础交互和可访问状态。
- sponsor 要求运行时分叉：退回 submission materials，不复制 app logic。

## 验收证据清单

- [ ] 内容审核记录、source validation 与 asset manifest。
- [ ] 八页状态矩阵、large text 和 accessibility test 数量。
- [ ] VoiceOver 主路径、keyboard、offline、resume 真机记录。
- [ ] Page 6 scripted 和 Page 8 rule-based 披露可达。
- [ ] 无准备度、云开关、AI 生成或 sponsor runtime fork 的扫描证据。
- [ ] branch、HEAD、独立英文 commits 与 clean git status。

**解锁下一计划：** 本计划本地与真机 Gate 全部通过后解锁 Plan 07。
