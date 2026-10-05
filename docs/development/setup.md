# 开发环境

内界 CAVE 是一个 pnpm workspace。移动端、Gateway、官网和共享包使用同一份锁文件。

## 环境要求

- Node.js `^22.12.0` 或 `>=24 <25`
- Corepack 与 pnpm `10.34.5`
- 移动端预览所需的 Expo SDK 57 环境
- 原生安全能力验证所需的 iOS 构建环境或已签名开发包

## 安装依赖

在仓库根目录运行：

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

仓库使用固定 lockfile 和 workspace 版本；不要分别进入子项目安装依赖。

## 移动端

Expo Go 使用电脑的局域网 Gateway。先在仓库根目录应用本地 D1 migration，并在一个终端运行：

```bash
corepack pnpm --filter @cave/gateway exec wrangler dev --ip 0.0.0.0 --port 8787 --var MODEL_MODE:mock
```

在启动 Metro 的终端设置电脑当前的局域网 IP（示例地址要换成自己的，手机与电脑须能互通）：

```powershell
$env:CAVE_LOCAL_GATEWAY_URL = "http://192.168.1.23:8787"
corepack pnpm dev:mobile
```

也可使用可从手机访问的 HTTPS 安全隧道 URL。启动脚本会拒绝缺失的地址、`localhost`、回环地址和公网 HTTP，并关闭 Expo 的 `.env` 自动加载，避免旧设置覆盖所选目标。

开发包的 Metro 默认连 staging；需要在**同一个已安装开发包**上切到局域网本地 Gateway 时，重启 Metro 并换用本地命令：

```powershell
corepack pnpm --filter @cave/mobile start:dev-client
$env:CAVE_LOCAL_GATEWAY_URL = "http://192.168.1.23:8787"
corepack pnpm --filter @cave/mobile start:dev-client:local
```

以上两条 Metro 命令是二选一。验收工具使用 `start:acceptance`，只在 acceptance 开发包及开发 JS 中出现，默认连 staging。preview/internal、外测和 production 安装包只连生产 `https://api.neijiecave.com`。构建 profile 的环境值见 `apps/mobile/eas.json`；修改后需要重新启动 Metro 或重新构建相应安装包。

```bash
node scripts/start-mobile.mjs dev-staging --print-env
```

这条只打印将要使用的客户端、profile 和公开 Gateway 地址，不启动 Metro。核心旅程、预设练习和界面预览不需要 Gateway；邮箱登录需要 Gateway。Expo Go 的手记、草稿、后来、修改历史与阶段回顾保存在账号隔离的明文 SQLite，其他旅程运行数据使用内存。

手记 AI 模拟验收可在设置同一个 `CAVE_LOCAL_GATEWAY_URL` 后运行 `corepack pnpm --filter @cave/mobile start:journal-preview`，只启动 Expo Go JavaScript 服务，不构建原生包。AI 不联网且界面明确标注模拟；完整操作见[手记验收](journal-first-acceptance.md)。

开发客户端必须由匹配当前 Expo 配置的原生构建启动。本次 development/acceptance 原生配置添加了仅限本地网络的 iOS 访问许可，旧开发包需重新构建安装后才能验收局域网 HTTP；preview/production 不带这项许可。Expo Go 结果不能替代原生安全能力验证。

`development` 开发包使用 `com.neijie.cave.dev`，图标名称为“内界 CAVE Dev”，可与 `com.neijie.cave` 的 alpha/preview/production 包并排安装；它们的本机数据彼此独立。`acceptance`、`preview`、`production` 仍共用 `com.neijie.cave`，互相安装会覆盖，设备升级验收应继续使用同一 bundle ID。新的 development ID 需单独的 Apple App ID 与 Ad Hoc 签名。

在 `apps/mobile` 为 development 配置 EAS iOS 凭据时，先在 PowerShell 设置 `$env:EAS_BUILD_PROFILE = "development"`，再运行 `pnpm dlx eas-cli@24.8.0 credentials:configure-build --platform ios --profile development`；确认输出的 Bundle Identifier 是 `com.neijie.cave.dev`，Apple Team 是 `GS99UP3542`。仅传 `--profile development` 给该凭据命令时，动态 `app.config.ts` 曾按默认 production 解析为旧 ID。

本地 Gateway 的身份验证仍需下文所列 Secret；Expo Go 无法替代 SQLCipher、SecureStore、本地迁移或删除恢复的原生验证。开发包 staging 的 AI 模式及服务状态由 staging Worker 决定；密钥不可放入移动端。团队使用和构建环境见[AI 服务配置](../operations/ai-service.md)。

### iPhone 热点连接 Development Build

后续真机开发统一由 iPhone 开启个人热点、电脑连接该热点，再从仓库根目录用电脑在热点中的 IPv4 地址启动 Metro。2026-10-02 验收时电脑的 WLAN 地址为 `172.20.10.4`，但重连后可能变化；先用 `Get-NetIPConfiguration` 核对当前地址，不要固定复用示例值。

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "<电脑当前热点 IPv4>"
node scripts/start-mobile.mjs dev-staging --host lan --port 8084
```

在 iPhone 的“内界 CAVE Dev”首页选择手动输入 URL，填 `http://<电脑当前热点 IPv4>:8084`；自动发现列表为空时也可手动连接。先用 iPhone Safari 打开同一地址的 `/status`，应显示 `packager-status:running`。此启动方式的 Gateway 仍是 staging。当前开发包加载 Tailscale `100.x` 的 HTTP Metro 地址会被 iOS App Transport Security 拒绝；此前的 Tailscale TCP 转发已关闭。热点地址变化后，停止 Metro，更新上述环境变量并重新启动。

## 官方网站

```bash
corepack pnpm dev:web
```

Astro 开发服务器包含主页、在线演示、隐私、安全、支持和来源页面。生产构建使用：

```bash
corepack pnpm build:web
```

旅程 01 的 `/body-response/` 是待专业复核的中文译述页，暂不进入 sitemap。若需从手机上的 Expo Go 联调该页，先让 Astro 开发服务器监听同一局域网，再在启动移动端前设置 `EXPO_PUBLIC_BODY_RESPONSE_PREVIEW_URL=http://<电脑局域网地址>:4321/body-response`（Astro 开发路由不带末尾斜杠）。这个覆盖只在非生产构建中使用；生产构建始终指向 `https://neijiecave.com/body-response/`。网页未经专业复核和发布确认前，不要将该链接视为线上可用。

## Gateway

```bash
corepack pnpm dev:gateway
```

本地身份功能还需要：

1. 在 `apps/gateway/.dev.vars` 中配置 `RESEND_API_KEY`、`AUTH_EMAIL_LOOKUP_KEY_V1` 和 `AUTH_OTP_KEY_V1`。
2. 为两个摘要密钥分别生成至少 32 个随机字节，不得复用，也不得提交文件。
3. 应用本地 D1 migration：

```bash
corepack pnpm --filter @cave/gateway exec wrangler d1 migrations apply neijie-cave-auth --local
```

4. 再以 `--ip 0.0.0.0 --port 8787` 启动 Gateway，并按上文设置 `CAVE_LOCAL_GATEWAY_URL` 后启动 Expo Go 或开发包的本地 Metro。

测试使用注入的邮件适配器，不会发送真实邮件。真实验证码投递和生产密钥轮换见[邮箱身份运维](../operations/email-authentication.md)。普通记录和预设练习不需要模型凭据；真实手记 AI 需在 Gateway 配置 MODEL_MODE=live、MODEL_BASE_URL=https://api.deepseek.com、MODEL_API_KEY 和已选模型的 MODEL_NAME。密钥不可放入移动端或使用 EXPO_PUBLIC_ 前缀。模拟验收无需这些凭据。

## 常用验证

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
```

完整的内容、构建和安全检查见[验证指南](verification.md)。
