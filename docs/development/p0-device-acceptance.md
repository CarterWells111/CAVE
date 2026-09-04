# P0 内部验收清单（现行）

本清单取代归档计划中的执行状态；不改变产品流程或专业内容审核结论。工程负责人：Codex；真机验收负责人：项目负责人（用户）。仅在受测 iPhone 上使用合成内容和专用测试邮箱。

## 两层关闭标准

“工程就绪”要求代码、全量门禁、可安装包、版本清单和步骤均完成；“真机通过”必须由用户实际执行并保存证据。未运行、失败、受阻均不得填“通过”。安装包缺失时不得宣称验收就绪。正式发布继续受专业内容审核门禁阻塞。

| 项目 | 工程状态 | 真机状态 | 关闭条件 |
|---|---|---|---|
| 导航类型生成 | 代码与自动化已验证 | 不适用 | 无/旧/新缓存均通过；非法目标编译失败 |
| 导航、深链、返回 | 自动化与脚本已准备；待安装包 | 待用户验收 | 路由集成与设备流程均通过 |
| 数据库迁移/回退 | 真实 SQLite 自动化已验证；待原生包 | 待用户验收 | SQLite 数据保留、回滚重开及原生升级通过 |
| SQLCipher/Keychain/删除恢复 | 故障注入与开发 bundle 已验证；待签名包 | 待用户验收 | 故障注入、加密连接、锁屏与中断恢复通过 |
| P0 门禁与安装包 | 审计接口超时；签名包待准备，未达工程就绪 | 待用户验收 | 同一冻结提交的两个包可安装且版本可追溯 |

以上为本轮代码准备状态，不是设备通过记录。最新冻结提交、每项退出码和构建阻塞以 `outputs/p0-readiness` 的报告为准。npm 审计端点超时必须重试成功后才能关闭完整门禁；不新增忽略规则绕过该检查。

## 工程证据与执行

固定 Node `.nvmrc`（22.23.2）、`packageManager` 中的 pnpm 10.34.5；先运行 `corepack pnpm install --frozen-lockfile`，再运行 `corepack pnpm verify:internal`。CI 使用相同入口。报告写入 `outputs/p0-readiness/verification.json`，记录每个命令、退出码、时间、Node、提交 SHA 和工作区是否有已跟踪修改。未冻结提交的报告只能作为开发中证据。

- 导航生成：`corepack pnpm --filter @cave/mobile typecheck`；仓库测试 `tests/mobile-route-types.test.ts` 含三种缓存及不存在路由的反例。
- 路由：`router-navigation.integration.test.tsx` 使用实际路由文件树；业务边界替身不等于真机执行。
- 存储：`database.integration.test.ts` / `delete-all-data.integration.test.ts` 使用真实 SQLite 文件。`src/test/storage/historical-fixtures.ts` 的冻结历史结构包含来源提交；不能把这些结果称为 SQLCipher 验证。
- 验收工具：`src/features/acceptance` 的故障注入与原生适配测试；`corepack pnpm --filter @cave/mobile export:acceptance` 单独导出开发 bundle 并扫描秘密。正式 iOS 导出另行扫描验收标识，防止工具进入生产包。
- Maestro：`.maestro/*.yaml` 仅静态准备，执行输出另行留存；不得将 YAML 可解析记为设备通过。

## 安装与安全边界

版本模板见 [p0-build-manifest.json](p0-build-manifest.json)，本轮实际结果保存在 `outputs/p0-readiness/build-manifest.json`（构建未成功则无安装链接）。Preview 预定构建编号3，用于无开发工具的正常流程；acceptance 预定编号4，用于原生故障实验，需同一提交启动 Metro：`corepack pnpm --filter @cave/mobile start:acceptance`。必须同时满足开发 JS、environment=acceptance、acceptanceTools=true 才显示“P0 验收工具”。普通开发包和 Preview 不应显示该入口。

两个包使用同一个 bundle ID `com.neijie.cave`，会相互覆盖，不是同时安装的两款应用。先正常验收 Preview，再覆盖安装 acceptance；切换可能保留 App 沙箱及 Keychain，卸载则可能清除沙箱但保留 Keychain。禁止用卸载作为清理或升级验证步骤。删除/中断场景最后执行，且只能使用合成数据。

验收工具只操作 `cave-acceptance.db`、`cave.acceptance.*` 和专用合成档案；不会给真实 `cave.db` 注入旧 schema，不会删除真实账号资料。检查结果只含版本、计数、存在性及布尔结果，无正文或密钥。工具无法代替主应用删除链路的真实验收。

## 按顺序执行

每例记录：设备/iOS、包构建 ID/编号、提交 SHA、时间、前置状态、操作、结果（通过/失败/未执行）、截图或录像路径、恢复结果。隐去邮箱、设备标识及任何非合成内容；严禁保存密钥。

| 编号 | 前置状态与操作 | 预期 | 失败证据及恢复 |
|---|---|---|---|
| N01 | Preview，仅合成数据；首次公开首页依次点击首页/练习/内界手记/我的；未声明时打开 `cave:///journal` 与旅程地址 | 仅四个底栏；受限内容先经过成年声明，不闪现正文；回顾从“我的”进入 | 录像与 URL；退出到首页，不跳过声明 |
| N02 | 从“开启旅程”声明成年，选择称呼；跑 `.maestro/core-flow.yaml` | 主旅程 1/5 至 5/5；练习独立；保存后可进入练习/首页 | 失败页与步骤；返回或重试，不删库 |
| N03 | 保存前后、保存进行时尝试返回/切 Tab/退出；中途杀进程再开；跑 restart-recovery 与 back-edit | 保存期间导航被阻止；恢复最后成功草稿；已完成回顾能分支、返回修改 | 录屏及重开后的计数/页面；保留数据重试 |
| N04 | 成年但未登录；冷/热启动打开手记具体 URL，登录专用测试账号；取消登录后再打开 | 登录成功回到原手记；取消可回公开页；无上一页时返回首页 | URL与录像；重新登录，不手工修改账号归属 |
| N05 | 测试账号 A 创建合成记录，记下 ID；运行 deep-links、journal-restart；用已存在/失效/编辑/补充地址分别冷/热进入；切换到账号 B | 有效记录保存重启仍在；失效 ID 可安全返回；账号 B 及过渡期间不能看到 A 正文 | 录屏，A/B状态与 ID（仅合成）；退出并重新进入正确账号 |
| K01 | acceptance 创建 v11；运行“SQLCipher 无密钥 / 错密钥 / 正确密钥探测” | 无/错密钥失败，正确密钥读取成功；三个独立连接 | 仅布尔结果；失败保留库，不重新初始化 |
| K02 | 上一步后杀进程重开、锁屏再解锁、重启设备后首次解锁再开；使用 Keychain 诊断 | `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` 首次解锁前不可访问时安全失败，解锁可恢复；普通锁屏仍可读不是缺陷 | OS时间与结果；解锁重试；工具的模拟不可访问仅是自动化补充，不冒充系统实测 |
| M01 | 优先在可安装的旧签名版本录入合成数据，保留安装，覆盖新 Preview | 数量、正文、关联、账号归属、偏好保持；版本升级至12 | 两包ID/SHA、前后记录；停止操作并保留旧库 |
| M02 | 无可安装旧包时明确标记“合成 schema 基线”；工具分别创建 v6-legacy-collision/v11，升级、检查 | 旧冲突/账号归属迁移不丢数据；不能称历史二进制升级通过 | 夹具ID、版本、计数；故障时检查原版本后重试 |
| M03 | v11工具夹具；提交前注入故障，再检查并重试；重新创建夹具后“迁移到 v12 提交前暂停”，系统强制结束并重开 | 未提交迁移回滚至11；重新升级成功；不自动删除/建空库 | 暂停阶段与重开元数据；保留库再次升级 |
| M04 | 向前策略；自动化用高版本、损坏、锁竞争、无/错密钥、缺库夹具验证；仅在具备旧二进制时另做真实回退 | 旧应用面对高 schema 停止打开，数据保留；不向下迁移 | 原文件哈希与错误码；恢复新包，禁止删库解决 |
| D01 | 工具创建合成夹具，逐一选择9个删除暂停阶段；点删除，停在指定阶段后系统杀进程，再启动 | 持久化意图存在时启动续删；删除完成前不建新密钥/库；重试幂等 | 阶段、重启前后 metadata；恢复检查/重启，不手动清 Keychain |
| D02 | D01每次删除完成后，先“检查元数据（不升级）”，再决定创建下个夹具 | 数据库/WAL/SHM、合成密钥、资料、令牌、会话、声明、意图均不存在 | 存在性截图；有残留则保留证据并重试清理，禁止立即初始化掩盖残留 |
| D03 | Preview主应用只有合成内容；手动启用离线，再执行 offline-delete；恢复网络后重开 | 正常删除真实业务测试数据后回首页，重开不恢复旧内容；不会显示新空库掩盖失败 | OS离线状态与页面录像；删除失败重试，启动应续删 |

Maestro iOS 执行需 macOS 和已安装 App；Windows 的静态 YAML 校验不能证明执行结果。示例：`maestro test .maestro/core-flow.yaml`，`maestro test -e RECORD_ID=<合成记录ID> .maestro/journal-restart.yaml`。开发包启动时先连接 Metro；系统重启测试可因 Metro不可达暂停，恢复连接后重试并如实记录。

## 外部条件与正式发布

EAS内部 ad hoc 构建需要有效签名资料及已注册设备。构建不成功时记录具体服务错误，不上传 App Store、不替用户批准设备或签署条款。参考 [Expo 内部分发](https://docs.expo.dev/build/internal-distribution/)。

专业审核及生产内容校验仍是正式发布阻塞。`verify`、`verify:release` 保持生产要求；`verify:internal` 通过不等于生产可发布，也不等于真机通过。
