# 邮箱身份运维

邮箱身份服务用于验证码登录、会话恢复和云端账号删除。它不会接收或保存旅程、沟通卡、手记、反思或其他本机私密内容。

## 当前生产状态

- 已核对的生产地址是 `https://api.neijiecave.com`。邮箱认证已部署在 Cloudflare Workers，使用 D1 与 Resend；本架构不使用 Railway。
- 截至 2026-08-29，健康检查正常、D1 没有待应用 migration，Worker 已配置 `RESEND_API_KEY`、`AUTH_EMAIL_LOOKUP_KEY_V1` 和 `AUTH_OTP_KEY_V1` 三个 Secret binding。这里只记录配置名称，不记录值。
- 移动端默认使用生产地址。`EXPO_PUBLIC_GATEWAY_URL` 仅作为明确的开发或构建覆盖；HTTP 只允许在 `__DEV__` bundle 中连接经核对的本地 Gateway，非开发 bundle 会拒绝非 HTTPS 覆盖，手机不会静默回退到 `localhost`。
- 身份服务只保存账号和会话元数据。手记不会上传到 Worker 或 D1，也不存在远程手记正文表。

## 固定行为

- 发件人：`内界 CAVE <support@neijiecave.com>`，通过 Resend 投递；同一地址继续由 Zoho 接收回复。
- 登录和删除验证码：6 位数字、10 分钟有效、最多尝试 5 次。
- 投递限流：同一邮箱摘要每 15 分钟最多 3 次，同一安装令牌每 15 分钟最多 5 次。
- Access Token：不透明字符串，有效 15 分钟，只驻留移动端内存。
- Refresh Token：不透明字符串，有效 30 天；原文只存设备 SecureStore，D1 只存摘要并条件轮换。
- 云端账号删除：有效 Access Token、匹配邮箱、新验证码、一次性 5 分钟删除授权和 24 小时幂等收据。
- D1 不保存原始邮箱、验证码、令牌或任何本机私密内容。

## 本地配置

1. 在 `apps/gateway/.dev.vars` 中配置以下 Secret：

   ```dotenv
   RESEND_API_KEY=...
   AUTH_EMAIL_LOOKUP_KEY_V1=...
   AUTH_OTP_KEY_V1=...
   ```

2. 两个摘要密钥必须独立生成且至少包含 32 个随机字节。不得复用模型、邮件或其他用途的密钥。
3. 应用本地 D1 migration：

   ```bash
   corepack pnpm --filter @cave/gateway exec wrangler d1 migrations apply neijie-cave-auth --local
   ```

4. 在 `apps/mobile/.env.local` 中把 `EXPO_PUBLIC_GATEWAY_URL` 指向本地 Worker。
5. 运行 Gateway、契约测试、完整测试、类型检查、代码规范和 dry-run 构建。

没有 Resend 凭据时，自动化测试仍可使用注入的邮件发送器，但从 App 发起的真实验证码不能完成投递。

## 生产启用检查

1. 在 Resend 验证 `neijiecave.com`，确认 SPF、DKIM 和 DMARC 对齐，同时保留 Zoho MX 记录。
2. 核对 `wrangler.jsonc` 中的生产 D1 绑定，并显式应用所有 migration。
3. 在 Worker Secret 中配置 `RESEND_API_KEY`、`AUTH_EMAIL_LOOKUP_KEY_V1` 和 `AUTH_OTP_KEY_V1`；不得把它们放入 `vars` 或任何 `EXPO_PUBLIC_` 变量。
4. 为移动端构建设置经过核对的 HTTPS Gateway 地址。
5. 使用受控邮箱分别完成登录验证码和账号删除验证码测试。
6. 只检查路由、状态、延迟和不透明请求 ID 等白名单日志，确认没有邮箱、验证码、令牌或提供方响应正文。
7. 验证限流、错误验证码锁定、离线会话、Refresh Token 轮换、退出、删除重试，以及云端账号删除与本机数据删除的独立性。

## 移动端手记存储边界

- Development、Preview 与 Production 安装包使用 SQLCipher 保存本机私密内容，数据库密钥保留在设备 SecureStore。
- Expo Go 无法验证 SQLCipher。开发预览中仅手记、后来和阶段回顾写入专用明文 SQLite `cave-expo-go-journal.db`；只有用户明确把冻结沟通卡快照存入手记时，该快照才进入数据库。旅程草稿和实时沟通卡等其他 runtime 继续使用内存。
- Expo Go 删除事务会同步写入不含正文的持久清理标记。只有 `wal_checkpoint(TRUNCATE)` 返回 `busy=0` 且没有剩余日志帧时，安全清理才算完成。按账号删除还会保留账号 UUID tombstone，防止页面或进程重启后绕过清理或误报已删除手记仍被保留；该账号再次新建手记时会原子清除 tombstone。
- 同一 Expo Go 安装中，手记按稳定的服务端 `accountId` 分区。退出登录只清除会话；重新登录同一账号会再次显示该账号的本机手记，其他账号不能读取。
- Expo Go 与正式安装包使用不同沙箱，不共享本机记录。卸载 Expo Go、清除项目数据或主动删除后无法恢复。
- 两种 runtime 都不会上传手记。跨设备、跨安装或 Expo Go 到正式安装包的恢复，需要未来单独审核的用户主动导出、导入或上传设计。

## 密钥轮换

轮换邮箱索引或验证码摘要密钥时，增加独立的 `V2` Secret 并暂时保留 `V1`。新记录使用最新版本；成功验证旧账号后再迁移邮箱索引。旧挑战需要按记录的密钥版本继续验证。

发布 Secret 期间应暂停新的验证码请求，或者等待 10 分钟挑战有效期后再恢复，避免旧 Worker 实例继续生成仅能由旧密钥验证的挑战。只有在旧挑战全部过期且账号迁移条件满足后，才能移除旧版本。后续版本采用相同的密钥环方式。

## 故障处理

- Resend 失败时，使刚创建的挑战失效并返回统一的临时不可用响应，不得声称邮件已发送。
- D1 或必需 Secret 缺失时，身份接口失败关闭；健康检查、公开内容和本机移动功能仍可继续。
- Refresh 返回 401 时清除本机会话；网络错误保留 Refresh Token 并显示离线状态。
- 回滚 Worker 代码时不回滚已经应用的追加式 D1 migration。
- 生产故障排查不得把 D1 行正文、邮箱、验证码或令牌复制到日志、工单或支持邮件。

## 过期数据清理

验证码挑战、会话、限流桶、删除授权和幂等收据属于有期限的运行元数据。Worker 的每日定时任务按固定批量删除过期记录，并且只在积压达到处理上限时记录白名单事件。

监控只使用数量、路由、状态和延迟，不记录行正文或可关联用户的摘要值。邮件抑制记录需要经过单独的送达率复核后才能移除。
