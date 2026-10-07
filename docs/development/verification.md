# 验证指南

验证命令应从仓库根目录运行。文档记录稳定的命令和覆盖范围，不绑定某个分支、提交或固定测试总数。

## 基础质量门

| 目标 | 命令 | 覆盖范围 |
| --- | --- | --- |
| 仓库级契约 | `corepack pnpm test:ci-config` | CI、安全扫描器、配置和公共文档契约 |
| 类型检查 | `corepack pnpm typecheck` | 所有声明了 `typecheck` 的 workspace 项目 |
| 代码规范 | `corepack pnpm lint` | 移动端、Gateway、官网和共享包 |
| 自动化测试 | `corepack pnpm test` | 移动端 Jest、其余项目 Vitest、官网静态构建测试 |
| Gateway 构建 | `corepack pnpm build:gateway` | Wrangler dry-run，不部署远程资源 |
| 官网构建 | `corepack pnpm build:web` | Astro 静态站点输出 |

## 内容校验

内容包提供三个不同边界的校验命令：

```bash
corepack pnpm validate:content:draft
corepack pnpm validate:content:internal
corepack pnpm validate:content
```

- `draft` 验证结构和来源引用，允许草稿状态。
- `internal` 只允许已经完成团队内部复核的演示内容。
- 无后缀命令是生产门禁，只接受正式复核状态。

当来源台账仍标记 `expert_review_pending` 或内容仅为内部复核状态时，生产校验失败是预期的安全结果。不得为了让命令变绿而伪造复核人、复核日期或审核状态。

## 移动端原生检查

```bash
corepack pnpm --filter @cave/mobile expo:doctor
corepack pnpm --filter @cave/mobile export:ios
corepack pnpm security:scan-bundle
```

这些命令可以验证 Expo 依赖、导出 iOS JavaScript 和扫描明显凭据，但不能证明真实设备上的 SQLCipher、Keychain、照片权限、VoiceOver、性能或升级迁移。相关结论必须来自签名设备上的单独验收。

## 生产依赖审计

```bash
corepack pnpm security:audit
```

该命令通过 `scripts/security-audit.mjs` 调用 `tools/security-audit` 中单独锁定的 pnpm 11.25.0，只执行 `audit --prod --audit-level high`。默认连接官方 npm bulk advisory 接口，传输锁文件中的第三方包名和版本；不传输源码、私密正文或密钥。网络不可用、服务响应无效或锁文件缺失时返回非零，不得把审计未完成解释为无漏洞。

安装和其他生命周期命令仍使用根目录锁定的 pnpm 10.34.5 / `.nvmrc` 中的 Node 22.23.2；不要为审计运行 pnpm 11 install 或全局替换 pnpm。独立工具 workspace 避免其可执行文件覆盖根目录 pnpm。审计启动器的 `--pm-on-fail=ignore` **仅禁止自动切换回根目录的 pnpm 10**，不是忽略漏洞；`high` 阈值仍生效，精确 GHSA 豁免逐项记录在 `pnpm-workspace.yaml`。首次检出先执行 `pnpm install --frozen-lockfile`，不要使用仅生产依赖安装来运行开发门禁。

两个精确豁免 `GHSA-w3rx-r6r6-pgpr` 与 `GHSA-5p2g-fcmc-qvqq` 都来自 `react-native -> Metro -> image-size@1.2.1` 的资源构建链，不进入移动端 JavaScript 运行时。上游截至 2026-09-05 仍无修复版本；仓库通过 `patches/image-size@1.2.1.patch` 阻断 ICNS 的零长度条目以及 JXL/HEIF 共用 box 解析器中的零尺寸循环，并由 `tests/image-size-security.test.ts` 在隔离子进程及一秒超时内验证 ICNS 与 JXL 恶意样本终止及合法 JXL 尾框行为。豁免只能与该补丁和测试同时存在；上游发布修复版后应优先升级并同时删除补丁及两个豁免。

`GHSA-86w9-cpqp-85rv` 涉及 Expo CLI 的签名证书工具链中 `node-forge@1.4.0` 的 RSA PKCS#1 v1.5 签名验证。上游截至 2026-10-02 [尚无已发布修复版](https://github.com/advisories/GHSA-86w9-cpqp-85rv)，其[修复 PR](https://github.com/digitalbazaar/forge/pull/1152)仍待合并。仓库采用同一处内层 `DigestAlgorithm` 字段数量校验，保存在 `patches/node-forge@1.4.0.patch`；`tests/node-forge-security.test.ts` 验证合法签名仍可通过、带额外内层元素的签名被拒绝。审计仅对这个精确 GHSA ID 豁免，因为 npm 公告无法识别本地补丁；补丁、锁文件和回归测试必须同时保留。上游发布修复版后应升级并移除补丁与豁免。

`decode-uri-component@0.5.0` 与 `uuid@11.1.1` 通过精确 override 消除 `GHSA-vcc3-ghjq-m6fr` 和 `GHSA-w5hq-g745-h8pq`。前者经 Expo Router 进入查询串运行路径；由于安全版改为 ESM 默认导出，而 Expo Router 当前依赖的 `query-string@7.1.3` 和 Jest 29 仍按 CommonJS 加载它，`patches/decode-uri-component@0.5.0.patch` 保持修复算法不变，仅恢复 CommonJS 包装。后者仅经 Expo config-plugins 的 `xcode` 进入 iOS 配置构建链。`tests/dependency-advisory-compatibility.test.ts` 同时验证畸形 URL 有界返回以及 `xcode` 所需的 CommonJS `uuid.v4()` API。

2026-10-07 的四条未豁免公告通过精确 override 修复，覆盖锁文件中的全部调用链：

| 依赖 | 固定版本 | 维护方公告 |
| --- | --- | --- |
| shell-quote | 1.11.0 | [GHSA-pqg4-j6r4-53mv](https://github.com/ljharb/shell-quote/security/advisories/GHSA-pqg4-j6r4-53mv) |
| source-map-js | 1.2.2 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)、[维护方发布说明](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) |
| compression | 1.8.2 | [GHSA-vc2v-76pw-4v95](https://github.com/expressjs/compression/security/advisories/GHSA-vc2v-76pw-4v95) |
| sharp | 0.35.5 | [GHSA-wq5f-xc86-pv6w](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) |

Sharp override 同时覆盖 Astro 的生产可选依赖和 Miniflare 的开发依赖，平台二进制使用 0.35.5、libvips 包使用 1.3.4。现有六个本地补丁、四条精确 GHSA 豁免、审计启动器和 high 阈值保持原样。

`tests/production-dependency-compatibility.test.ts` 沿实际调用方解析依赖，验证 React DevTools 所需的普通 editor 参数解析及引用、PostCSS source map 与合法 indexed map、Expo 的 bundle/map gzip 响应与普通路径跳过压缩，以及 Astro 的内存 PNG → WebP 缩放和 Sharp 内置 librsvg 2.63.2。测试使用合成数据和本机 HTTP，不执行 shell 载荷或网络拒绝服务。React DevTools 的发布 bundle 含内嵌解析器，override 更新其声明依赖；这些检查验证安全门禁和当前构建接口兼容，不能据此声称已替换所有内嵌代码或证明生产运行时存在可利用漏洞。

原因见 [pnpm 11 官方发布说明](https://github.com/pnpm/pnpm.io/blob/main/blog/releases/11.0.md)：旧 `audits/quick` 接口已退役，应使用 `advisories/bulk`，不能无限重试旧接口。`tests/security-audit.test.ts` 使用真实审计 CLI 和本机 HTTP 服务，验证 v9 锁文件的直接、传递、可选及 workspace 生产依赖覆盖、开发依赖排除、阈值、精确豁免、错误/超时阻断和文件不被重写。本机合成服务测试不替代对官方 npm 服务执行的真实审计。

审计工具还应用 `patches/pnpm@11.25.0.patch`：上游会跳过非法公告 ID、未知严重度或无效版本范围，可能将坏报告误报为干净结果；此补丁在响应校验处拒绝这些字段，沿用上游的非零错误出口。它不改变合法漏洞匹配、严重度阈值或任何豁免。升级审计工具时必须先复验补丁及上述真实 CLI 测试，不能静默移除校验。

## CI 下载缓存与安装耗时

GitHub 的每个 job 仍在独立的临时环境中运行，不复用开发电脑的安装目录。CI 分两层复用下载：`actions/cache` 保存 pnpm 工具引导安装的 npm `_cacache`，现有 `setup-node` 的 `cache: pnpm` 保存项目依赖 store。工具缓存按系统、架构、工作流和 Node 版本文件区分，不缓存凭证、安装日志、`node_modules` 或审计结果。缓存未命中仍执行正常联网安装；缓存命中也不跳过固定版本的工具安装、`pnpm install --frozen-lockfile` 和完整验证。

`pnpm/action-setup@v6` 内部执行 `npm ci`，且每次删除并重建工具安装目录，因此仅缓存该目录没有收益。只在这一引导安装步骤设置 `npm_config_audit=false`、`npm_config_fund=false` 和 `npm_config_prefer_offline=true`，避免工具安装附带的旧审计请求，优先复用已校验的下载包。这些环境变量不作用于后面的项目检查；独立 `security:audit` 仍每次联网获取最新漏洞信息，错误与高危门槛不变。依据：[官方引导安装实现](https://github.com/pnpm/action-setup/blob/v6/src/install-pnpm/run.ts)。

优化前 PR CI33853322124 attempt2 的 pnpm 准备用时 329 秒、项目依赖安装 10 秒、15 项内部门禁 212 秒。优化后的冷缓存和暖缓存耗时必须以 CI 日志实测记录；不将缓存命中当作验证通过，也不保证外部服务的响应时间。本轮保留 push/PR 两条检查与既有发布策略，不恢复 EAS 打包或改变 CodeQL 的启停状态。

## 建议的完整本地检查

```bash
corepack pnpm verify:internal
```

完成后再运行 `git diff --check`，并人工检查 README、文档导航、Mermaid 图和所有公开链接的渲染结果。

内部入口要求 `.nvmrc` 中的 Node 22，覆盖上述检查、移动端源码策略、Expo Doctor、iOS 导出、包秘密/验收工具隔离扫描及生产依赖审计。每项退出码与提交信息保存在 `outputs/p0-readiness/verification.json`。移动端类型检查会先运行 `routes:generate`，从实际路由重建 `.expo/types/router.d.ts`，不提交生成缓存。

设备操作及两层关闭标准见 [P0 现行验收清单](p0-device-acceptance.md)。生产 `verify` 和 `verify:release` 继续要求专业内容复核，不能用内部通过替代。


`GHSA-vfj7-8cjw-p6xm` 涉及 Metro 文件匹配工具链的 `braces@3.0.3`。截至 2026-10-04 上游 npm 最新版仍为 3.0.3，[公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)未提供修复版本。[问题 #70](https://github.com/micromatch/braces/issues/70)中的深嵌套模式在原有 10,000 字符限制以内仍会触发递归栈溢出；仓库已用 9,003 字符样本复现。`patches/braces@3.0.3.patch` 将解析器及 compile / expand / stringify 的 AST 遍历限制在 128 层，以受控 SyntaxError 拒绝过深输入。`tests/release-dependency-security.test.ts` 通过实际 Metro 安装链验证括号、花括号、混合及未闭合模式、直接传入 AST、边界深度与正常 glob 行为。仅对此精确 GHSA 豁免，必须同时保留补丁、锁文件及测试；上游修复后优先升级并删除补丁和豁免。

`http-cache-semantics` 精确升级到 4.3.0，不增加 [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) 豁免。公告只列出 <=4.2.0，因此 npm 审计在升级后不再报告它，但实测 4.3.0 仍可复现相同问题；不能单凭审计版本范围认定修复。`patches/http-cache-semantics@4.3.0.patch` 在 evaluateRequest 中复用 maxAge 的安全禁止条件，拒绝 no-store / private / no-cache 及共享 Set-Cookie（未明确允许 public 或 immutable）/ proxy-revalidate 响应绕过重新验证。同一测试通过 Astro 的实际安装链验证安全响应不能被请求 max-stale 绕过，普通 public 新鲜和自然过期缓存仍正常工作。上游真正修复后升级并移除本地补丁。
