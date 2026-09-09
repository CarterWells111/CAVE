# 团队共用的 AI 服务

## 调用位置与账号

移动端（Expo Go、开发客户端、preview / production 安装包）→ `https://api.neijiecave.com/v1/assistant` → Cloudflare Worker → `https://api.deepseek.com/chat/completions`。

- 已由用户确认的 Cloudflare 账号：`carterwellsdeveloper@gmail.com`，Account ID `3d3f8c9a0cd1392d912a00414155f7de`。
- Worker：`neijie-cave-gateway`，线上模式 `live`，模型 `deepseek-v4-flash`。
- DeepSeek 密钥只保存在该 Worker 的 `MODEL_API_KEY` Secret。队友运行或构建 App 无需获取密钥，也无需 Cloudflare 权限。
- DeepSeek 平台的登录邮箱不能从 Worker Secret 推断；本次仅确认 Cloudflare 账号及 Secret 存在。
- 登录与 AI 共用 `apps/mobile/src/config/gateway.ts` 的公开地址配置；AI HTTP 客户端在 `apps/mobile/src/features/assistant/assistant-client.ts`，服务端路由在 `apps/gateway/src/routes/assistant.ts`，模型适配器在 `apps/gateway/src/providers/openai-compatible.ts`。

## 拉取后在本地使用真实 AI

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev:mobile
```

不需要复制 `.env`、启动本地 Gateway 或配置 DeepSeek key。安装匹配项目 SDK 的 Expo Go / 开发客户端，完成成年声明，使用自己的邮箱登录，再发送消息并确认本次云端资源。账号有效、网络可达及服务端余额/配额正常是必要条件。

已有开发目录请检查 `apps/mobile/.env*` 和终端环境：删除旧的 localhost / staging 网关覆盖；真实体验不要设置 `EXPO_PUBLIC_ASSISTANT_MODE=mock`。修改环境后重启 Metro（必要时使用 `--clear`）。`start:journal-preview` 明确强制本机模拟，不能用它验收真实 DeepSeek。

## 构建版

`apps/mobile/eas.json` 的 development、preview、production 显式设置相同 HTTPS Gateway 和 `EXPO_PUBLIC_ASSISTANT_MODE=live`；acceptance 继承 development。模型密钥不进入 EAS 或客户端包。

按项目现有签名与构建流程使用相应 profile 即可。环境变量在打包时确定；已经安装的旧包不会因为拉取代码自动更新，需要重新构建安装或按项目更新流程发布 JS 更新。本次没有触发 EAS 构建或发布。

## 修改 Gateway 的开发者

普通 App 开发不需要这一步。本地 Gateway 不会自动读取线上 Secrets：

- `corepack pnpm dev:gateway` 显式以 mock 模式运行。
- 调试真实模型时，在忽略的 `apps/gateway/.dev.vars` 中配置 `MODEL_API_KEY` 与身份/邮件所需 Secrets，再运行 `corepack pnpm --filter @cave/gateway dev:live`。
- 本地 Gateway 的 AI 客户端要求 HTTPS，使用经核对的 HTTPS 开发地址并让登录与 AI 指向同一 Gateway。生产安装包也必须 HTTPS。不要把手机的 localhost 当作电脑地址。
- 生产部署配置已经将上述公开 live 参数写入 `wrangler.jsonc`，普通部署不会再被仓库默认值切回 mock。部署账号固定为用户确认账号；执行者仍需要相应 Cloudflare 权限。
- 仅管理员管理 Secrets。Cloudflare Secrets 与本地 `.dev.vars` 分离，参考 [Cloudflare 官方说明](https://developers.cloudflare.com/workers/configuration/secrets/)。不要把密钥放进 Git、EXPO_PUBLIC 变量或聊天。

## 验收边界

2026-09-09：线上 `/health` 返回 `status: ok`；版本 `38e3c63b-d587-4ba6-aa0d-1a3f8337359a` 为 live / deepseek-v4-flash，四个模型与身份服务 Secret 保留。D1 0002/0003 迁移已应用；每账号额度为每小时 5 次、每天 25 次。

已验证四个合成远程模型样本，并完成五次用户开发版试聊的 token 计量。安装包仍需真机验收：用自己的账号发送测试问题，确认云端发送，检查返回真实回复且未标为模拟。若 401 请重新登录；429 请查看额度重置时间；unavailable 需管理员检查模型余额、配额与网关诊断。健康检查不替代真实模型和客户端验收。
