# 内界 CAVE P1 修复与统一验收计划

本轮关闭 2026-10-07 全栈审查确认的两项应用 P1 和一项发布门禁 P1。三个实施会话并行修改各自范围，父会话负责复核、整合和最终验收。

## 基准与协作边界

- 源码基准：`9e3718febfa65854eda5ff91aed1906add0a4070`，本轮审查的远端 main。
- 审查证据：父工作区 `outputs/main-p0-p1-audit-2026-10-07/`，重点阅读 `findings.json`、`backend-result.json`、`mobile-ai-handoff-result.txt` 和 `dependency-audit.json`。
- 每个实施会话用原生 `create_worktree` 从上述提交创建自己的隔离检出；只有拿到最终路径后才在该路径编辑。使用 `codex/` 前缀的独立分支。不得修改父工作区或其他会话的检出。
- 父工作区现有未提交的 EAS、应用版本配置及其他文件属于用户已有工作，本轮不纳入任何提交。
- 各实施会话只提交自己的文件；完成后在自己的会话报告提交 SHA、检出路径、改动文件、验证命令与退出码、剩余限制。父会话读取报告，不要求实施会话互相发送消息。
- 本轮授权包括本地修复、隔离分支提交和统一验收；不推送、合并远端 main、部署、发起云端构建、修改云端资源或应用版本。
- 如确需云端查询或操作，先按用户约定确认平台账号、项目、环境、资源及范围。云构建还须用户明确给出应用版本及相应构建历史核对。
- 证据仅使用合成数据，不能保存真实 Secret、连接串、账号或资源标识、用户业务内容。
- Node `22.23.2`，安装使用 pnpm `10.34.5`，按锁文件完整安装。依赖公告审计使用仓库已有隔离的 pnpm `11.25.0` 启动器。

## 会话 A 共同报告与 AI 草稿账号隔离

建议分支：`codex/p1-ai-report-account-isolation`。

范围：`apps/mobile/app/(tabs)/ai.tsx`；对应路由回归测试；只有必要时才修改 `AssistantHub.tsx` 或 `report-handoff.ts`。不要改锁文件、EAS 配置或普通聊天产品行为。

问题：已消费报告保存在 AI Tab 的 state 中。账号变化时没有清除，新的聊天组件又以旧报告作为 `initialDraft`。

实施步骤：

1. 阅读真实路由、`AssistantHub`、`AssistantChat`、`report-handoff` 与 AuthProvider 的状态接口。把审查目录中的 `mobile-ai-handoff-repro.test.tsx` 改为正式路由回归测试；先确认当前实现下 B 的输入框仍含 A 的合成报告。
2. 已消费报告始终绑定其所属账号；当前账号不匹配或已退出时，在渲染阶段就不得把其文本传给子组件。账号变化时清理旧 state，避免同一账号重新登录重新注入旧报告。不能只依赖 focus effect 或延迟 effect 清除以防短暂显示。
3. 保持同一账号正常带入报告、编辑草稿、切 Tab 返回的体验；没有新 handoff 的普通 focus 不应清掉合法草稿。维持普通 AI 会话的既有授权、取消与账号切换行为。
4. 覆盖 A→退出→B、A→直接 B、A→退出→A，以及账号变化发生在 Tab 失焦时；同一账号正常消费与草稿编辑应通过。
5. 运行新测试、既有 report handoff / AssistantHub / AssistantChat 测试，以及移动端 typecheck 和 lint。提交最小修复和有意义的回归测试。

验收：B 和 signed-out 状态不能读取、复制或提交 A 的报告；重新登录 A 不应自动恢复已消费的旧报告；同账号正常草稿不受影响；正式回归测试通过。

## 会话 B 关闭匿名在线练习模型入口

建议分支：`codex/p1-disable-live-practice-routes`。

范围：`apps/gateway/src/app.ts` 和组合路由测试；仅必要时更新说明或相关接口门禁代码。不要修改移动端、依赖锁文件、云端 Secret 或部署配置。

实施决定：当前移动端沟通练习是预设分支，未使用这两个生成式研究接口。最小修复是在 `MODEL_MODE=live` 的应用组合中关闭 `/v1/practice/turn` 与 `/v1/practice/debrief`，让请求在任何模型调用前返回明确的非成功结果。保留本地 mock 研究与安全测试。不得增加一个允许匿名 live 调用的开关来绕过关闭条件；若发现真实产品调用依赖此接口，先向父会话报告证据，由父会话修订方案。

实施步骤：

1. 阅读 app 组合、practice routes、request guard、rate limiter、provider 和现有 app 测试。用本地合成 provider 复现匿名请求及轮换 installationToken 会调用模型的旧行为；禁止调用真实付费模型。
2. 在 live 组合中关闭两个 practice 入口，包括它们专用的 middleware。无需先构造请求体、消耗账号配额或调用 provider 就应拒绝。共享 provider、普通 assistant、身份与 rooms 服务保持可用。
3. 回归测试断言 live 下两个接口均不成功；更换 token、添加 Authorization、重复请求均不能让其调用 provider，模型调用计数必须为零。用实际 `createApp` 组合验证，而不只测试独立 helper。
4. mock 下既有 turn/debrief、安全政策、请求大小和限流行为仍通过；`/v1/assistant`、登录及 rooms 的正常组合路由测试通过。
5. 运行 Gateway 全量测试、typecheck、lint 和 `build:gateway` dry-run；必要说明写清 live 研究入口关闭的行为。提交最小修复及回归测试。

验收：按仓库 live 配置运行时，匿名用户无法通过这两个旧接口触发模型调用；当前移动端功能及 mock 研究测试不回归。

## 会话 C 恢复生产依赖安全门禁

建议分支：`codex/p1-production-dependency-audit`。

范围：`pnpm-workspace.yaml`、`pnpm-lock.yaml`、确有必要的 package manifest、依赖兼容回归测试及验证说明。不要修改会话 A/B 的业务文件或应用版本、EAS 配置。

已核实未豁免公告：

| 依赖 | 审计命中版本 | 已发布修复下限 | 公告 |
| --- | --- | --- | --- |
| shell-quote | 1.10.0 | 1.11.0 | GHSA-pqg4-j6r4-53mv |
| source-map-js | 1.2.1 | 1.2.2 | GHSA-68fv-2mgg-jv7q |
| compression | 1.8.1 | 1.8.2 | GHSA-vc2v-76pw-4v95 |
| sharp | 0.35.4 | 0.35.5 | GHSA-wq5f-xc86-pv6w |

这些公告主要位于开发或构建调用链，本轮关闭标准是恢复真实安全门禁并保持兼容，不把它们描述成已证实的生产运行时漏洞。

实施步骤：

1. 阅读原审计 JSON、依赖路径、仓库已有 overrides / patches 和兼容测试，核对维护方公告及修复版本可用性。不要重跑缺少依赖或配置错误的审计来替代原证据。
2. 选择兼容的修复版本，通过父依赖升级或精确 override 更新所有相关路径；用 pnpm 10 更新锁文件。不要仅为旧版本添加新豁免，不降低审计阈值，不替换已有 pnpm 11 审计启动器。
3. 保留现有 image-size、node-forge、braces、http-cache-semantics、decode-uri-component 和审计 CLI 的补丁及其对应验证，除非本次升级确实替代补丁且有证据；不能顺手移除现有防护。
4. 进行 frozen-lockfile 安装，运行仓库依赖安全/兼容测试；核对四个公告命中路径已进入修复范围。针对实际调用方做最小正常行为检查，不执行 shell 命令注入，不制造真实网络拒绝服务。
5. 验证全工作区 typecheck/lint、官网构建、Gateway dry-run、iOS JavaScript 导出及秘密扫描，执行新鲜 `pnpm security:audit`。如果公告服务出现新高危项，先报告范围，不能静默豁免或宣称通过。
6. 提交依赖、锁文件及必要回归说明；明确 audit 实际退出码、消除的公告、仍存在的中低风险项和现有精确豁免。

验收：完整安装可复现；真实 `security:audit` 退出 0，四个未豁免公告消失；现有补丁测试与移动端/官网/Gateway 构建兼容检查通过。

## 父会话统一验收

1. 用 `wait_threads` 获取三个会话最终报告和提交。核查提交都来自固定基准，差异范围符合各自任务，拒绝无关改动、未运行即宣称通过和新增漏洞豁免。
2. 在父会话已附加的干净 main 检出中创建 `codex/p1-remediation-acceptance` 分支。按 A、B、C 顺序引入实施提交；如各检出 Git 对象不共享，从其本地检出读取提交，无需远端推送。发生冲突时只在整合分支解决，并重新核对相关行为。
3. 以组合后的最终源码重跑正式账号隔离回归和 live practice 零模型调用回归，核对依赖树及新鲜公告审计。审查阶段的临时反例应作为正式测试进入仓库，不混入额外临时测试导致全量结果歧义。
4. 同一组合提交完成仓库级 CI 测试、全工作区 typecheck/lint/test、生产内容校验、移动端源码策略、官网构建测试、Gateway dry-run、Expo Doctor、iOS JavaScript 导出与秘密扫描、真实依赖审计。纯本机测试的偶发超时可定向串行复验，保留原失败和复验结果；实际失败须修复后再次验证受影响项。
5. 保存不含敏感数据的结果：最终提交、干净状态、引入提交、各项命令/退出码、三个 P1 的关闭证据与仍未验证的云端/真机边界。全通过且三个关闭条件满足，才标记本轮工程验收通过。
6. 父会话最终说明成果和验证证据；远端合并、生产部署、云构建和真机安全验收仍是后续独立动作，不冒充已完成。

回退：本轮只修改隔离检出；整合出现不可解决问题时可停止引入相应提交并保留其证据，原用户工作区不受影响。后续若要发布，须按当时确认的云平台范围另行制定部署与版本回退。
