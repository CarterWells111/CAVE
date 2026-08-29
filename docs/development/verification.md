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

该命令访问包注册表并根据仓库中记录的审计策略检查生产依赖。网络不可用时应记录为未执行，不得把网络失败解释为无漏洞。

## 建议的完整本地检查

```bash
corepack pnpm test:ci-config
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm validate:content:internal
corepack pnpm build:gateway
corepack pnpm build:web
```

完成后再运行 `git diff --check`，并人工检查 README、文档导航、Mermaid 图和所有公开链接的渲染结果。
