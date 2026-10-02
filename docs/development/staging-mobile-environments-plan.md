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
- [x] A：staging Gateway 已部署。
- [x] B：移动端环境选择已合入。
- [x] 集成代码与环境验收；iOS 原生包已签名构建。
- [x] iOS development build 已生成 Ad Hoc IPA，并在真机通过热点 Metro 打开；房间端到端体验待验收。

## 2026-09-29 阶段记录

- Codex 集成分支 `b46ef35`；原工作区未提交改动未触碰。Cloudflare 浏览器账号与 Wrangler account_id 一致；Expo 浏览器和 EAS CLI 均为 `carter_wells`。
- 基线验证：Node 24 / pnpm 10 下仓库配置测试 123/123、移动端配置测试 12/12 通过。默认 Node 20 不满足项目 Node 要求，导致独立 pnpm 11 安全审计测试无法运行；切换 Node 24 后通过。
- Cloudflare 已有 staging Worker、独立 D1 和 staging-api.neijiecave.com；Gateway 会话负责复用并补齐配置/迁移。移动端会话负责路由和启动脚本。
- Apple Developer 团队 GS99UP3542 已确认，但用户暂时无法登录；设备注册、Ad-hoc 签名和真机 development build 等用户通知后继续。Resend 登录同样等待用户通知；现有 staging Secret 由 Gateway 会话核对。

## 2026-09-29 集成验收记录

- 集成分支已合入移动端 `bc15404`、Gateway `983bbfd` 和 staging live 模型 `c317750`；原工作区未提交改动未触碰。
- staging 专用 DeepSeek key 已作为 staging Worker `MODEL_API_KEY` Secret 配置；部署版本 `a1622817-5a73-4c9e-bbe5-16430d5875ff`。staging 与 production 的 `/health`、`/v1/meta` 均返回 HTTP 200；staging 元数据为 `providerMode: live`。Secret 名称核对通过，值未输出。真实 AI 调用与验证码邮件仍需受控账号端到端验收。
- 集成分支类型检查与 lint 通过；测试通过：移动端 168 套/1412 项、Gateway 29 套/279 项、仓库配置 14 套/123 项，以及启动脚本 4 项。staging Wrangler dry-run、移动端源码策略检查、production iOS JS 导出、Secret 扫描（45 个文件）和 acceptance 工具隔离检查均通过。
- 全仓 `verify` 在 `validate:content` 退出：既有 `internal_test_approved` 内容条目尚未满足 production 内容发布门槛；本分支没有修改 `packages/content`。其后的 Gateway 构建以 staging dry-run 单独完成。
- Apple Developer 团队已确认，用户暂时无法登录；因此尚未注册设备、取得 Ad-hoc 签名或创建可安装的 iOS development build。Resend 登录和真实邮件验收同样等用户通知。

## 2026-10-01 恢复记录

- PR #54 的远端分支此前停在 `cea6dfd`。本地从最新 `origin/main` `6543306` 合入两个新增提交，解决 SDK 基线测试与 pnpm 配置/锁文件的三处冲突；合并仍未推送。
- 依赖审计所需的 `undici` 与 `brace-expansion` 修复已由最新 main 的范围覆盖版本提供。合并后 `verify:internal` 的 15 项子检查中 14 项通过，包括类型检查、lint、移动端 176 套/1436 项测试、Gateway 与 web 构建、Expo Doctor、iOS 导出、Secret 扫描、acceptance 隔离及依赖审计。仓库配置测试中的 web lint 用例在并行负载下触发 5 秒超时；单独重跑 `test:ci-config` 为 14 套/126 项通过，未修改超时阈值。
- staging `/health` 返回 HTTP 200。新 main 的房间功能仍缺少真实模型质量验收与部署所需的加密密钥、白名单和 D1 迁移；staging 的 `ROOMS_ENABLED` 保持关闭，不作为本次 development build 的可用功能。
- Expo 已确认 `@carter_wells/cave` 的 development Ad Hoc 凭据有效，Apple 团队为 `Zhiqi Liang / GS99UP3542`，已登记目标 iPhone（UDID 尾号 `401C`）。用户确认先更新 PR、等待 CI，再发起 development 云构建；构建前再次核对最终代码和目标。

## 2026-10-01 staging 双人房间启用

- 用户要求双人房间在 staging 开启，且允许所有已注册的 staging 账号创建。staging 的 `ROOMS_ENABLED=true`、`ROOMS_CREATOR_ACCOUNT_IDS=*`；服务端仍检查登录态与持久化成年声明。生产 Worker 配置与环境资源未部署或修改。
- staging D1 `014af9e1-ebb2-4b46-aaf2-c9ce2b4de6e6` 已执行 `0004_rooms.sql`，后续查询显示无待处理迁移。32 字节随机加密密钥仅保存为 staging Worker 的 `ROOM_ENCRYPTION_KEY_V1` Secret；密钥值未写入仓库、日志或聊天。
- staging Worker `neijie-cave-gateway-staging` 部署版本 `a081b5af-7ad0-47c5-8a79-8a1403739f52`。线上 `/health`、`/v1/meta` 均为 200，未认证的 `/v1/rooms` 为 401 `AUTH_UNAUTHORIZED`，证明房间路由已挂载并要求登录。
- staging 配置检查、房间/应用/部署配置测试 41 项、Gateway 类型检查与 Worker dry-run 通过。真实双人账号完整流程及模型报告质量尚未做端到端验收，须在安装 development build 后实测；不能据此声称报告内容质量已合格。

## iOS development 构建恢复

- PR #54 的提交 `0f868b0` 经三个 CI 检查通过。首次 EAS 构建 `d9c253cf-9224-451f-972e-e069e2211c76` 在 `Configure Xcode project` 失败：凭据指向 target `CAVE`，development 预构建却因动态应用名生成了 `CAVEDev`。
- 修复为所有 profile 共用原生应用名 `内界 CAVE`，仅通过 iOS `CFBundleDisplayName` 设置开发/预览包的图标显示名。development Expo 配置解析为原生名 `内界 CAVE`、显示名 `内界 CAVE Dev`，当前 Expo iOS 名称规范化代码把原生名映射为 `CAVE`；身份与本地网络权限测试 20 项、移动端类型检查通过。Windows 不支持本地生成 iOS 工程，最终 target 与签名由下一次 EAS 构建验证。
- 修正配置安全测试后，PR #54 的代码提交 `22b13fa` 三项 CI 检查全部通过。第二次 EAS iOS `development` / Ad Hoc 构建 `a87d70bd-15d7-4c6c-8cf4-ad1a5cdcc89d` 以该提交完成，`CONFIGURE_XCODE_PROJECT` 阶段成功为 `CAVE` target 指派 GS99 描述文件。[EAS 构建页面](https://expo.dev/accounts/carter_wells/projects/cave/builds/a87d70bd-15d7-4c6c-8cf4-ad1a5cdcc89d) 可获取安装包，IPA HEAD 返回 200（27,168,010 字节）。真机安装、staging 双人账号流程和真实模型报告质量仍待设备端验收。

## development 与 alpha 同机安装

- 历史 alpha 构建 `1e030993-6e85-45b7-8e59-f41730bcee0a` 和首次成功的 development 构建均使用 `com.neijie.cave`；读取后一构建的 IPA `Info.plist` 已确认图标名以“Dev”结尾，但同一 Bundle ID 使两包互相覆盖。
- 仅将 `development` 的 iOS Bundle ID 改为 `com.neijie.cave.dev`，继续使用“内界 CAVE Dev”显示名与 staging 默认 Gateway。`acceptance`、`preview`、`production` 保留 `com.neijie.cave`，以维持现有升级验收路径。
- PR #54 的代码提交 `d79cabf` 三项 CI 检查全部通过。配置凭据时显式设置 `EAS_BUILD_PROFILE=development`，在 Apple `Zhiqi Liang / GS99UP3542` 团队注册 `com.neijie.cave.dev`，Ad Hoc 描述文件 `B6FRR5R786` 包含两台已登记 iPhone。首次只传 EAS `--profile development` 的凭据命令误读旧 ID；重新配置后输出确认了新 ID 和团队。
- [EAS iOS development 构建 `5705c7ca-059e-41df-9614-fbbf1c373938`](https://expo.dev/accounts/carter_wells/projects/cave/builds/5705c7ca-059e-41df-9614-fbbf1c373938) 使用提交 `d79cabf`、staging Gateway、内部 Ad Hoc 分发，状态 `FINISHED`。实际 IPA `Info.plist` 已核对 `CFBundleIdentifier=com.neijie.cave.dev`、`CFBundleDisplayName=内界 CAVE Dev`、`CFBundleName=CAVE`。真机同机安装及业务流程仍待设备端验收。

## 2026-10-02 Development Build 热点连接

- 用户选择后续真机调试优先由 iPhone 开个人热点、电脑加入热点，再使用电脑的热点 IPv4 和 Metro 端口 `8084`。本次电脑地址为 `172.20.10.4`；地址随网络重连可能变化，不作为固定配置。
- Tailscale `100.80.218.41:8084` 的 HTTP manifest 在电脑侧可访问，但 iPhone Development Build 报 App Transport Security 要求安全连接。Tailscale HTTPS Serve 尚未在 tailnet 启用；已关闭此前的 TCP 转发，改用热点局域网连接，无需新原生构建。
- iPhone Safari 访问 `http://172.20.10.4:8084/status` 显示 `packager-status:running`；Metro manifest 和 iOS JS 包均返回 HTTP 200，且 manifest 指向该热点地址。用户手动输入 `http://172.20.10.4:8084` 后确认 Development Build 已打开应用。Gateway 仍为 staging；双人房间完整流程及真实模型报告质量尚待真机验收。
