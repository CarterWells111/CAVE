# 内界 CAVE 文档

这里收录当前产品范围、技术边界和本地开发方式。根目录的 [README](../README.md) 提供项目概览，本页是进一步阅读的统一入口。

## 产品

- [产品概览](product/overview.md)：当前六页旅程、长期使用方式、账户与数据边界。
- [当前限制](product/current-limitations.md)：内容审核、设备能力、数据恢复和 AI 能力边界。

## 架构与隐私

- [技术架构](architecture/overview.md)：移动端、共享包、Worker、D1、Resend 与官网之间的关系。
- [数据分类](architecture/data-classification.md)：不同数据允许出现的位置、保留方式和删除路径。
- [威胁模型](architecture/threat-model.md)：主要风险、控制措施与现有验证。

## 开发与运维

- [开发环境](development/setup.md)：安装依赖并运行移动端、官网和 Gateway。
- [验证指南](development/verification.md)：类型、代码规范、测试、内容与构建检查。
- [邮箱身份运维](operations/email-authentication.md)：验证码、会话、密钥、迁移和生产检查。

## 内容来源

- [医学及教育内容来源台账](content/source-registry.md)：来源、适用范围和当前复核状态。

## 开发历史

- [历史资料归档](archive/README.md)：黑客松期间的旧产品方案、实现计划、验证记录和展示准备材料。
