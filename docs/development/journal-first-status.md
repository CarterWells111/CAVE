# 手记优先与 AI 接入

更新：2026-09-07。远端已 fetch：HEAD 与 origin/main 均为 cc7d8a6，无落后或分叉。

## 目标与边界
- 最新修正：默认入口为旅程，底部依次为旅程、内界手记、AI、我的；移除独立回顾页，保留年龄声明与账号隔离。
- 自由写/单题可跳过引导、账号隔离草稿、修改历史、后来、可选时间范围的阶段回顾。
- 可选 AI 单篇引导/整理、选定记录回顾、旅程资料问答；服务端密钥、明确授权、失败仍可本地保存。
- 不提供促成伤害的指令，不阻止用户记录痛苦/受害经历；不把模拟响应视为真实模型验证。
- 用户要求：节约 token，少量并行分工后统一审核。原生/development build 必须先由用户核对各平台账号并明确同意；本轮不得自行构建原生包。

## 分工与状态
- journal 子会话：记录/草稿/修改历史/回顾与存储迁移，完成。
- ai_gateway 子会话：共享契约、鉴权限流、安全策略、DeepSeek 兼容服务端，完成。
- navigation 子会话：首页/导航/年龄声明分流，完成。
- 主会话：移动端 AI 请求/授权/结果采用、审核集成、文档及最终验证，完成，待用户手机验收。

## 关键决定
- 优先 Expo Go；AI 使用普通 HTTPS 请求，无新增原生依赖。SQLCipher 真机能力仍需独立原生验收。
- POST /v1/assistant，guide/summarize/review/journey 四种模式；显式 consent；只提交当前或用户选定的记录。
- 不改动已有 app.config.ts/eas.json 及相关未提交构建修改，不执行发布或原生构建。

## 验证
- 远端基线核对已通过。
- 最终移动端：164 suites / 1350 tests 通过；Gateway：24 suites / 249 tests 通过；contracts：32 tests 通过；仓库源码边界/文档/路由：69 tests 通过。
- 移动端与 Gateway 类型、相关 lint、源码网络边界（210 production files）、git diff --check 通过。
- Expo Go 模拟服务运行于 8083，session 18317；手机地址 exp://172.20.10.3:8083（同一网络）。未停止已有 8081/8082 服务。
- iOS 开发 JS bundle HTTP 200，约 8.49 MB；只启动 Metro，未原生构建。
- 报告 outputs/journal-first/mobile-tests.json；二维码 outputs/journal-first/expo-go-qr.png；验收清单 docs/development/journal-first-acceptance.md。
- 用户明确选择“尚未配置，先完成代码和模拟验收”；真实模型/手机/SQLCipher 真机未验收，不需要现在申请 development build。
- 审核修正：区分危险引用与索要危险方法，常见旅程暂停问题可检索流程资料，删除后来后刷新旧版本，跨账号/过期 AI 结果失效。原生 schema 13、Expo Go schema 3；现有 native runtimeVersion 未改，发布前需复核。

## 导航修正（本交接会话）
- 用户明确修正：首次打开为旅程，底部依次为旅程、内界手记、AI、我的，取消独立回顾页。
- 已实施：默认 index 呈现旅程；手记回到独立 tab；AI hub 汇总记录、选定回顾和旅程问答；旧 reviews/assistant 链接转到对应新入口。
- 阶段回顾仍在手记中，主题探索在旅程中，历史在我的；记录、数据库和服务端能力未改。
- 成年声明及登录正确返回手记/AI tab；不会强制先完成旅程前言。
- 本次先重新 fetch origin，HEAD 与 origin/main 仍同为 cc7d8a6。
- 定向回归原45套件中的3个旧断言失败已修正；5套件89项复测全部通过。最终去重汇总见 outputs/journal-first/navigation-revision-summary.json（45套件322项）。类型/lint/源码边界212文件通过；iOS Metro 开发JS包 HTTP200。没有重复后端/数据库全量测试。
- 用户另行请求的 API 配置任务已创建：配置 DeepSeek API 并真机体验，任务ID 01a07aba-8159-72e1-a8ae-df017c177f12。同目录，负责账号核对、密钥配置和真实调用；不允许覆盖当前导航。该会话可能调整服务环境，后续不要假定8083永远是模拟模式，引用前先核对。
- 无原生构建、部署或提交；构建前用户核对账号并明确批准的约束继续有效。
