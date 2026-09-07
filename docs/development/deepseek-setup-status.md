# DeepSeek 真实体验状态

2026-09-07：用户已核对 Cloudflare/DeepSeek 账号，自行保存 MODEL_API_KEY Secret，并明确批准线上部署。
- Worker neijie-cave-gateway，版本 b8b141f5-9594-4956-8c4f-43d7c0652960。
- 部署 CLI 覆盖 MODEL_MODE=live，MODEL_BASE_URL=https://api.deepseek.com，MODEL_NAME=deepseek-v4-flash。仓库 wrangler.jsonc 仍默认 mock，后续部署需显式保留 live 参数，否则会退回模拟。
- /v1/meta 验证 live；/v1/assistant 未登录返回401；原有4个Secret包含模型及3个登录相关Secret。
- Expo Go真实体验服务8084，session37728，exp://172.20.10.3:8084；EXPO_PUBLIC_ASSISTANT_MODE=live。8083仍为模拟服务。
- 本地服务端dry-run通过；8084 iOS开发JS包HTTP200；没有原生构建。
- 尚未完成：用户手机登录后的真实模型响应与四种AI场景验收。不得把接口上线当作模型调用成功。
- 未读取或保存密钥值到项目文件。未改导航代码。

## AI 不可用排查（2026-09-07）
- 线上重试证据：assistant.provider 连续 network_error，latencyMs=0；客户端立即收到兜底。
- 已修复 OpenAICompatibleProvider 原生 fetch 的 this 绑定：使用 globalThis.fetch.bind(globalThis)，避免 Workers Illegal invocation。新增回归测试先失败后通过。
- 新增仅错误类别/上游状态码诊断，不记录问题、手记、密钥或模型原文。
- 定向 3 套 48 项测试、Gateway 类型检查、修改文件 ESLint 和 diff --check 通过。
- 修复已部署版本 44bda179-6976-4946-a181-c40a79c3e38a，保留 live/deepseek-v4-flash。未进行原生构建。
- 等待用户手机再次调用确认真实模型回答；未宣称端到端成功。
- 旁路观察 account_preferences_get 返回500，尚未调查，不作为本次AI失败原因。

## 真实回答校验修复（2026-09-07）
- fetch 修复后生产日志：DeepSeek HTTP200，约5919ms；回答仍兜底。
- 使用仅本机入口的远程预览、固定合成问题“旅程怎么使用？”复现：模型把 app-journey-process 放入 sourceRecordIds，引发 unknown_record_reference。另一次真实返回 summary 空字符串触发 invalid_output。
- 修复：仅接受本次提供的知识卡编号，知识引用保留为服务端 sources，不当作手记 observations；未知编号仍拒绝。空白的可选 question/summary 规范为省略，必填字段及其他类型继续严格校验。
- 最终真实远程复测：HTTP200，模型耗时6606ms，最终 status=ok/providerMode=live，sources=app-journey-process；未使用用户手记或读取密钥。
- 3套50项测试、类型检查、修改文件lint、diff --check通过。
- 生产部署版本5767610e-3d15-4e8c-8c58-926b274ec9b7，保留 live/deepseek-v4-flash。远程预览已停止、临时probe源码已删除。没有原生构建。
- 待用户在8084手机端最终确认；服务端真实模型链路已验证，尚不代表四种场景全部验收。
