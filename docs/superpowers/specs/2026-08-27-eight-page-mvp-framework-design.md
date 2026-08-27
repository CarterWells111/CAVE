# CAVE「内界」八页 MVP 框架设计

**状态：** 已批准，作为 Plan 05A、05B 与 Plan 06 的产品和技术边界。
**批准范围：** 先建立可运行框架与基础交互；不在本阶段确定最终视觉、完整文案、医学插图成品或云端/AI能力。

## 1. 设计目标

CAVE 的黑客松 MVP 是一条本地优先的八页引导旅程，帮助成年用户认识身体反应、观察个人意愿、练习表达边界，并形成一份可编辑的准备清单和沟通卡。

演示路径必须满足：

- 用户可以前进、返回并修改选择；
- 下游清单与沟通卡根据上游输入确定性重算；
- 不生成准备度分数，不替用户作决定；
- Page 6 明示为预设对话，Page 7—8 使用本地规则，不调用或伪装 AI；
- 默认只在加密的本机数据库保存；云端入口只能显示不可选择的“即将提供”；
- 基础安全知识和旅程内容离线可用；
- 积分只奖励学习、练习与自我观察，不奖励更开放的态度、更多隐私文字或文字长度。

## 2. 八页职责

| Page | 页面职责 | MVP 框架输出 | 细节阶段再完成 |
|---|---|---|---|
| 1 | 品牌欢迎、18岁以上确认、可跳过的能力与局限短笺 | `ageConfirmed`、`prefaceRead`；未成年进入温和终止状态 | 最终品牌排版与短笺文案 |
| 2 | 记录对过夜情境的期待、在意与自定义补充，不默认发生性行为 | `expectationIds[]`、`concernIds[]`、`customNote` | 选项终稿与内容审核 |
| 3 | 提供主动展开的医学图示槽位、三类核心知识和来源入口 | `readKnowledgeCardIds[]`、`medicalDiagramOpened`、积分事件 | 医学插图成品、最终说明与来源审核 |
| 4 | 分别记录各行为的当前态度，行为之间不存在等级关系 | `behaviorAttitudes`、`customBehaviors[]` | 行为目录终稿和卡片视觉 |
| 5 | 回看动机、压力、表达支持和安心条件，不输出评分 | `motivationIds[]`、`comfortNeedIds[]`、`expressionSupportNeeded`、本机记录选择 | 最终反思文案与说明层级 |
| 6 | 运行明确标注的本地预设分支练习，支持改写、对镜练习和暂停卡 | `practiceIntent`、`selectedPhraseId`、`editedPhrase`、`partnerResponseBranch` | 更多分支、语句终稿和演示动效 |
| 7 | 将前序输入整理成可编辑、非通关式准备清单 | `checklistItems[]`、状态与补充文字、健康模块显隐 | 清单文案终稿与最终版式 |
| 8 | 将选择整理为可编辑沟通卡，支持本地保存、复制与现场展示 | `communicationCard`、保存/复制/展示行为、积分汇总 | 卡片视觉、分享表现与最终文案 |

Page 1 的短笺是覆盖层，不计入八页路由。未满18岁不保存旅程草稿，也不能进入 Page 2。

## 3. 运行时架构

```text
Expo Router pages
       |
JourneyApplicationService
       |
JourneyReducer + deterministic selectors/builders
       |                         |
JourneyDraftRepository      Local content/source catalogs
       |
SQLCipher + SecureStore key
```

八页流程不调用 `GatewayClient`、`ModelProvider`、`/v1/practice/turn` 或 `/v1/practice/debrief`。Plan 03 保留为已经完成的受约束 AI 基础设施和未来扩展能力，但不属于本次 Demo 的运行路径。

## 4. 数据所有权

`JourneyDraft` 是移动端私有的 v1 领域模型，放在 `apps/mobile/src/features/journey/domain/`。它不属于 Plan 02 的跨端 API 契约，也不得加入 `@cave/contracts`，原因是当前 Worker 不接收这些敏感旅程字段。

稳定枚举：

```ts
type JourneyPageId =
  | "welcome"
  | "overnight"
  | "body-knowledge"
  | "behavior-attitudes"
  | "reflection"
  | "preset-practice"
  | "checklist"
  | "communication-card";

type BehaviorAttitude =
  | "looking-forward"
  | "decide-in-moment"
  | "unsure"
  | "not-this-time"
  | "skip";

type ChecklistItemStatus = "considered" | "prepare-more" | "not-relevant";
type JournalSaveChoice = "not-saved" | "device";
type CloudSaveAvailability = "coming-soon";
```

`JourneyDraft` 固定包含 `schemaVersion: 1`、稳定记录 ID、八页输入、派生内容覆盖、积分事件账本、`createdAt` 与 `updatedAt`。成年确认后的 active draft 为恢复进度自动保存在本机加密数据库；`JournalSaveChoice` 控制是否另存为用户记录本内容，默认 `device`，用户可以改为 `not-saved`。底层复用 Plan 04 的 SQLCipher 数据库和 SecureStore 密钥生命周期。

## 5. 回退修改与派生同步

每次上游选择变化后，应用层依次执行：

1. reducer 校验并写入新的原始输入；
2. `buildChecklist()` 根据稳定 item ID 重算清单；
3. 仍存在的清单项保留用户状态与补充文字；不再适用的派生项从当前清单移除；
4. `buildCommunicationCard()` 重算没有被用户编辑的字段；
5. 已编辑字段保留用户文字并设置 `needsReview: true`；
6. 原子保存整个 v1 草稿；
7. 页面重新读取 view model。

这样既避免上游修改留下错误信息，也不会静默覆盖用户亲自写过的表达。

## 6. 本地规则边界

- `PresetPracticeEngine` 只读取已版本化的预设分支目录，不生成自由文本回应。
- `buildChecklist()` 只根据前序选择、健康关联规则和固定模板生成结构化条目。
- `buildCommunicationCard()` 只根据固定 section 模板整理内容，并显示“根据妳刚才的选择整理”。
- 所有医学、安全和同意教育内容必须携带可解析的 `sourceIds[]`。
- Page 3、6、7、8 在无网络时必须保持完整 P0 行为。

## 7. 积分约束

积分使用幂等事件账本。允许事件为阅读知识卡、完成一次自我观察、完成预设练习和完成清单回顾。事件 key 由任务 ID 和版本组成，同一任务重复打开不重复计分。

以下数据永不进入积分计算：`BehaviorAttitude` 的具体值、自定义文字长度、私密程度、是否选择保存、是否展示沟通卡。

## 8. 分阶段交付

- **Plan 05A：** 路由、`JourneyDraft`、reducer、加密持久化、恢复/返回/同步和八页薄壳。
- **Plan 05B：** 八页基础交互、预设练习、确定性清单/沟通卡、积分、本地保存/复制/展示。
- **Plan 06：** 最终内容与来源审核、医学插图、设计系统、卡片版式、状态与可访问性。
- **Plan 09（Post-MVP）：** 主动同意的云同步与独立 AI 练习；不进入四天 MVP Gate。

## 9. 明确排除

本框架不包含账号、云同步、CMS、社区、商城、真实聊天、AI 生成沟通卡、准备度评分、怀孕/疾病推断或以敏感信息换取积分。萨福与 Eazo 使用同一应用逻辑，只在提交材料中采用不同叙事。
