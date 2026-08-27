# 04 隐私、安全与代码加固实施计划

> 执行要求：安全默认值必须由代码与测试强制，而不是只写说明；不确定的 safety result 一律进入 `safety_stop`。

**目标（Goal）：** 在 UI 集成前建立可验证的本地存储、网关防护、日志、secret、dependency 与删除保证。

**架构（Architecture）：** 敏感持久数据存入 SQLCipher SQLite，随机 key 存在 SecureStore；当前 transcript 默认只在内存。Worker middleware 在模型 service 前后执行 size、version、rate、safety 与 redacted observability policy。

**技术栈（Tech Stack）：** Expo SQLite/SQLCipher、Expo SecureStore、Cloudflare Worker bindings、Zod、Vitest/Jest、GitHub CodeQL/Secret Scanning、pnpm audit。

---

**依赖计划：** Plan 02 complete；通过 injected safety interface 与 Plan 03 集成。  
**输入：** v1 contracts、Golden safety fixtures、Expo/Worker shells。  
**输出：** threat model、encrypted repositories、deletion lifecycle、Worker guards、log allowlist、CI security checks。  
**明确排除：** account、cloud sync、analytics profile、remote transcript storage。  
**预计时间：** 4 小时。**负责人：** 工程师；内容队友审核 safety outcomes 与 resources。

## 准确文件路径

```text
docs/architecture/threat-model.md
docs/architecture/data-classification.md
apps/mobile/app.config.ts
apps/mobile/src/core/storage/{types,key-store,database,migrations,local-data-repository}.ts
apps/mobile/src/core/storage/*.test.ts
apps/mobile/src/core/privacy/delete-all-data.ts
apps/gateway/src/security/{request-guard,rate-limit,safety-policy,output-guard}.ts
apps/gateway/src/observability/{safe-log,metrics}.ts
apps/gateway/test/{request-guard,safety-policy,log-redaction}.test.ts
.github/workflows/codeql.yml
.github/dependabot.yml
scripts/scan-bundle-secrets.mjs
```

## 本地 Repository 公共接口（规范性定义）

```ts
type CourseProgressRecord = {
  lessonId: string; completedAt: string; quizCorrect: number; quizTotal: number;
};
type SavedPracticeRecord = {
  id: string; scenarioId: string; createdAt: string; expressionCard: ExpressionCard;
  transcript?: PracticeTurn[];
};
type PrivacySettings = {
  liveModelAcknowledged: boolean; defaultSaveTranscript: false;
};

interface LocalDataRepository {
  initialize(): Promise<void>;
  getCourseProgress(): Promise<CourseProgressRecord[]>;
  setCourseProgress(record: CourseProgressRecord): Promise<void>;
  listSavedRecords(): Promise<SavedPracticeRecord[]>;
  saveRecord(record: SavedPracticeRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
  getPrivacySettings(): Promise<PrivacySettings>;
  setPrivacySettings(settings: PrivacySettings): Promise<void>;
  deleteAll(): Promise<void>;
}

interface SecretRepository {
  getOrCreateDatabaseKey(): Promise<string>;
  getOrCreateInstallationToken(): Promise<string>;
  deleteAllSecrets(): Promise<void>;
}
```

## 任务 1：Threat model 与数据分级

- [ ] 在 `threat-model.md` 列出 model secret、raw transcript、saved card、course answers、encryption key、installation token、prompt/policy text。
- [ ] 记录 device、mobile bundle、Worker、provider、build service、GitHub、logs 等 trust boundaries。
- [ ] 以 STRIDE 分类 key leakage、log leakage、prompt injection、malicious input、coercion pressure、device data leakage、dependency risk，并给每项绑定本计划中的 control/test。
- [ ] 在 `data-classification.md` 将字段分为 public、local-private、transient-sensitive、secret。
- [ ] 固定 retention：gateway 不保留 request/response text；当前 transcript memory-only；保存必须逐次明确操作。
- [ ] 提交：`git add docs/architecture && git commit -m "docs: define threat model and data classes"`。

## 任务 2：本地 storage interfaces

- [ ] 先为 in-memory fake 写 contract tests，覆盖 initialize、progress、list/save/delete record、privacy settings、delete all；在 interface 不存在时预期 typecheck/test 失败。
- [ ] 实现本文件规定的 `LocalDataRepository` 与 `SecretRepository` types。
- [ ] 规定保存记录只含 ID/timestamp/expression card；`transcript` 默认不存在，只能由当前一次保存操作显式传入。
- [ ] 重跑 contract tests，预期 fake 全部通过；提交：`git commit -am "feat: define local privacy repositories"`。

## 任务 3：SQLCipher 与 key lifecycle

- [ ] 开启 `expo-sqlite` config plugin 的 `useSQLCipher: true`，本轮仅验证 iOS；Android 配置与验证延期至独立固定决策获批并配置 Android package 后。
- [ ] 加入 `expo-secure-store`，配置 iOS encryption declaration 与 device-only accessibility。
- [ ] 先写失败测试：first creation、stable reread、explicit deletion、key/database mismatch。
- [ ] 生成 32-byte random key，只 encode 一次，以 `db.key.v1` 保存，禁止 logging。
- [ ] database open 后、任何 schema query 前应用 key；开启 foreign keys、WAL，并管理 `PRAGMA user_version`。
- [ ] 因原生配置变化重新构建 iOS Development Build。
- [ ] 真机导出 database：无 key 查询必须失败，有 key 查询必须成功。
- [ ] 提交：`git commit -am "feat: encrypt local application data"`。

## 任务 4：Repository 与删除语义

- [ ] 先写失败 contract tests：progress persistence、explicit-save-only、per-record deletion、delete-all、repeat deletion idempotency。
- [ ] 创建 `course_progress`、`saved_records`、`privacy_settings`；不得创建默认 transcript history table。
- [ ] 所有 SQL 参数化；lint/test 阻止 user-controlled interpolation 进入 `execAsync`。
- [ ] 实现 orchestrated delete-all：close database → remove database files → `deleteAllSecrets()` → initialize empty database。
- [ ] 冷启动测试 old key/no database 与 database/no key；预期安全清空并重新初始化，不做 partial recovery。
- [ ] 提交：`git commit -am "feat: enforce local data lifecycle"`。

## 任务 5：Worker request guards 与 rate limit

- [ ] 先写失败测试：non-JSON、body > 16 KB、message 超 contract、unknown fields、unsupported version、unknown scenario。
- [ ] 用 hash 后的 random installation token 做 rate key，永不记录 raw token。
- [ ] turn 固定每 installation hash 每 60 秒 10 次；debrief 使用独立 60 秒 5 次限制。
- [ ] 超限返回 429、`RATE_LIMITED` 与 integer `retryAfterSeconds`。
- [ ] 测试 shared IP 上不同 installation tokens 不互相阻断。
- [ ] 提交：`git commit -am "feat: guard and rate limit model requests"`。

## 任务 6：Safety policy 与 output guard

- [ ] 把 Golden fixtures 转为 table-driven policy tests，先运行并确认未实现时失败。
- [ ] 实现 deterministic stop categories：real-world danger、violence、self-harm、medical emergency、minor disclosure、clear boundary 后仍继续。
- [ ] uncertainty 固定返回 `{ level: "stop", reasonCode: "uncertain" }`；不得给 diagnosis 或 legal conclusion。
- [ ] output guard 拒绝 prompt disclosure、unsupported diagnosis、threat、shame language、从 `safety_stop` 退出的转换。
- [ ] 注入 Plan 03 turn/debrief services，删除 temporary safe stub。
- [ ] 添加 gateway `test:safety` script，覆盖 Golden policy、output guard、injection、log redaction。
- [ ] 提交：`git commit -am "feat: enforce practice safety policy"`。

## 任务 7：脱敏 observability

- [ ] 固定 log allowlist：request ID、route、status、latency、model、provider mode、prompt/policy versions、input/output character counts、token counts、safety reason code。
- [ ] 先写失败测试：error 中放 unique sensitive canary，serialized logs 不能出现 canary。
- [ ] logging helper 拒绝 `message`、`text`、`turns`、`expressionCard`、`apiKey`、`authorization` fields。
- [ ] provider response body 永不进入 mapped error；重跑 redaction tests。
- [ ] 提交：`git commit -am "feat: redact gateway observability"`。

## 任务 8：Repository 与 supply-chain security

- [ ] 在 GitHub 启用 Secret Scanning；创建 JavaScript/TypeScript CodeQL workflow。
- [ ] 配置 npm 与 GitHub Actions weekly Dependabot，open PR limit 为 5。
- [ ] 根 scripts 加入 `security:audit`=`pnpm audit --prod` 与 `security:scan-bundle`=`node scripts/scan-bundle-secrets.mjs`。
- [ ] 先写 scanner 失败 fixture：export bundle 注入 canary 后命令必须非零退出。
- [ ] 实现扫描 `MODEL_API_KEY`、Bearer-token patterns 与 seeded canary；清除 fixture 后命令必须成功。
- [ ] 运行首个 CodeQL、`pnpm security:audit`、`pnpm security:scan-bundle`。
- [ ] 提交：`git commit -am "ci: add code and secret security checks"`。

## 执行命令与预期结果

- [ ] iOS Development Build 上运行 storage tests，不只依赖 Jest fake。
- [ ] `pnpm test:safety`：Golden set 全通过。
- [ ] `pnpm security:audit`：无未处置 high/critical production finding。
- [ ] `pnpm security:scan-bundle`：exported mobile bundle 无 provider credential/canary。
- [ ] canary request 后检查 Worker logs：只有 allowlisted metadata。
- [ ] 真机执行 delete-all 并重启：storage 为空，token/key 已重新生成。

## 故障、回滚与降级

- SQLCipher 阻断构建：在本计划修复 native config，不得把敏感数据降级成 plaintext。
- 加密 persistence 仍不可用：关闭保存记录这一 P1；transcript 继续 memory-only，非敏感 course progress 可用普通 SQLite。
- safety case 模糊：停止角色扮演并返回 resources。
- dependency audit 无法在不破坏 Expo 的情况下解决：移除相关 P1 dependency，不强升 Expo internals。

## 验收证据清单

- [ ] threat/control/test mapping 无 uncovered high-risk item。
- [ ] 无 SecureStore key 时无法读取 database。
- [ ] 未逐次明确保存时，database 中无 raw transcript。
- [ ] delete-all 删除 database、key、token 与 records。
- [ ] gateway/bundle/logs 无 sensitive canary 或 provider credential。
- [ ] Golden safety set 与 injection tests 通过。

**解锁下一计划：** 与 Plan 03 同时验收完成后解锁 Plan 05。

## 2026-08-27 执行结果

- 状态：`blocked`；不得声称 Plan 04 完整完成，Plan 05 未解锁。
- Commit：`dc90739`、`6f642c9`、`3c875c1`、`dbc085e`、`371c905`；共享组合 commit `aed8270`；依赖 commit `248b87d`。
- 已实现并本地通过：threat model/data classification；`LocalDataRepository`/`SecretRepository`；SQLCipher/SecureStore config 与 key lifecycle；per-record/delete-all semantics；16 KiB guards；hashed installation-token rate limits；output guard；redacted logs；CodeQL/Dependabot；fail-closed bundle-secret scanner。
- 本地证据：mobile 9 suites / 26 tests；safety 4 files / 53 tests；repository security config/scanner 4 files / 15 tests；iOS JS export 1101 modules / 2.3 MB；扫描 25 files 无 provider credential/canary。
- 唯一已知本地 Important blocker：`createTurnSafetyEvaluator` 对 Golden 明确边界“我今天不能继续，我需要在这里停下来。”返回 `uncertain → safety_stop`，而 Golden outcome 要求 `safe → resolution`；同一根因已执行两轮修复，依纪律停止第三轮并准确保留 blocker。
- `external_pending`：Apple/iPhone Development Build；真机 SQLCipher 无 key/有 key 查询；delete-all 后冷启动；部署 Worker canary log；GitHub Secret Scanning 仓库设置。
- dependency audit：沙箱命令因网络 EACCES 失败；提升权限因会向 npm 公共 advisory endpoint 发送 package/version metadata 而被安全策略拒绝，等待用户显式授权，不绕过。
