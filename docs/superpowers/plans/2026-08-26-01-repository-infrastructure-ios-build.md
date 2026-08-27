# 01 仓库基础设施与 iOS 构建实施计划

> 执行要求：按复选框逐项实施；使用 `superpowers:test-driven-development` 完成代码任务，并在宣称完成前使用 `superpowers:verification-before-completion`。

**目标（Goal）：** 在任何产品功能开始前，建立 pnpm workspace、可运行的 Expo/Worker 外壳、基础 CI，并把 Development Build 安装到真实 iPhone。

**架构（Architecture）：** 根 workspace 管理一个 Expo Router App、一个 Cloudflare Worker 与四个共享 Package。原生配置通过 Expo CNG 固化，EAS 负责 iOS 签名和内部发布。

**技术栈（Tech Stack）：** Git、Node 22、pnpm 10、TypeScript、Expo SDK 57、Expo Router、EAS CLI、Cloudflare Workers、Wrangler、Vitest、GitHub Actions。

---

**依赖计划：** 仅依赖总索引。  
**输入：** 空仓库、可用 Apple Developer/Expo 账号、真实 iPhone、既定 Bundle ID。  
**输出：** 可运行 workspace、Worker `/health`、基础 CI、已注册 iPhone、已安装 Development Build。  
**明确排除：** 领域类型、AI 调用、SQLCipher 表结构、产品页面。  
**预计时间：** 4 小时。**负责人：** 全栈工程师。

## 准确文件路径

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json
.gitignore
.env.example
apps/mobile/package.json
apps/mobile/app.config.ts
apps/mobile/eas.json
apps/mobile/app/_layout.tsx
apps/mobile/app/index.tsx
apps/mobile/src/features/health/health-screen.test.tsx
apps/gateway/package.json
apps/gateway/wrangler.jsonc
apps/gateway/src/index.ts
apps/gateway/src/index.test.ts
packages/{contracts,content,scenario-engine,test-fixtures}/package.json
.github/workflows/ci.yml
```

## 任务 1：初始化 Git 与 workspace

**文件：** 根配置文件与各 Package manifest。

- [ ] 运行 `git init`；运行 `git status --short`，预期退出码为 0。
- [ ] 创建 `pnpm-workspace.yaml`，仅包含 `apps/*` 与 `packages/*`。
- [ ] 创建根 `package.json`：`name: neijie-cave`、`private: true`、`packageManager: pnpm@10`、`engines.node: >=22 <25`，并加入使用 `@cave/*` filters 的 `dev:mobile`、`dev:gateway`、`typecheck`、`lint`、`test`、`build:gateway`、`verify:foundation`。
- [ ] 创建 `tsconfig.base.json`，开启 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、`useUnknownInCatchVariables`。
- [ ] 创建 `.gitignore`，覆盖 Node、Expo、EAS local、Worker state、构建产物、`.env*`（保留 `.env.example`）和 provisioning 文件。
- [ ] 为所有 workspace 创建最小 `package.json` 后运行 `pnpm install`。
- [ ] 运行 `pnpm -r list --depth -1`；预期列出全部 workspace 且生成 `pnpm-lock.yaml`。
- [ ] 提交：`git add . && git commit -m "chore: initialize workspace"`。

## 任务 2：建立 Expo App 外壳

**文件：** `apps/mobile/**`。

- [ ] 运行 `pnpm dlx create-expo-app@latest apps/mobile --template default@sdk-57`。
- [ ] 将 Package 名改为 `@cave/mobile`，删除模板演示路由和无用资源。
- [ ] 创建 `app.config.ts`：`owner: carter_wells`、`slug: cave`、`scheme: cave`、`version: 0.1.0`、iOS Bundle ID `com.neijie.cave`、开启 typed routes；不得配置 `android.package`。
- [ ] App 名称按环境固定映射：production 为 `内界 CAVE`、development 为 `内界 CAVE Dev`、preview 为 `内界 CAVE Preview`。
- [ ] 让 `app/_layout.tsx` 只承载 Provider 与 Stack；`app/index.tsx` 只负责读取 runtime version、build、environment metadata 并传给 `HealthScreen`；`HealthScreen` 显示 `内界 CAVE`、`听见身体，确认边界。`、version、build 和 environment。
- [ ] 添加 `start`、`typecheck`、`lint`、`test`、`test:watch`、`expo:doctor` scripts。
- [ ] 先写失败测试，精确断言健康页显示 `内界 CAVE`、`听见身体，确认边界。`、`version 0.1.0`、`build local` 与 `development`；运行 `pnpm --filter @cave/mobile test`，预期因批准品牌或 metadata 文案缺失而失败。
- [ ] 实现 `HealthScreen` 品牌与 metadata 展示；再次运行同一命令，预期上述五项精确断言全部通过。
- [ ] 运行 `pnpm --filter @cave/mobile expo:doctor`，预期全部检查通过。
- [ ] 提交：`git commit -am "feat: add expo application shell"`。

## 任务 3：建立 Worker 与健康检查

**文件：** `apps/gateway/package.json`、`wrangler.jsonc`、`src/index.ts`、`src/index.test.ts`。

- [ ] 创建 `@cave/gateway`，依赖 Hono、Zod、Vitest、Wrangler 与 Workers types。
- [ ] 配置 Worker name `neijie-cave-gateway`、compatibility date `2026-08-26`，以及 `MODEL_MODE=mock`、`PROMPT_VERSION=2026-08-26.1`、`POLICY_VERSION=2026-08-26.1`。
- [ ] 先写失败测试：`GET /health` 返回 200 与 `{ "status": "ok", "contractVersion": "1" }`。
- [ ] 运行 `pnpm --filter @cave/gateway test`，预期 404 或断言失败。
- [ ] 实现 Hono route；重跑测试，预期通过。
- [ ] 运行 `pnpm --filter @cave/gateway build`，预期 Wrangler dry-run/build 成功。
- [ ] 提交：`git commit -am "feat: add gateway health endpoint"`。

## 任务 4：创建共享 Package 外壳

- [ ] 创建 `@cave/contracts`、`@cave/content`、`@cave/scenario-engine`、`@cave/test-fixtures`。
- [ ] 每个 Package 从 `src/index.ts` 导出，继承 `tsconfig.base.json`，并提供 `typecheck`、`lint`、`test`。
- [ ] 先为每个公共入口写 import smoke test；在入口不存在时运行 `pnpm -r test`，预期失败。
- [ ] 添加最小入口后运行 `pnpm -r typecheck && pnpm -r test`，预期全部通过。
- [ ] 提交：`git commit -am "chore: add shared package shells"`。

## 任务 5：配置 EAS 与真实 iPhone

**文件：** `apps/mobile/eas.json`、`apps/mobile/app.config.ts`。

- [ ] 在任何 EAS 创建、关联或云构建前，先完成本地 `verify:foundation`、identity tests、`expo:doctor` 与 Gateway dry-run build；本地 Gate 未通过时不得开始外部流程。
- [ ] 运行 `pnpm dlx eas-cli@latest login`，核对目标 Expo account 为 `carter_wells`。
- [ ] 在 `carter_wells` owner 下新建并关联唯一项目 `cave`；若该 slug 已占用，停止并请求用户选择，不得自动改用备用 slug。
- [ ] 在 `apps/mobile` 运行 `pnpm dlx eas-cli@latest build:configure`，随后审查 EAS 写入的 `projectId`、`owner` 与全部配置 diff，确认没有恢复旧 slug/Bundle ID 或加入 Android 标识。
- [ ] 固定 profiles：`development` 使用 `developmentClient: true` 和 internal distribution；`preview` 使用 internal distribution 与 `preview` channel；`production` 只配置 `production` channel，本次不构建。
- [ ] 由用户亲自确认 Apple Team 与主演示 iPhone 后，运行 `pnpm dlx eas-cli@latest device:create` 注册设备；选择不明确时停止。
- [ ] 运行 `pnpm dlx eas-cli@latest build --profile development --platform ios`。
- [ ] 在已注册 iPhone 安装产物，断开 Metro 后启动两次；预期原生外壳显示 environment/build 标识。
- [ ] 在总索引证据表记录 EAS build URL、device model、iOS version 与 commit。
- [ ] 提交：`git commit -am "build: configure ios development distribution"`。

## 任务 6：加入基础 CI

**文件：** `.github/workflows/ci.yml`。

- [ ] 先在临时分支推送一个会使 `pnpm typecheck` 失败的类型夹具，确认 workflow 失败后立即撤销该夹具。
- [ ] 配置 checkout、pnpm setup、Node 22、frozen install、`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build:gateway`。
- [ ] 本地按 CI 顺序执行全部命令，预期退出码均为 0。
- [ ] 推送干净分支，预期 workflow 成功。
- [ ] 提交：`git commit -am "ci: verify workspace and gateway"`。

## 故障、回滚与降级

- Expo SDK 57 依赖冲突：运行 `npx expo install --fix`，不得随意固定无关版本。
- iOS 签名失败：在本计划内解决 Team/device/provisioning；Android 不得替代此门槛。
- Worker tooling 失败：保留 Wrangler local 下的 `/health`；不得开始模型集成。
- 本计划后新增原生依赖：更新 runtime version，并重新生成 Development Build。

## 验收证据清单

- [ ] `pnpm verify:foundation` 退出码为 0。
- [ ] `/health` 返回准确契约。
- [ ] 真实 iPhone 脱离 Metro 打开 Development Build。
- [ ] Android 构建或安装结果不得替代真实 iPhone 门槛。
- [ ] clean checkout 的 CI 通过。
- [ ] Git 中无 secret、provisioning 或本地 `.env`。
- [ ] commit hashes 与 EAS build URL 已记录在总索引。

**解锁下一计划：** 以上证据齐全后解锁 Plan 02。
