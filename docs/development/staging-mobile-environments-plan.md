# Staging 与移动端环境分流执行计划

基线：2026-09-29 从 origin/main 1ee53485 创建集成工作区 `codex/staging-mobile-environments`。原工作区的未提交修改保持原样。

## 目标与路由矩阵

| 客户端 | Gateway | 验收方式 |
| --- | --- | --- |
| Expo Go（本地 Metro） | 本地 Worker（显式局域网地址） | 真机登录/请求只进入本地 D1；原生加密能力另用开发包验收 |
| Development build + 本地 Metro | staging 默认；可显式切到本地 Worker | 同一已安装开发包切换 Metro 启动目标，无须重建原生包 |
| 内测、外测及正式发行包 | production | preview/internal、TestFlight/external、production profile 均只连生产 Gateway |

## 任务 A：独立 staging Gateway（独立会话）

- 在 Cloudflare 为 staging 配置独立 Worker、D1、路由 `staging-api.neijiecave.com`、相应 Secret 和迁移；生产 Worker/D1/Secret 不改动。
- 保留生产部署配置与地址；staging 部署命令必须明确指定环境，避免误发布生产。
- 明确 staging 邮件和模型的真实/模拟模式，不能让 staging 账号数据进入生产 D1；不要把 Secret 值写入仓库、日志或聊天。
- 增加配置检查与运维文档，记录所需资源、迁移、Secret 名称和健康检查。报告实际部署 URL、资源 ID、检查证据和任何凭据阻塞。

## 任务 B：移动端环境选择（独立会话）

- `development` EAS profile 的默认 Gateway 指向 staging，保留 developmentClient/internal；`preview` 与 `production` 指向 production。`acceptance` 继承开发设置并维持工具隔离。
- Expo Go 本地启动路径、开发包 staging/本地启动路径必须明确且可复现；手机的本地目标使用电脑局域网 IP 或安全隧道，不能写 `localhost`。
- 防止正式安装包接受 HTTP 或误连 staging；保留 Gateway URL 作为非秘密公开配置，模型和邮件密钥只在 Worker。
- 更新有意义的配置/安全测试与开发文档，报告可运行命令和 Expo config/JS bundle 的实际解析结果。

## 集成与统一验收（本会话）

1. 分别审查 A/B 的变更、验证输出和实际资源；集成到本分支，处理冲突与环境 URL。
2. 在最终代码上核对路由矩阵、Cloudflare D1 隔离、Secret 不泄漏、Expo Go 与开发包的本地/线上目标、preview/production 目标。
3. 运行最小充分的测试、类型检查、构建配置检查及必要的实际连通检查。
4. 从集成分支触发 iOS development build，记录 EAS build ID/链接、构建结果；若签名、账号、设备注册或额度受阻，保留已验证配置并如实报告。
5. 最终报告包含各环境 URL、启动命令、构建结果、验证证据及剩余限制。

## 风险与回退

- Staging 是外部资源，创建前核对 Cloudflare 账号和域名；部署前确认目标环境。回退 staging 时只撤回 staging Worker/路由，生产保持现有部署。
- EAS `EXPO_PUBLIC_` 值进入 JS bundle；切换本地/线上 Metro 后重新启动对应服务，已发行安装包必须重新构建或发布对应 channel 的更新。
- Expo Go 不含项目所有原生能力。SQLCipher、SecureStore 等以 development build 真机验收。

## 当前状态

- [x] 远端 main 已拉取并创建独立工作区/分支。
- [ ] A：staging Gateway。
- [ ] B：移动端环境选择。
- [ ] 集成验收。
- [ ] iOS development build。

## 2026-09-29 阶段记录

- Codex 集成分支 `b46ef35`；原工作区未提交改动未触碰。Cloudflare 浏览器账号与 Wrangler account_id 一致；Expo 浏览器和 EAS CLI 均为 `carter_wells`。
- 基线验证：Node 24 / pnpm 10 下仓库配置测试 123/123、移动端配置测试 12/12 通过。默认 Node 20 不满足项目 Node 要求，导致独立 pnpm 11 安全审计测试无法运行；切换 Node 24 后通过。
- Cloudflare 已有 staging Worker、独立 D1 和 staging-api.neijiecave.com；Gateway 会话负责复用并补齐配置/迁移。移动端会话负责路由和启动脚本。
- Apple Developer 团队 GS99UP3542 已确认，但用户暂时无法登录；设备注册、Ad-hoc 签名和真机 development build 等用户通知后继续。Resend 登录同样等待用户通知；现有 staging Secret 由 Gateway 会话核对。
