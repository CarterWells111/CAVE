# 内界 CAVE 产品标识迁移设计

**日期：** 2026-08-27  
**状态：** 已批准，等待实施
**范围：** Plan 01—02 中的产品品牌、应用标识、workspace 标识、Worker 标识、内容主 ID，以及 EAS/iOS 人工验收

## 目标

在首个 EAS 项目和正式发行记录创建前，将仓库中误用的 `Body Voice` 系列标识完整迁移为“内界 CAVE”的规范品牌与技术标识。迁移后，用户可见文案、Expo/iOS 配置、内部 Package 名称、Worker 名称、内容主 ID 和实施计划必须一致，不保留旧标识的运行时兼容层。

## 品牌规范

- 品牌名：`内界 CAVE`
- 标语：`听见身体，确认边界。`
- 一句话介绍：`面向年轻女性的身体认知与亲密关系成长应用。`
- Production App 名称：`内界 CAVE`
- Development App 名称：`内界 CAVE Dev`
- Preview App 名称：`内界 CAVE Preview`

品牌名用于 App 显示名称与首页标题；标语用于首页副标题；三层文案共同作为 README、后续商店元数据和演示材料的规范来源。

## 技术标识映射

| 标识 | 当前值 | 目标值 |
|---|---|---|
| Expo slug | `body-voice` | `cave` |
| URL scheme | `bodyvoice` | `cave` |
| iOS Bundle ID | `com.shenicest.bodyvoice` | `com.neijie.cave` |
| Android package | `com.shenicest.bodyvoice` | 删除；本轮不配置 Android |
| App version | `0.0.0` | `0.1.0` |
| EAS owner/project | 未关联 | 新建 `carter_wells/cave` |
| 根 workspace 名称 | `body-voice-hackathon` | `neijie-cave` |
| workspace Package scope | `@hackathon/*` | `@cave/*` |
| Cloudflare Worker 名称 | `body-voice-gateway` | `neijie-cave-gateway` |
| 课程主 ID | `body-voice-basics` | `cave-basics` |
| 首页标题 | `Body Voice` | `内界 CAVE` |

新的 Package scope 适用于 `mobile`、`gateway`、`contracts`、`content`、`scenario-engine` 和 `test-fixtures`。所有 workspace 依赖、源码 imports、测试和 lockfile 必须同步更新。

## 迁移策略

采用发布前完整重命名，不提供旧名称 alias。项目尚未创建 EAS 项目、发布 App 或产生生产数据，因此无需承担兼容层复杂度。

执行时先修改总路线图中的固定决策，再同步 Plan 01 的规范性配置。既有 commit、CI URL 和历史验收结果保持为历史事实，不改写已发生的证据。随后按以下独立能力实施：

1. App identity：显示名称、slug、scheme、version、iOS Bundle ID，并删除 Android package。
2. Workspace identity：根名称、全部 `@cave/*` manifests、workspace imports 和 lockfile。
3. Service/content identity：Worker 名称、`cave-basics` 及其所有正反向引用。
4. Brand copy：首页标题、标语与 README 规范介绍。
5. EAS/iOS：仅在本地验证全部通过后，创建并关联 `carter_wells/cave`，再进行设备注册、签名、构建和真机验收。

每个代码能力使用 RED → GREEN → verification → 英文 commit。计划文档修改先于消费者实现，且不得顺带实现 Plan 03 或之后的功能。

## EAS 与 iOS 外部流程

新 EAS 项目必须位于 owner `carter_wells` 下，slug 必须为 `cave`。如果该 owner 下 `cave` 已被占用，停止操作并由用户重新选择；不得自动使用备用 slug。

EAS 创建或关联后，必须审查工具写入的 `projectId`、`owner` 和其他配置差异，确保没有恢复旧 slug、旧 Bundle ID 或加入 Android 标识。之后由用户亲自确认 Apple Team 和真实 iPhone，完成 Development Build、安装及脱离 Metro 的两次启动。

云构建成功只证明构建产物生成，不等于真实 iPhone 验收成功。最终证据必须分别记录 EAS build URL、设备型号、iOS 版本、安装结果和两次离线启动结果。

## 验证设计

本地验证包括：

- App config 测试精确断言三个环境显示名、`cave` slug/scheme、`0.1.0` version、`com.neijie.cave` Bundle ID，以及不存在 `android.package`。
- 首页测试断言品牌名、标语、environment、version 和 build 信息。
- workspace 测试或等价静态校验确认 manifests、imports 与 lockfile 只使用 `@cave/*`。
- Gateway 测试与 Wrangler dry-run build 继续通过，并使用 `neijie-cave-gateway`。
- 内容测试和 draft validation 确认 `cave-basics` 的引用完整性。
- `expo:doctor`、strict TypeScript、ESLint、全部现有测试、Gateway build 和 `git diff --check` 全部退出 0。
- 对活动代码与规范文档执行旧标识扫描；旧名称不得作为当前配置或运行时标识残留。
- Production 内容校验继续真实拒绝未审核 draft，直到内容负责人签署并提供 `reviewedAt`；品牌迁移不得伪造审核结果。

远程验证包括 feature-branch GitHub CI、EAS iOS Development Build 和真实 iPhone 离线启动。每个结果单独记录，不相互替代。

## 错误处理

- `cave` slug 被占用：不创建项目，停止并请求新的明确选择。
- EAS 自动修改超出批准映射：保留审查证据，只撤销未批准差异，再重新验证。
- Apple Team 或设备选择不明确：停止并让用户亲自确认。
- Package 或内容 ID 替换导致引用校验失败：修复所有消费者，不添加旧别名绕过失败。
- 本地错误同一根因最多进行两轮有依据的修复；仍失败则记录准确命令、退出码和根因。

## 明确排除

- Android package、Android 构建和 Android 发布。
- Plan 03 及之后的 AI、账号、社区、商城、同步或 CMS 功能。
- App Store 正式发布、生产部署、购买服务或合并 `main`。
- 内容审核结论或 `reviewedAt` 的代填。
- 对已有 Git commit、CI 运行或其他历史事实的改写。

## 完成条件

1. 所有批准的新标识在代码、测试、lockfile 与规范文档中一致。
2. 本地技术 Gate 和 feature-branch CI 全部通过。
3. 新 EAS 项目确认为 `carter_wells/cave`，且关联配置经差异审查。
4. iOS Development Build 在真实 iPhone 安装，并脱离 Metro 成功启动两次。
5. 路线图记录最终 commits、CI URL、EAS build URL、设备和 iOS 验收证据。
6. 内容审核若未完成，继续标记 `content_review_pending`，不得声称 Plan 02 全部完成。
