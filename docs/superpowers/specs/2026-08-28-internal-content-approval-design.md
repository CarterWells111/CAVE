# 内测内容审核与 App 帮助声明设计

## 目标

让普通旅程文案完成团队编辑审核，让需要医疗、安全或性教育专家复核的内容可以进入内测，同时保持正式发布门禁诚实有效。App 只在欢迎页右上角的“帮助 → 关于内界 CAVE”中披露 AI 辅助与审核边界，不在首页正文直接展示该声明。

## 审核记录

- 当前 56 条 `draft` 旅程内容改为 `reviewed`。
- 审核人统一记录为 `annie`，角色记录为“产品与编辑审核人”。
- `reviewedAt` 使用实施时的真实 `2026-08-28` 带时区时间戳。
- `reviewedVersion` 统一记录为 `2026-08-28-review-1`。
- 普通内容的 `reviewConclusion` 记录为“产品与编辑审核通过”。
- 当前 34 条 `expert_review_pending` 内容不伪装成正式专家审核，改为新增状态 `internal_test_approved`。
- 专家待审内容的审核人同样记录为 `annie`，角色记录为“内部测试审核人”，结论记录为“仅内测通过；发布前仍需合格专家完成医疗、安全或性教育审核”。
- 来源台账、医学图审核稿标识以及正式专家待审事实保持不变。

## 校验模式与 CI

内容校验增加 `internal` 模式：

- `draft` 模式只验证结构与引用，可接受所有合法审核状态。
- `internal` 模式只接受 `reviewed` 和 `internal_test_approved`，拒绝仍为 `draft`、`expert_review_pending` 或 `revision_required` 的内容。
- `production` 模式只接受 `reviewed`；遇到 `internal_test_approved` 必须返回明确的正式专家审核待完成错误。

普通 PR 的 CI 使用 `pnpm validate:content:internal`，因此团队编辑已通过、专家内容仅内测通过时可以合并。`pnpm validate:content` 和 `pnpm verify:release` 继续使用 production 模式并保持失败，直到 34 条内容由合格审核人补齐正式审核记录。不得使用免责声明、忽略项或宽松校验绕过发布门禁。

## App 帮助声明

在欢迎页右上角“帮助”打开的“关于内界 CAVE”底部弹层中加入：

> 部分页面内容由 AI 辅助生成，并经团队编辑审核。AI 辅助、团队编辑审核和免责声明都不能代替医疗、安全及紧急支持内容所需的专业审核。

该声明不出现在欢迎首页的可见正文中，也不改变现有“不提供医疗诊断，不能替代专业医疗或紧急支持”声明。

## 测试与验收

- 内容模型测试覆盖 `internal_test_approved` 的 schema 和审核证据要求。
- 校验测试证明 internal 模式接受内测记录，而 production 模式仍拒绝所有内测专家内容。
- 目录测试断言 56 条普通内容和 34 条专家内容分别具有正确状态、审核人、角色、日期、版本和结论。
- 欢迎页测试确认帮助弹层包含 AI 辅助及安全审核边界声明，关闭帮助时首页正文中不存在该声明。
- CI 配置测试确认 PR 使用 internal 内容校验，`verify:release` 仍调用 production 内容校验。
- 更新 PR 后运行全量类型检查、lint、测试、internal 内容校验、Expo Doctor、iOS production export、bundle secret scan 和生产依赖高危审计。
- PR 仅在 GitHub checks 全部通过后合并；正式发布仍必须等待 production 内容校验通过。

## 非目标

- 不把 `annie` 表述为医学、法律、安全或性教育专家。
- 不修改数据库 schema、账号协议或会员功能。
- 不移除医学图审核稿标识，不宣称来源已获医学认可。
- 不让内测审核状态满足正式发布门禁。
