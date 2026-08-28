# 内界 CAVE 官方网站、域名与邮箱设计

**日期：** 2026-08-28

**状态：** 已确认，等待实施计划

**范围：** `neijiecave.com` 官方网站、Cloudflare 域名与托管、Zoho Mail 官方支持邮箱

## 目标与已确认决策

为“内界 CAVE”建立可供用户访问、可供 Apple App Review 核验的简体中文官方网站，并使用同一域名提供真实可收件的官方支持邮箱。

- 已购买并激活主域名 `neijiecave.com`，注册商和权威 DNS 均使用 Cloudflare。
- 首版 App 不要求登录、不创建账号，也不启用 Resend 或 Supabase 邮箱 OTP。
- 官网仅提供简体中文，采用合规型品牌官网范围。
- 官网使用 Astro 静态输出，代码放在现有 monorepo 的 `apps/web`。
- 官网部署到 Cloudflare Pages，`https://neijiecave.com` 为唯一 canonical；`www.neijiecave.com` 永久跳转到主域名。
- 官方支持邮箱使用 Zoho Mail EU 数据中心，地址为 `support@neijiecave.com`。
- 官网运营者、隐私负责人和版权主体统一公开为个人法定姓名 `ZHIQI LIANG`（名在前）。
- 全站不加入数据库、登录、表单后端、Cookie 追踪、广告、第三方分析或在线聊天。

## 网站信息架构与内容

### 页面

1. `/`：品牌、产品宗旨、核心原则、七步体验、隐私与安全承诺。
2. `/privacy`：首版真实数据处理、保留、删除和设备级服务边界。
3. `/support`：官方邮箱、常见问题、本机数据删除指引和支持边界。
4. `/safety`：成年人范围、同意原则、非医疗器械与非紧急服务声明。
5. `/sources`：医学和教育来源、访问日期、内容类型及审核状态。

所有页面共享顶部导航、更新时间和页脚链接。页脚版权固定为 `© 2026 ZHIQI LIANG`。App Store 尚未正式发布前不显示商店徽章或下载按钮，也不展示占位下载地址。

### 首页内容

首屏依次展示 `Consent · Awareness · Voice · Exploration`、`CAVE 内界`、品牌主张“探索那些隐于沉默、未被好好说清的事。循着内心的回响，找到属于自己的靠近方式。”和安抚语“期待、紧张和犹豫，可以同时存在。”，并明确说明体验面向 18 岁及以上成年人。

首页固定呈现以下原则：

- 身体反应不等于同意。
- 同意针对具体行为，并且持续、可以撤回。
- 犹豫与期待可以同时存在。
- 私密探索默认留在用户自己的设备上。

七步体验仅以克制的文字卡片概述成年确认、共同过夜情境、身体认识、行为感受、回看需要、表达练习、私人准备与沟通卡。不展示敏感细节、待审核医学图或尚未实现的 AI、账号、云同步与商业功能。

### 隐私、支持与安全表述

隐私政策必须与发布构建一致，并明确：

- 首版无账号、无登录，不收集邮箱。
- 旅程选择、反思记录、练习结果、沟通卡和偏好保存在本机加密数据库中。
- CAVE 不将这些内容上传到自有服务器，不用于广告、画像或行为分析。
- 用户主动保存图片时内容进入系统相册；主动复制时内容进入系统剪贴板。
- 数据由用户保留到在 App 内删除；设备备份、相册同步和剪贴板属于 Apple 与设备设置的控制范围。
- 不把“加密数据库”“只给自己看”描述为设备被他人解锁后仍绝对不可见。
- 数据负责人写作 `ZHIQI LIANG（以内界 CAVE 名义运营）`，不把品牌名描述为独立法人；政策包含生效日期、更新方式和支持邮箱。

支持页提供 `support@neijiecave.com`、本机数据删除方法和常见问题。支持邮箱不是紧急服务，不提供医疗诊断、法律代理或危机干预。

安全页说明 CAVE 是成年人身体认知与同意教育工具，不是医疗器械，不诊断、治疗或判断用户是否“准备好”。全球页面只指引用户联系所在地紧急服务，不混用不同国家或地区的号码。

来源页区分医学事实、同意教育原则和产品引导语。列出来源机构、标题、链接、发布日期或访问日期及审核状态；“有来源”不得写成“已获医学认可”。

## 视觉与无障碍

官网沿用 App 的视觉系统：暖炭黑 `#171217`、深莓灰 `#241A22`、柔白 `#FAF5F7`、柔莓粉 `#D7A0B5`、品牌莓色 `#6D345A`、柔紫 `#927AA0` 与暖光 `#F2C7A5`。

- 使用 CSS 回响线、水纹和径向暖光，不使用人物、床、裸体、写实洞穴或 AI 生成主视觉。
- 中文标题优先宋体语气，正文使用清晰的系统无衬线回退；英文 `CAVE` 使用克制的细衬线风格。
- 桌面端扩大留白与分栏，移动端保持单列和清晰阅读顺序。
- 正文与交互达到 WCAG AA；支持键盘、可见焦点、语义标题、屏幕阅读器、200% 缩放和 `prefers-reduced-motion`。
- 任何状态不只依赖颜色表达，动画不承载必需信息。

## 技术与部署

### Astro 静态站

- 新增 `apps/web`，遵循根 workspace 的 pnpm、TypeScript、ESLint 和测试方式。
- 使用静态生成，不部署 Pages Functions、数据库或运行时 secrets。
- 站点元数据包含每页唯一标题与描述、canonical、Open Graph、favicon、robots.txt 和 sitemap。
- 生产构建不得包含占位文案、失效内部链接、未使用的 starter 内容或跟踪请求。
- 配置适合纯静态站的安全响应头，包括内容类型保护、点击劫持保护、合理的 Referrer Policy、Permissions Policy 和仅允许实际资源的 Content Security Policy。

### Cloudflare

- Cloudflare Pages 通过 GitHub 连接仓库；`main` 为生产分支，其余分支生成预览部署。
- 根域绑定 Pages，`www` 使用永久跳转指向根域。
- Registrar 保持自动续费、域名锁和 DNSSEC；注册联系邮箱必须长期有效。
- 网站 DNS 与邮件 DNS 分离管理。邮件 MX、TXT 和 DKIM 记录保持 DNS-only。
- 不创建通配符 DNS。`auth.neijiecave.com` 保留但不添加记录。

## Zoho Mail 与邮件认证

使用 `accounts.zoho.eu` 创建管理员组织，以 `.zoho.eu` 登录地址确认欧洲数据中心。管理员使用长期个人邮箱作为恢复联系方式。

- 优先使用当前数据中心提供的免费自定义域方案；若不可用，付款前由用户确认最低档 Mail Lite 的实时价格。
- 只创建 `support@neijiecave.com` 真实邮箱，不创建验证码、营销或群发地址。另创建 `dmarc@neijiecave.com` 管理别名，投递到支持邮箱并由过滤规则归档聚合报告，不占用独立用户席位。
- 在 Zoho Admin Console 添加 `neijiecave.com`，使用控制台生成的 TXT 或 CNAME 完成所有权验证。
- 只复制 Zoho EU 控制台当前显示的 MX、SPF 和 DKIM 值，不凭记忆填写区域端点。
- 根域只允许一条 SPF TXT 记录；添加其他发信服务时必须合并授权，而不是新建第二条 SPF。
- DKIM 在 Cloudflare 添加公钥、由 Zoho 验证并启用后才算完成。
- SPF 与 DKIM 全部通过后发布 DMARC。初始记录为 `v=DMARC1; p=none; rua=mailto:dmarc@neijiecave.com; adkim=s; aspf=s; pct=100`。连续至少 14 天只观察到预期的 Zoho 发信且对齐通过后，先改为 `p=quarantine; pct=25`；逐步提升到 `pct=100`，再评估 `p=reject`。任何新增发信服务必须先完成 SPF/DKIM 对齐，再提高策略强度。
- 密码、动态验证码、恢复码、API Key、SMTP 密码和任何私密密钥不得进入对话、仓库、日志或截图。

## 验收与故障处理

### 网站

- 五个页面通过 HTTPS 返回 200，`www` 永久跳转到 canonical 根域。
- 页面标题、描述、canonical、Open Graph、favicon、robots.txt 和 sitemap 均使用生产域名。
- 手机与桌面布局、键盘操作、屏幕阅读器顺序、200% 缩放、减少动态效果和 WCAG AA 对比度通过验证。
- 无占位文字、失效链接、追踪器、不必要第三方脚本或浏览器控制台阻塞错误。
- 隐私政策逐项匹配拟提交的 App 构建和 App Store Connect 隐私披露。

### 邮箱

- Gmail、Outlook 和 iCloud 分别完成收件、发件与回复测试。
- 完整邮件头显示 SPF、DKIM 和 DMARC 为 `pass`。
- 发件人名称、时区、签名和 Reply-To 正确；不存在的域内地址不会错误投递到其他邮箱。
- 官网支持链接可从外部网络打开邮件客户端，并能完成一次真实支持往返测试。

### 故障处理

- DNS 传播期间不反复删除和重建记录。
- 来源不明的 DNS 记录先确认用途，不直接删除。
- Zoho 域名验证、套餐、付款或 DNS 值与本设计不一致时，在产生费用或破坏性变更前停止并由用户确认。
- 首版不将 Resend、Supabase Auth 或 `auth` 子域混入根域 SPF、DMARC 与发布范围。

## 官方依据

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple App privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Apple platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)
- [Cloudflare Registrar：注册新域名](https://developers.cloudflare.com/registrar/get-started/register-domain/)
- [Cloudflare Pages：自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Pages：Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Zoho Mail：添加与验证域名](https://www.zoho.com/mail/help/adminconsole/add-domains.html)
- [Zoho Mail：邮件投递配置](https://www.zoho.com/mail/help/adminconsole/configure-email-delivery.html)
- [Zoho Mail：DKIM](https://www.zoho.com/mail/help/adminconsole/dkim-configuration.html)
- [Zoho Mail：DMARC](https://www.zoho.com/mail/help/adminconsole/dmarc-policy.html)
