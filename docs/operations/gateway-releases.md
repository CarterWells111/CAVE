# Gateway 发布流程

## 合并和环境边界

`main` 必须经 PR 合并。GitHub 分支保护要求 GitHub Actions 的 `foundation` 检查通过，并要求分支与最新 main 保持同步；管理员也受约束，禁止强推和删除 main。当前单人仓库不强制另一个人的 PR 审批；production 发布另外需要 `CarterWells111` 的环境审批。

官网继续使用现有 Cloudflare Pages Git 集成：合并 main 后自动发布。`foundation` 包含官网构建验证；部署记录中的官网成功不代表 Gateway 发布成功。

Gateway 不连接 Cloudflare Workers Builds，发布由 GitHub Actions 统一管理。不要另开一条直接自动发布 production 的 Git 集成，以免绕过审批。GitHub 的 staging 和 production 环境都只允许 main；production 禁止管理员绕过环境审批。单人操作允许自己发起后再审批，保留一个明确的发布动作。

## 凭据配置

分别在 GitHub Settings → Environments → staging / production 中配置名为 `CLOUDFLARE_API_TOKEN` 的环境 Secret，使用独立部署 Token。不要将 Wrangler 本地 OAuth 凭据、模型 Key、Resend Key 或数据摘要密钥复制到 GitHub。

Cloudflare Token 限定到现有 CAVE 账号，优先使用 account-owned Token，为对应的现有 Worker 单独授予 Workers Editor，并授予数据库查询、迁移和 Time Travel bookmark 所需的最小 D1 权限。Worker 的粒度权限以 [Cloudflare 当前角色文档](https://developers.cloudflare.com/workers/authorization/workers/) 和账号界面为准；D1 若只能授予整个产品范围的编辑权限，Token 将能够操作该账号内其他 D1，需单独确认这个范围，不能把脚本中的目标检查描述为数据库权限隔离。凭据创建、授权和保存由账号管理员确认后执行。

自动流程使用 `wrangler versions upload` 和 `wrangler versions deploy` 发布版本，保留已有自定义域名、路由和 cron 配置，不需要自动修改 Zone 路由。域名、路由、cron 和新资源的基础设施修改需要单独管理；本次配置已存在，无需重新创建。避免使用范围更大的旧式 Workers Scripts 编辑权限，除非账号界面不支持对应的粒度 Token，并已明确批准扩大权限。

运行时 Secrets 保留在各自 Worker；发布前只检查名称，包括启用 Rooms 时所需的 `ROOM_ENCRYPTION_KEY_V1`。缺少部署 Token、运行时 Secret 或数据库恢复点时，发布失败，不自动降低检查标准。

## 自动发布 staging

PR 和其他分支只运行验证。main 的 push 在 `foundation`（包括内部验证、官网构建和 staging dry-run）成功后，才运行 `deploy-staging`：

1. 核对账号、Worker、D1、域名、模型模式及 staging/production 隔离。
2. 检查运行时 Secret 名称，完成 dry-run，记录当前 Worker 版本和 D1 Time Travel bookmark。
3. 在 staging D1 上应用尚未应用的迁移，发布带完整提交 SHA tag 的 staging Worker。
4. 确认正在服务的 Worker 版本 tag 与提交相同；检查 `/health` 和 `/v1/meta` 的状态、模型、prompt/policy 版本。
5. 保存 `staging-release-<SHA>` artifact，其中 `release.json` 记录部署版本、SHA 和健康检查结果；`recovery.json` 在迁移前写入。

main 的工作流不会被后续 push 自动取消，避免中断迁移；排队时已过期的提交会在发布前停止。健康检查只证明服务及配置，真实邮件、登录、AI 和改动功能仍需通过连接 staging 的 development 构建验收。preview 和 production 构建目前连接 production API。

## 手动发布 production

1. 打开 GitHub Actions 中 **Deploy production Gateway**，选择 main。
2. 填写已验收的成功 main CI **run ID**，填写不含个人数据的验收说明。不要填 PR 检查 run 或只通过 foundation、未成功发布 staging 的 run。
3. 数据库迁移默认不执行。如果本次存在迁移，先审查 SQL 的向后兼容性和恢复方案，再勾选 `apply_migrations`。破坏性迁移应拆成先扩展、后迁移、最后删除的多个发布，不在这条流程直接执行。
4. 流程核对来源仓库、工作流、main push、foundation/staging 成功及 artifact，并检出 artifact 对应的固定 SHA；同时验证该提交属于 main，执行 `pnpm verify:release`。
5. 生产发布检查通过后，在环境审批中确认候选 SHA、staging run、验收说明和迁移选择，再批准 production。随后才可读取生产部署 Token。
6. 发布前保存生产 Worker 版本和 D1 bookmark；未批准迁移却存在待执行文件时拒绝发布。发布与验收使用同一源提交，记录生产 artifact。

当前内容中的 `internal_test_approved` 不能通过正式内容验证。`verify:release` 如因此失败，需完成实际内容审核；不能改为内部检查或跳过正式发布门禁。此流程不会自动创建 EAS Build、推送 OTA 或提交 App Store。

## 回退和失败处理

失败时查看该 run 的 artifact 和错误步骤。存在 `recovery.json` 但缺少 `release.json` 表示没有完成发布验收；即使 Worker 已经上传，也不能把该 run 作为生产候选。脚本不会自动恢复数据库或自动回退 Worker，以免与已经执行的迁移不兼容。

Worker 回退由管理员核对兼容性后，使用 `recovery.json` 的 `previousVersionId`，对指定环境执行 `wrangler rollback <VERSION_ID>`（staging 必须加 `--env staging`）。生产仍指向配置顶层。追加式数据库迁移通常保留；Worker 回退不恢复 D1。

如果需要恢复 D1，先判断恢复点之后的数据损失范围及暂停写入需求，确认后再使用记录的 `databaseBookmark`；不要机械地把代码回退和数据库恢复绑在一起。旧 artifact 过期后不能再直接晋级，需重新部署并验收 staging。
