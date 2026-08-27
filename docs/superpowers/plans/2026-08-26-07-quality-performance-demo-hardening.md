# 07 质量、性能与演示加固实施计划

> 执行要求：本计划开始即冻结功能；所有 fix 必须先有能重现问题的失败测试或明确设备复现记录。

**目标（Goal）：** 在主演示设备上证明 correctness、security、performance，清除所有发布阻塞项并形成可追溯的 Release Candidate。

**架构（Architecture）：** 单一 verification matrix 汇总 unit、contract、content、safety、component、E2E、security、performance 与 manual device checks；failure 按 release severity 分流，不允许新功能。

**技术栈（Tech Stack）：** pnpm scripts、Vitest/Jest、React Native Testing Library、Maestro、EAS Development Build、可用时使用 Xcode Instruments/Expo performance tools、Worker logs。

---

**依赖计划：** Plan 06 complete。  
**输入：** feature-frozen build、完整 state matrix、安全 tests、主 iPhone。  
**输出：** passing verification matrix、performance evidence、三轮彩排、无 P0/P1 defect、frozen release commit candidate。  
**明确排除：** 新功能、公共接口变化、内容扩展、redesign。  
**预计时间：** 3—4 小时。**负责人：** 两人共同。

## 准确文件路径

```text
.maestro/{core-flow,offline-delete}.yaml
docs/runbooks/verification-matrix.md
docs/runbooks/demo-rehearsal-log.md
docs/runbooks/known-issues.md
scripts/{verify-release,scan-bundle-secrets}.mjs
apps/mobile/src/test/performance/**
```

## 任务 1：冻结范围与缺陷分级

- [ ] 记录 Release Candidate commit，把 Plan 00/07 状态改为 `in_progress`。
- [ ] 固定 severity：P0 阻断提交或造成 safety/data risk；P1 明显破坏 secondary path；P2 cosmetic/non-demo。
- [ ] 禁止 feature merge，只接受 tests、fixes、copy/asset corrections、release config。
- [ ] `known-issues.md` 每条包含 issue ID、severity、reproduction、owner、fix/accept decision、evidence。
- [ ] 提交：`git add docs/runbooks && git commit -m "docs: freeze hackathon release scope"`。

## 任务 2：自动化验证金字塔

- [ ] clean workspace 运行 `pnpm install --frozen-lockfile`。
- [ ] 顺序运行 `pnpm typecheck`、`pnpm lint`、`pnpm test:contracts`、`pnpm test:content`、`pnpm test:safety`、`pnpm test`、`pnpm build:gateway`。
- [ ] 把 command、duration、exit code、failing test names 写入 `verification-matrix.md`。
- [ ] 每个 P0/P1 先补失败 regression test，再做最小 fix，并单独提交 `git commit -am "fix: <behavior>"`。
- [ ] 每个 fix 后重跑完整序列，不只跑改动测试；预期全部退出码 0。

## 任务 3：Maestro flows

- [ ] 先创建 `core-flow.yaml`：launch → local content → interaction → Mock practice → debrief → save card → verify saved record。
- [ ] 创建 `offline-delete.yaml`：offline launch → content → records → delete all → relaunch → empty state。
- [ ] 使用 UI 组件已有 accessibility IDs/text，不增加 test-only business branch。
- [ ] 在主 iPhone 或匹配 simulator build 跑 iOS core/offline flows。
- [ ] 保存 report/screenshot/video；提交：`git commit -am "test: cover release critical mobile flows"`。

## 任务 4：Network 与 AI failure matrix

- [ ] 逐项触发 Mock success、Live success（有凭证时）、no network、DNS failure、15-second timeout、429、5xx retry、invalid JSON、wrong contract、safety stop。
- [ ] cancel 后不得出现 stale assistant message；仅在设计允许的场景保留 user input。
- [ ] scripted response 前必须出现 visible Mock confirmation。
- [ ] `safety_stop` 不能通过 back navigation 回到普通 roleplay。
- [ ] 每个新发现先写失败 regression test，再修复；记录 observed UI 与 recovery action。

## 任务 5：隐私与代码安全复验

- [ ] `pnpm security:audit`：无 unresolved high/critical production vulnerability。
- [ ] export mobile bundle 后运行 `pnpm security:scan-bundle`：无 API key/seeded canary。
- [ ] 发送 canary dialogue 并检查 Worker logs：只有 allowlisted metadata。
- [ ] 导出 SQLCipher database：无 key 不可读，test key 可读。
- [ ] save card → delete card → delete all → restart：database/key/token 已重置。
- [ ] push 前使用 GitHub Secret Scanning 或 local equivalent 扫描 repository。

## 任务 6：性能与稳定性

主 iPhone budgets：

- cold launch 到 interactive home ≤ 3.0 秒；
- local navigation 视觉响应 ≤ 200 ms；
- send action 到 waiting state ≤ 100 ms；
- AI request 在 15 秒进入 terminal timeout；
- 连续十次 practice start/reset 无 monotonic transcript/store growth；
- largest Dynamic Type 的最长 P0 screen 无 clipped actionable control。

- [ ] cold start 与 local navigation 各测三次，记录 median/worst。
- [ ] practice start/reset 十次，检查 JS/native memory 是否无界增长。
- [ ] profile 最长 list/screen；budget 失败时先减少 rerender 或替换 list container。
- [ ] optional animation 导致 interaction/accessibility failure 时删除。
- [ ] 每个 performance fix 都补 regression test 或可重复 measurement record。

## 任务 7：Accessibility 与设备矩阵

- [ ] 主 iPhone：VoiceOver main path、largest Dynamic Type、reduced motion、支持时 light/dark、offline、fresh install、previous preview upgrade。
- Android 验收延期：本轮不配置 Android package、不生成 Android artifact、不执行安装或 smoke，且不阻塞当前 Gate。
- [ ] smallest available iPhone class 与主演示手机检查 keyboard/input。
- [ ] status 不只靠颜色；destructive action 会朗读后果。
- [ ] 记录 device、OS、build version 与 pass/fail。

## 任务 8：三轮完整演示彩排

- [ ] Rehearsal A：LiveProvider + normal network。
- [ ] Rehearsal B：visible MockProvider + Wi-Fi off。
- [ ] Rehearsal C：forced model timeout 后按 Runbook 进入 approved fallback。
- [ ] 每轮记录 start/end、build/version、failure、recovery、presenter notes。
- [ ] 最后一次 code/config change 后必须重新获得三轮连续成功。
- [ ] unresolved P2 可记录接受；任何 unresolved P0/P1 保持本计划未完成。

## 任务 9：生成 Release Candidate 证据

- [ ] 运行 `pnpm verify && pnpm security:audit && pnpm security:scan-bundle`。
- [ ] 记录 clean Git status、commit、Worker contract/prompt/policy versions、app/runtime version。
- [ ] 创建 internal tag `hackathon-rc1`；Plan 08 artifacts 对齐前不得创建 final tag。
- [ ] 提交：`git commit -am "test: record release candidate verification"`。

## 故障、回滚与降级

- P0 failure：revert 最小 offending commit，或关闭受影响 P1 surface；不得绕过 safety/data rules。
- performance failure：先删除 optional animation/assets，不引入新 cache/architecture。
- LiveProvider failure：transparent Mock demo + 已有 live evidence 仍可形成有效 release。
- iOS build/runtime mismatch：重建正确 runtime，不发布 incompatible OTA update。

## 验收证据清单

- [ ] clean install 后 full automated suite 通过。
- [ ] Maestro iOS core/offline flows 通过。
- [ ] security、log、bundle、SQLCipher、deletion checks 通过。
- [ ] performance budgets 通过，或只剩无 demo 影响的明确 P2 acceptance。
- [ ] final fix 后三轮连续完整彩排成功。
- [ ] 无 unresolved P0/P1。

**解锁下一计划：** 验收完成后解锁 Plan 08。
