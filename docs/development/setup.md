# 开发环境

内界 CAVE 是一个 pnpm workspace。移动端、Gateway、官网和共享包使用同一份锁文件。

## 环境要求

- Node.js `^22.12.0` 或 `>=24 <25`
- Corepack 与 pnpm `10.34.5`
- 移动端预览所需的 Expo SDK 54 环境
- 原生安全能力验证所需的 iOS 构建环境或已签名开发包

## 安装依赖

在仓库根目录运行：

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

仓库使用固定 lockfile 和 workspace 版本；不要分别进入子项目安装依赖。

## 移动端

```bash
corepack pnpm dev:mobile
```

该命令以 Expo Go 模式启动。核心旅程、预设练习和界面预览不需要 Gateway，但 Expo Go 只使用内存数据，进程结束后不保证保留内容。

需要验证 SQLCipher、SecureStore、本地迁移或删除恢复时，使用开发客户端：

```bash
corepack pnpm --filter @cave/mobile start:dev-client
```

开发客户端必须由匹配当前 Expo 配置的原生构建启动；Expo Go 结果不能替代这类验证。

邮箱登录需要在 `apps/mobile/.env.local` 中配置公开 Gateway 地址：

```dotenv
EXPO_PUBLIC_GATEWAY_URL=http://localhost:8787
```

这个值是公开服务地址，不是密钥。模型凭据、邮箱摘要密钥和邮件凭据不得使用 `EXPO_PUBLIC_` 前缀。

## 官方网站

```bash
corepack pnpm dev:web
```

Astro 开发服务器包含主页、在线演示、隐私、安全、支持和来源页面。生产构建使用：

```bash
corepack pnpm build:web
```

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

4. 再启动 Gateway，并将移动端的 `EXPO_PUBLIC_GATEWAY_URL` 指向本地 Worker。

测试使用注入的邮件适配器，不会发送真实邮件。真实验证码投递和生产密钥轮换见[邮箱身份运维](../operations/email-authentication.md)。当前移动端不调用 AI 练习接口，因此运行 App 不需要模型凭据。

## 常用验证

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
```

完整的内容、构建和安全检查见[验证指南](verification.md)。
