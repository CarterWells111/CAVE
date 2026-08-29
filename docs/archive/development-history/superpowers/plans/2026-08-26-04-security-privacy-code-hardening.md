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

- 状态：`blocked`；不得声称 Plan 04 完整完成。已通过的本地 storage/key/delete-all 基线允许 Plan 05A/05B 本地实现继续，但本 blocker 与真机/外部证据必须在 Plan 07/release 前关闭。
- Commit：`dc90739`、`6f642c9`、`3c875c1`、`dbc085e`、`371c905`；共享组合 commit `aed8270`；依赖 commit `248b87d`。
- 已实现并本地通过：threat model/data classification；`LocalDataRepository`/`SecretRepository`；SQLCipher/SecureStore config 与 key lifecycle；per-record/delete-all semantics；16 KiB guards；hashed installation-token rate limits；output guard；redacted logs；CodeQL/Dependabot；fail-closed bundle-secret scanner。
- 本地证据：mobile 9 suites / 26 tests；safety 4 files / 53 tests；repository security config/scanner 4 files / 15 tests；iOS JS export 1101 modules / 2.3 MB；扫描 25 files 无 provider credential/canary。
- 唯一已知本地 Important blocker：`createTurnSafetyEvaluator` 对 Golden 明确边界“我今天不能继续，我需要在这里停下来。”返回 `uncertain → safety_stop`，而 Golden outcome 要求 `safe → resolution`；同一根因已执行两轮修复，依纪律停止第三轮并准确保留 blocker。
- `external_pending`：Apple/iPhone Development Build；真机 SQLCipher 无 key/有 key 查询；delete-all 后冷启动；部署 Worker canary log；GitHub Code Scanning/Secret Scanning 仓库设置。CodeQL 已提取并扫描 95/95 TypeScript、2/2 Actions、2/2 JavaScript files，但 GitHub 因仓库未启用 Code Scanning 而拒绝 SARIF upload。
- dependency audit：沙箱命令因网络 EACCES 失败；提升权限因会向 npm 公共 advisory endpoint 发送 package/version metadata 而被安全策略拒绝，等待用户显式授权，不绕过。

## 2026-08-28 Golden evaluator 修复证据

- 总体状态仍为 `blocked`；不得声称 Plan 04 完整完成。Golden evaluator 本地 blocker 已解决，依据是新的真实 `createTurnSafetyEvaluator()` Golden 对话测试与 production `TurnService` 接线测试均通过，并证明明确边界从 `safe/none` 到达 `resolution`，而不是 `uncertain` 到达 `safety_stop`。
- 基线与分支：先执行 `git fetch origin`（exit 0），从 freshly fetched `origin/main@9f244ce3d4b9eedec826a9bf918e81000b83fce4` 创建 `codex/fix-plan-04-golden-evaluator`；实现 commit 为 `cddcf12`（`fix(gateway): classify clear boundaries safely`）。
- 实现范围：只修改 gateway safety classifier 与直接对应的 evaluator/TurnService tests；Golden fixtures、公共 contracts、mobile、master roadmap、Plan 07/07A、内容审核状态、`reviewedAt` 和医疗/内容 assets 均未修改。
- RED 证据：`corepack pnpm --filter @cave/gateway test test/safety-policy.test.ts test/turn-service.test.ts` 首轮 exit 1，真实 evaluator 得到 `stop/uncertain` 且 TurnService 得到 `safety_stop`（2 failures / 31 passes）；独立 review 后的两轮 RED 分别证明 broad substring 与 contradictory suffix 会错误返回 `safe/none` 并调用 provider。
- 修复行为：deterministic classifier 只检查最新 user turn；明确第一人称停止边界的每个完整 clause 都必须匹配，或沿用既有 explicit practice cue，才可返回 `safe`。`STOP_PATTERNS`、danger、violence、self-harm、medical emergency、minor 与 boundary 后 pressure 仍先于 safe/uncertain resolution；历史 boundary、未知文本、问题、引用/meta 文本、无关“停止/不能继续”文本与矛盾后缀继续 fail closed。
- 独立 code review：首轮发现 broad boundary substring fail-open，复审发现 contradictory suffix fail-open；两项均以 RED/GREEN regressions 修复。最终复审结论为无剩余 Critical 或 Important finding。

Fresh verification（均为 2026-08-28 本次修复后的新证据）：

| Command | Exit | Observed result |
|---|---:|---|
| `corepack pnpm --filter @cave/gateway test test/safety-policy.test.ts test/turn-service.test.ts` | 0 | 2 files / 41 tests passed；真实 Golden evaluator 与 TurnService `resolution` integration 包含在内 |
| `corepack pnpm test:safety` | 0 | 4 files / 66 tests passed |
| `corepack pnpm --filter @cave/gateway test` | 0 | 16 files / 175 tests passed |
| `corepack pnpm --filter @cave/scenario-engine test` | 0 | 2 files / 18 tests passed |
| `corepack pnpm --filter @cave/test-fixtures test` | 0 | 2 files / 11 tests passed；Golden fixtures 未改 |
| `corepack pnpm --filter @cave/gateway typecheck` | 0 | TypeScript no-emit check passed |
| `corepack pnpm --filter @cave/gateway lint` | 0 | ESLint passed with zero warnings |
| `corepack pnpm --filter @cave/gateway build` | 0 | authorized exact rerun；Wrangler 4.126.0 dry-run，727.47 KiB / gzip 121.61 KiB；未部署。首次 sandbox-only run exit 1，原因仅为 AppData log 与 linked-worktree parent-path permission |
| `corepack pnpm typecheck` | 0 | 6 of 7 workspace projects passed |
| `corepack pnpm lint` | 0 | 6 of 7 workspace projects passed with zero warnings |
| `corepack pnpm test` | 0 | contracts 4 files / 19 tests；content 4 / 39；scenario-engine 2 / 18；gateway 16 / 175；test-fixtures 2 / 11；mobile 90 suites / 574 tests；合计 118 suites/files / 836 tests passed |
| from `apps/mobile`: `.\\node_modules\\.bin\\expo.CMD export --platform ios --output-dir dist` | 0 | 1202 modules；24 assets；1 iOS bundle 3.65 MB；1 metadata file；仅本地 export，未部署 |
| `corepack pnpm security:scan-bundle` | 0 | exported mobile bundle secret scan passed，26 files；首次在 export 前 fail closed（exit 1：no exported bundle files），生成真实 export 后 exact rerun 通过 |
| `git diff --check` | 0 | implementation 与 docs evidence diff 无 whitespace error |

仍为 `external_pending` / 未在本修复中执行：

- Apple membership/signing、iPhone Development Build、安装与 Metro-disconnected launch 证据；
- 真实 iPhone 上 SQLCipher 无 key/有 key 查询、SecureStore key lifecycle、delete-all 后 cold start；
- Worker deployment 与 canary log allowlist inspection；本修复明确未部署 Worker；
- GitHub Code Scanning / Secret Scanning repository settings 与 npm production audit 的既有外部/授权待办。

因此 Golden evaluator 本地 blocker 不再阻塞，但 Plan 04 总体仍为 `blocked`，上述 native/external evidence 继续在 Plan 07/release 前保持未完成。
