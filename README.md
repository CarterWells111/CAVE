# 内界 CAVE

**听见身体，确认边界。**

内界 CAVE 是一款面向年轻女性的身体认知与亲密关系成长应用。

## 开工入口

- [首发六页本机优先入口决策](docs/product/2026-08-28-six-page-local-first-entry.md)
- [七屏产品与文案确认稿](docs/product/2026-08-27-seven-screen-product-spec.md)
- [七屏 UI 装修施工蓝图](docs/design/2026-08-27-seven-screen-ui-renovation-blueprint.md)
- [医学及教育内容来源台账](docs/content/source-registry.md)
- [四天黑客松总路线图](docs/superpowers/plans/2026-08-26-00-hackathon-master-roadmap.md)
- [01 仓库基础设施与 iOS 构建](docs/superpowers/plans/2026-08-26-01-repository-infrastructure-ios-build.md)
- [02 共享契约、内容包与领域引擎](docs/superpowers/plans/2026-08-26-02-contracts-content-domain.md)
- [03 AI 网关、Prompt 规范与模型适配](docs/superpowers/plans/2026-08-26-03-ai-gateway-prompt-spec.md)
- [04 隐私、安全与代码加固](docs/superpowers/plans/2026-08-26-04-security-privacy-code-hardening.md)
- [05 Expo 移动端核心闭环](docs/superpowers/plans/2026-08-26-05-mobile-mvp-integration.md)
- [06 产品功能收口与体验完善](docs/superpowers/plans/2026-08-26-06-product-completion-ux.md)
- [07 质量、性能与演示加固](docs/superpowers/plans/2026-08-26-07-quality-performance-demo-hardening.md)
- [08 发布、演示与双命题提交](docs/superpowers/plans/2026-08-26-08-release-demo-submissions.md)

## 固定技术决策

- Expo SDK 54 + pnpm workspace；
- Expo mobile app + Cloudflare Worker；
- OpenAI-compatible HTTP model interface；
- SQLCipher + SecureStore；
- iOS 真实设备为主验收；
- 萨福与 Eazo 共用代码，只分离提交材料。

实际开发从 Plan 01 开始。跨计划接口变化必须先更新总路线图与接口所有者计划。

