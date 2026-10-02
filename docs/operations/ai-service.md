# 团队共用的 AI 服务

## 调用位置与账号

移动端 AI 与身份接口共用 Gateway：Expo Go 本地 Metro 连本地 Gateway，开发包默认连 `https://staging-api.neijiecave.com`，preview / production 安装包连 `https://api.neijiecave.com`。线上 live Worker 再调用 `https://api.deepseek.com/chat/completions`。

- 已由用户确认的 Cloudflare 账号：`carterwellsdeveloper@gmail.com`，Account ID `3d3f8c9a0cd1392d912a00414155f7de`。
- Worker：`neijie-cave-gateway`，线上模式 `live`，模型 `deepseek-v4-flash`。
- DeepSeek 密钥只保存在该 Worker 的 `MODEL_API_KEY` Secret。队友运行或构建 App 无需获取密钥，也无需 Cloudflare 权限。
- DeepSeek 平台的登录邮箱不能从 Worker Secret 推断；本次仅确认 Cloudflare 账号及 Secret 存在。
- 登录与 AI 共用 `apps/mobile/src/config/gateway.ts` 的公开地址配置；AI HTTP 客户端在 `apps/mobile/src/features/assistant/assistant-client.ts`，服务端路由在 `apps/gateway/src/routes/assistant.ts`，模型适配器在 `apps/gateway/src/providers/openai-compatible.ts`。

## 拉取后启动移动端

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @cave/mobile start:dev-client
```

上面是已安装开发包的 staging Metro 命令。Expo Go 与本地 Gateway 的启动命令见[开发环境](../development/setup.md)。完成成年声明后可用自己的邮箱检查登录和 AI；staging 的邮件、模型模式及服务端凭据以 staging Worker 实际配置为准。手机上的 `localhost` 指向手机本身，不能当作电脑 Gateway。

`start`、`start:dev-client`、`start:dev-client:local` 和 `start:acceptance` 会显式设置 Gateway 与 live 模式，并关闭 `.env` 自动加载。切换目标后重启 Metro（必要时加 `--clear`）。`start:journal-preview` 使用同一个本地 Gateway 地址、强制本机 AI 模拟，不能用它验收真实模型。

## 构建版

`apps/mobile/eas.json` 的 development 指向 staging；acceptance 继承 development 并保留工具隔离；preview、production 指向生产。三者显式使用 `EXPO_PUBLIC_ASSISTANT_MODE=live`。JS 运行时也将 preview、production 固定到生产 Gateway，阻止 `.env` 或更新包误用 staging/HTTP。模型密钥不进入 EAS 或客户端包。

这里的客户端 `live` 表示向所选 Gateway 发请求，不保证 Gateway 已启用真实模型。若 staging Worker 仍为 `MODEL_MODE=mock`，服务端返回 `providerMode=mock`，手记和聊天结果会显示“模拟”；真实模型验收要等 staging 使用独立凭据切到 live。

按项目现有签名与构建流程使用相应 profile 即可。环境变量在打包时确定；已经安装的旧包不会因为拉取代码自动更新，需要重新构建安装或按项目更新流程发布 JS 更新。本次没有触发 EAS 构建或发布。

## 修改 Gateway 的开发者

普通 App 开发不需要这一步。本地 Gateway 不会自动读取线上 Secrets：

- `corepack pnpm dev:gateway` 显式以 mock 模式运行。
- 调试真实模型时，在忽略的 `apps/gateway/.dev.vars` 中配置 `MODEL_API_KEY` 与身份/邮件所需 Secrets，再运行 `corepack pnpm --filter @cave/gateway dev:live`。
- 开发 JS 可使用电脑局域网 IP 的 HTTP Gateway 或 HTTPS 安全隧道；登录与 AI 始终指向同一 Gateway。非开发 JS 不接受本地 HTTP；preview 和 production 固定生产 HTTPS 地址。
- 生产部署配置已经将上述公开 live 参数写入 `wrangler.jsonc`，普通部署不会再被仓库默认值切回 mock。部署账号固定为用户确认账号；执行者仍需要相应 Cloudflare 权限。
- 仅管理员管理 Secrets。Cloudflare Secrets 与本地 `.dev.vars` 分离，参考 [Cloudflare 官方说明](https://developers.cloudflare.com/workers/configuration/secrets/)。不要把密钥放进 Git、EXPO_PUBLIC 变量或聊天。

## 验收边界

2026-09-09：线上 `/health` 返回 `status: ok`；版本 `38e3c63b-d587-4ba6-aa0d-1a3f8337359a` 为 live / deepseek-v4-flash，四个模型与身份服务 Secret 保留。D1 0002/0003 迁移已应用；每账号额度为每小时 5 次、每天 25 次。

已验证四个合成远程模型样本，并完成五次用户开发版试聊的 token 计量。安装包仍需真机验收：用自己的账号发送测试问题，确认云端发送，检查返回真实回复且未标为模拟。若 401 请重新登录；429 请查看额度重置时间；unavailable 需管理员检查模型余额、配额与网关诊断。健康检查不替代真实模型和客户端验收。
