<p align="center">
  <img src="assets/brand/logo.png" width="120" alt="内界 CAVE 标志" />
</p>

# 内界 CAVE

**听见身体，确认边界。**

[![CI](https://github.com/CarterWells111/CAVE/actions/workflows/ci.yml/badge.svg)](https://github.com/CarterWells111/CAVE/actions/workflows/ci.yml)

内界 CAVE 是一款面向成年女性的身体认知、亲密关系与自我边界成长应用。它通过结构化旅程帮助用户理解自己的期待和边界、练习表达，并形成可以继续编辑和回顾的沟通卡与专题手记。产品不替用户作决定，也不对“准备程度”评分。

[官方网站](https://neijiecave.com/) · [在线产品演示](https://neijiecave.com/demo/) · [内容来源](https://neijiecave.com/sources/) · [完整文档](docs/README.md)

## 产品体验

核心体验是一条从认识自己到形成表达的六页旅程：

1. 身体与安全知识
2. 过夜期待
3. 行为地图与边界
4. 自我反思
5. 预设沟通练习
6. 私密准备与沟通草稿

旅程完成后，用户可以编辑、保存和回顾沟通卡，也可以把卡片带入“内界手记”，继续记录事件日期、最大的感受或最深刻的印象，以及后来发生的变化。手记支持补充记录和 30 天阶段回顾，让一次沟通经验成为可以长期借鉴的个人资料。

当前移动端练习使用预设路径，不调用生成式 AI。预设练习支持暂停、改变主意和安全退出，所有态度并列呈现，不把亲密行为设计成升级路线。

## 隐私边界

- 核心旅程、练习、沟通卡和普通回顾无需登录。
- 手记需要邮箱验证码；手记登录只用于同一设备上的账号隔离。
- 旅程、卡片、手记和反思保存在本机，不上传到身份服务，也不提供云同步。
- 原生构建配置使用 SQLCipher 保存本地数据库，并用 SecureStore 保存数据库密钥和刷新令牌。
- Expo Go 只提供内存模式的功能预览，关闭进程后不保证保留数据，也不代表原生加密已经得到设备验证。
- 删除云端账号与删除本机内容是两个独立、明确的操作。

更多说明见[数据分类](docs/architecture/data-classification.md)、[威胁模型](docs/architecture/threat-model.md)和[当前限制](docs/product/current-limitations.md)。

## 技术架构

```mermaid
flowchart LR
  subgraph Device[用户设备]
    Mobile[Expo / React Native App]
    DB[(SQLCipher 本地数据库)]
    Key[SecureStore]
    Mobile --> DB
    Mobile --> Key
  end

  Shared[共享 contracts / content / scenario engine]
  Worker[Cloudflare Worker]
  D1[(D1 身份元数据)]
  Resend[Resend 邮件投递]
  Web[Astro 官方网站]
  Experimental[独立 AI gateway 研究]

  Shared --> Mobile
  Shared --> Worker
  Shared --> Web
  Mobile -- 邮箱验证码与会话 --> Worker
  Worker --> D1
  Worker --> Resend
  Experimental -. 未接入移动端主流程 .-> Worker
```

移动端只为邮箱身份请求访问 Worker；私密正文不会随登录请求离开设备。仓库中的 AI gateway 是独立的安全约束研究和后续能力储备，当前移动端旅程没有调用它。

主要技术包括 Expo SDK 54、React Native、Expo Router、TypeScript、SQLCipher、SecureStore、Cloudflare Workers、D1、Hono、Astro、Zod、Jest 和 Vitest。

## 仓库结构

```text
apps/
  mobile/             Expo 移动应用
  gateway/            Cloudflare Worker：邮箱身份与独立安全网关
  web/                Astro 官方网站与产品演示页
packages/
  contracts/          跨端请求、响应与领域契约
  content/            结构化课程、场景与来源元数据
  scenario-engine/    确定性的练习状态机
  test-fixtures/      共用测试数据
docs/                 产品、架构、开发与运维文档
tests/                仓库级 CI、安全和文档契约测试
```

## 本地运行

环境要求：Node.js `^22.12.0` 或 `>=24 <25`，Corepack，以及可运行 Expo SDK 54 的 iOS/Android 环境。

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

分别启动移动端、官网或 Gateway：

```bash
corepack pnpm dev:mobile
corepack pnpm dev:web
corepack pnpm dev:gateway
```

移动端核心旅程不依赖 Gateway。邮箱验证码需要额外的本地 Worker、D1 和邮件配置，详见[开发环境](docs/development/setup.md)与[邮箱身份运维](docs/operations/email-authentication.md)。

## 验证

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm validate:content:internal
corepack pnpm build:gateway
corepack pnpm build:web
```

生产内容校验会继续拒绝尚未完成专家复核的内容；内部演示校验通过不等于医学或性教育专家认可。各命令的边界见[验证指南](docs/development/verification.md)。

## 项目状态

内界 CAVE 在四天黑客松中完成了从移动端体验、本地数据层、邮箱身份后端到官方网站的首个纵向闭环。当前版本仍是持续完善中的原型，不提供医疗诊断、法律意见、危机干预或跨设备数据恢复。已知限制与后续方向记录在[当前限制](docs/product/current-limitations.md)。
