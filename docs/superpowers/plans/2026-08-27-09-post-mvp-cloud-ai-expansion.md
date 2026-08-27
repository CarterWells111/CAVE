# 09 Post-MVP 云端保存与 AI 练习扩展计划

> 状态：`parked`。本计划不属于四天黑客松范围，不解锁 Plan 07/08，也不得在当前 Preview Build 中启用隐藏入口。

**目标（Goal）：** 在 MVP 完成并经过独立隐私审查后，为用户提供主动开启的端到端数据同步，以及与本地预设练习并存、明确标识的受约束 AI 练习。

**架构（Architecture）：** 本地仍是事实来源；云同步使用单独账户/同意边界和客户端加密 payload；AI 练习通过既有 Worker `ModelProvider`、shared contracts 与 safety evaluator，不读取八页私密草稿，除非用户在单次练习中明确选择字段。

**技术栈（Tech Stack）：** Expo SDK 57、Cloudflare Worker、Hono、OpenAI-compatible HTTP、SQLCipher、SecureStore、端到端加密 envelope、Vitest/Jest、contract tests。

## 启动条件、输入、输出与排除项

**启动条件：** Plan 01—08 complete；Gate 01B 真实 iPhone 通过；Plan 04 Golden evaluator、安全日志、SQLCipher 真机证据通过；独立数据保护审查批准 retention/delete/account recovery 规则。
**输入：** `JourneyDraft` v1、saved communication cards、Plan 03 provider/gateway、Plan 04 safety/storage。
**输出：** 可撤回的 opt-in sync、跨设备恢复、明确标识的 AI practice、数据导出/删除和审计证据。
**明确排除：** 广告画像、根据敏感输入推荐商品、服务端明文旅程、默认上传、训练模型授权捆绑、自动推断疾病/怀孕/性取向/关系状态。
**预计时间：** 4—6 个工程日和独立内容/隐私审核。**负责人：** 工程师 + 内容/隐私审核人。

## 准确文件路径（未来创建）

```text
packages/contracts/src/v2/{sync,ai-practice,errors}.ts
packages/contracts/src/v2/*.test.ts
apps/gateway/src/routes/v2/{sync,practice}.ts
apps/gateway/src/services/{sync-store,envelope-validation}.ts
apps/gateway/src/services/*.test.ts
apps/mobile/src/features/sync/{domain,application,infrastructure,ui}/**
apps/mobile/src/features/ai-practice/{domain,application,infrastructure,ui}/**
apps/mobile/src/features/privacy/ui/CloudConsentScreen.tsx
apps/mobile/src/features/privacy/ui/AiPracticeConsentScreen.tsx
docs/privacy/{cloud-data-flow,ai-data-flow,retention-deletion}.md
```

## 固定扩展接口

```ts
export type CloudSyncConsent = {
  enabled: boolean;
  policyVersion: string;
  grantedAt?: string;
  revokedAt?: string;
};

export type EncryptedSyncEnvelope = {
  recordId: string;
  recordType: "journey-draft" | "communication-card";
  schemaVersion: 1;
  ciphertext: string;
  nonce: string;
  clientUpdatedAt: string;
};

export type AiPracticeDisclosure = {
  promptVersion: string;
  policyVersion: string;
  selectedJourneyFieldIds: string[];
  acknowledgedAt: string;
};
```

服务端只接受/返回 `EncryptedSyncEnvelope`，不能解密八页 payload。AI request 只能携带本次明确选择的最少字段和当前练习文本，不允许上传完整 `JourneyDraft`。

## Phase A：变更请求与威胁模型

- [ ] 5 分钟：先修改总路线图和 Plan 02 v2 contract owner，记录数据流、retention、删除 SLA、account recovery 和 breach response。
- [ ] 5 分钟：为默认上传、服务端明文、撤回后继续同步、AI 读取未选择字段写失败 threat tests。
- [ ] 3 分钟：记录独立审核人的 cloud/AI disclosure 和高风险分支决定；未批准时状态保持 `privacy_review_pending`。
- [ ] 2 分钟：提交 `git commit -am "docs: approve post-mvp data boundaries"`。

## Phase B：云同步契约与客户端加密

- [ ] 5 分钟：先写 v2 contract RED tests：envelope version、size、nonce、record type、conflict metadata、typed errors。
- [ ] 5 分钟：实现客户端 envelope encryption 的最小 passing slice；sync key 只存 SecureStore，Worker 永不接收 key。
- [ ] 5 分钟：先写 opt-in tests：默认 off、明确同意后启用、撤回后停止、删除云副本后本地数据按用户选择保留或删除。
- [ ] 5 分钟：实现 deterministic last-write conflict screen 的最小 passing slice，不静默覆盖用户编辑的沟通卡。
- [ ] 2 分钟：提交 `git commit -am "feat: add opt-in encrypted sync"`。

## Phase C：服务端 envelope 存储与删除

- [ ] 5 分钟：先写 Worker RED tests：authentication、rate limit、body limit、opaque payload、list cursor、delete one、delete all、retention expiry。
- [ ] 5 分钟：实现 `/v2/sync/records` 与 `/v2/sync/delete-all` 的单个 passing slice；日志只记录 request ID、account pseudonym、record count、size、status。
- [ ] 4 分钟：证明日志、trace、exception 和 backup 不含 ciphertext 之外的用户正文；ciphertext 不写 console。
- [ ] 5 分钟：运行删除审计，确认主存储、索引和备份到期流程符合批准规则。
- [ ] 2 分钟：提交 `git commit -am "feat: store opaque sync envelopes"`。

## Phase D：受约束 AI 练习

- [ ] 5 分钟：先写 consent RED tests：未确认 disclosure 时不发请求；选择字段列表为空时不读取 journey；每次可撤销字段共享。
- [ ] 5 分钟：先写 provider/safety RED tests：injection、越权压力、伪造来源、输出损坏、timeout、rate limit、`safety_stop`。
- [ ] 5 分钟：经 Plan 02 变更流程发布 `/v2/practice/turn` 与 `/v2/practice/debrief` 的单个 passing slice；复用 Plan 03 provider internals，但不得从 Page 6 静默替换预设 engine。
- [ ] 4 分钟：实现独立标识：AI 页面持续显示“AI 练习”，预设页面持续显示“预设对话”，两者历史和 consent 独立。
- [ ] 4 分钟：验证原始 AI transcript 默认只在内存；用户每次另行决定是否保存到本机或同步加密 envelope。
- [ ] 2 分钟：提交 `git commit -am "feat: add consented AI practice"`。

## Phase E：撤回、导出、删除与发布 Gate

- [ ] 5 分钟：先写端到端 tests：enable sync、two-device conflict、revoke、export、delete-one、delete-all、key loss recovery、account deletion。
- [ ] 4 分钟：验证关闭 cloud 后 UI 回到 local-only，已保存的远端数据按用户明确选择删除或保留。
- [ ] 5 分钟：真实 iPhone 验证 SecureStore key、background/resume、offline queue 和重新安装恢复。
- [ ] 5 分钟：新鲜运行 contracts、gateway、mobile、safety、content、secret scan 与 dependency audit。
- [ ] 2 分钟：提交 `git commit -am "test: verify post-mvp privacy controls"`。

## 执行命令与预期结果

```powershell
corepack pnpm test:contracts
corepack pnpm --filter @cave/gateway test
corepack pnpm test:safety
corepack pnpm --filter @cave/mobile test
corepack pnpm validate:content
corepack pnpm security:scan-bundle
corepack pnpm security:audit
git diff --check
```

预期：全部退出码 0；contract suite 同时覆盖 v1 与 v2；bundle/log fixtures 无 credential 或用户正文；删除与撤回 E2E 有明确记录。

## 故障、回滚与降级

- 隐私审查未通过：cloud/AI 功能保持未编译或 remote disabled；现有 local-only MVP 不受影响。
- sync key 丢失：提供清晰的不可恢复说明和删除远端密文选择，不尝试服务端解密。
- AI provider 不可用：AI practice 显示不可用，用户可主动返回预设练习；不得把预设输出冒充 AI。
- safety evaluator 不确定：进入 `safety_stop`，不继续普通角色扮演。
- v2 contract 与旧客户端不兼容：版本路由并存，不改变 v1 行为。

## 验收证据清单

- [ ] 隐私审核记录与版本化 disclosures。
- [ ] 服务端无法解密的 architecture/penetration evidence。
- [ ] opt-in、revoke、export、delete 和 key-loss E2E。
- [ ] AI selected-field minimization 与 transcript default-memory-only tests。
- [ ] safety/injection/log/bundle scans。
- [ ] 真实 iPhone 和跨设备冲突记录。

**解锁结果：** 全部 Gate 通过后，才可把当前 MVP 的 cloud `coming-soon` 状态替换为可选择入口，并将 AI 练习作为独立模块发布。
