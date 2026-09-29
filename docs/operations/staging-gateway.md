# Staging Gateway 运维

## 资源边界

Cloudflare 账号为 `carterwellsdeveloper@gmail.com`，Account ID 为 `3d3f8c9a0cd1392d912a00414155f7de`。使用账号内已有、与生产分开的资源：

| 环境 | Worker | D1 | 公开地址 |
| --- | --- | --- | --- |
| staging | `neijie-cave-gateway-staging` | `neijie-cave-auth-staging`，ID `014af9e1-ebb2-4b46-aaf2-c9ce2b4de6e6` | `https://staging-api.neijiecave.com` |
| production | `neijie-cave-gateway` | `neijie-cave-auth`，ID `91e935db-f104-4bcf-b6e0-964006c7b4e8` | `https://api.neijiecave.com` |

`apps/gateway/wrangler.jsonc` 的顶层仍是生产环境。staging 的域名、D1、限流命名空间和定时任务都在 `env.staging` 中单独声明。staging 的 `workers.dev` 地址关闭。对 staging 的 Wrangler 操作始终使用 `--env staging`；不要用无环境参数的 `deploy` 或 D1 命令代替。

staging 模型为 `MODEL_MODE=live`，使用 `https://api.deepseek.com` 上的 `deepseek-v4-flash`，所需 `MODEL_API_KEY` 仅保存在 staging Worker 的 Secret 中。`/v1/meta` 会公开返回 `providerMode: "live"`。staging 邮箱使用真实 Resend 投递，Worker Secret 名称为 `RESEND_API_KEY`、`AUTH_EMAIL_LOOKUP_KEY_V1` 和 `AUTH_OTP_KEY_V1`；这些值由 staging Worker 单独管理，不写入仓库或日志。缺少任一必需邮箱 Secret 时，身份接口返回不可用，不能把邮件视为已发送。staging 的账户、会话、偏好和 AI 用量只写入 staging D1。

移动端 `EXPO_PUBLIC_ASSISTANT_MODE=live` 表示使用远程 Gateway；连接 staging 时，服务端会按 live 模式调用 DeepSeek。staging 使用独立模型凭据，移动端不持有密钥。`/health`、`/v1/meta` 和 Secret 名称检查只能证明配置与连通性；真实模型回复仍须使用受控测试账号完成端到端调用验收，不能把配置检查称为模型调用成功。

## 发布顺序

在仓库根目录安装锁定依赖后，先核对 Cloudflare 当前登录账号与 `wrangler.jsonc` 的 Account ID，再运行：

```bash
corepack pnpm --filter @cave/gateway check:staging-config
corepack pnpm --filter @cave/gateway migrations:staging:list
corepack pnpm --filter @cave/gateway migrate:staging
corepack pnpm --filter @cave/gateway secrets:staging:list
corepack pnpm --filter @cave/gateway build:staging
corepack pnpm --filter @cave/gateway deploy:staging
```

`migrations:staging:list`、`migrate:staging` 和 `deploy:staging` 在执行前都会检查目标账号、Worker、域名、D1 ID、模型模式及生产/staging 隔离，并向 Wrangler 明确传递目标 Account ID 和 `--env staging`。迁移文件来自 `apps/gateway/migrations`；首次或旧资源更新应应用 `0001_auth.sql`、`0002_account_preferences.sql` 和 `0003_assistant_usage.sql` 中尚未应用的文件。只在 staging D1 上执行迁移，不手工向生产 D1 写入 staging 数据。

`secrets:staging:list` 只核对名称，不读取或打印值。如果 Secret 缺失，由有权限的管理员在确认账号后，使用 `wrangler secret put <NAME> --env staging` 的交互提示设置。摘要密钥使用相互独立的随机值，每个至少 32 字节。Resend 凭据应来自经核对的账户，不能复制生产 Worker Secret 或在命令行参数中传值。新增或轮换 Secret 后重新核对名称和身份接口。

## 验收与回退

```bash
curl -i https://staging-api.neijiecave.com/health
curl -i https://staging-api.neijiecave.com/v1/meta
corepack pnpm --filter @cave/gateway migrations:staging:list
```

`/health` 应为 HTTP 200、`Cache-Control: no-store`、`{"contractVersion":"1","status":"ok"}`；`/v1/meta` 应为 live，且模型名称为 `deepseek-v4-flash`。迁移列表应为空。健康检查不能证明邮件实际投递或模型调用；需要使用受控测试邮箱单独完成验证码登录和账号删除的端到端验收，不记录邮箱、验证码或 Token。异常时先检查 staging Worker 版本、Secret 名称和 staging D1 迁移。回退只回滚 staging Worker 版本；追加式 D1 迁移通常保留，生产 Worker、D1、Secret 和域名不参与回退。
