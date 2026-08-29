# 08 发布、演示与双命题提交实施计划

> 历史计划：不再作为当前产品设计与实施范围的依据。当前范围以 `docs/product/2026-08-27-seven-screen-product-spec.md` 为准；本文件中的网络降级、录屏、备用设备与演示重置任务不再执行。

> 执行要求：只从 Plan 07 验证过的 runtime commit 生成 artifacts；两套提交叙事可以不同，技术事实必须完全一致。

**目标（Goal）：** 发布一个已验证的本地八页 build 与独立 gateway infrastructure，准备四个演示降级层，并从同一技术事实完成萨福/Eazo 两套材料。

**架构（Architecture）：** release artifacts 从 Plan 07 的 verified commit 产生。Runtime code sponsor-neutral；submission narrative、screenshots 与 video scripts 分目录维护并引用同一 release manifest。

**技术栈（Tech Stack）：** EAS Build/Update、Cloudflare Wrangler、GitHub、Markdown、screen recording、iOS internal distribution。

---

**依赖计划：** Plan 07 complete 且无 P0/P1 defect。
**输入：** tagged RC、三轮 rehearsal evidence、organizer submission checklist。
**输出：** installed iOS preview、deployed Worker health/API evidence、本地八页路径、polished full-flow video、本地关键路径 screen recording 副本、README/docs、两套 submission directories。
**明确排除：** 非 release blocker 的 feature fix、App Store production submission、sponsor-specific code fork。
**预计时间：** 3 小时。**负责人：** 工程师负责 artifacts；队友负责 narratives 与 video。

## 准确文件路径

```text
README.md
docs/architecture/{overview,security-privacy}.md
docs/runbooks/{demo,model-outage,install}.md
submissions/shared/release-manifest.md
submissions/sappho/{submission,project-description,video-script,asset-checklist}.md
submissions/eazo/{submission,project-description,video-script,asset-checklist}.md
submissions/{sappho,eazo}/assets/**
```

## 任务 1：锁定 Release Manifest

- [ ] 确认 Git clean，HEAD 等于 Plan 07 verified commit。
- [ ] 在 `release-manifest.md` 把该 commit 记录为 `runtimeCommit`，并记录 app semantic version、iOS build number、Expo runtime、API contract、prompt、policy、model mode/name、content version。
- [ ] 记录 accepted P2 issues 与明确 non-features。
- [ ] 后续允许 docs/assets commits，但 `runtimeCommit` 固定；任何 runtime code/config change 都使 Plan 07 rehearsal evidence 失效，必须重跑受影响 checks 与三轮彩排。
- [ ] 提交：`git add submissions/shared && git commit -m "docs: lock hackathon release manifest"`。

## 任务 2：部署演示 Gateway

- [ ] 配置 production-demo Worker vars；通过 Wrangler secret input 设置 `MODEL_API_KEY`，禁止出现在 shell history、`.env` 或 docs。
- [ ] 从 `runtimeCommit` 运行 gateway tests 与 `pnpm build:gateway`。
- [ ] 使用 repository-pinned Wrangler command 部署。
- [ ] 调用 `/health`、`/v1/meta`，contract/prompt/policy versions 必须与 manifest 一致。
- [ ] 跑一个 Mock provider contract request；有凭证时可另跑 Live turn/debrief，只记录为非主演示 infrastructure evidence。
- [ ] 只保存 deployment URL、timestamp、version 和 status，不保存 secret/dialogue。

## 任务 3：生成并安装 iOS Preview Build

- [ ] 从 `runtimeCommit` 运行 `pnpm dlx eas-cli@latest build --profile preview --platform ios`。
- [ ] build 使用 `preview` EAS channel；gateway 环境变量缺失不得阻止八页 routes 启动。
- [ ] 安装到已注册主演示 iPhone，关闭 developer tooling，重启两次并完成八页 core flow。
- [ ] 断网验证 Page 1—8、预设练习、清单、沟通卡和本机保存。
- [ ] 在 manifest 记录 EAS build ID/URL、device、iOS version、install time 与 observed versions。

## 任务 4：记录 Android 延期边界

- [ ] 在 release manifest 与 `docs/runbooks/install.md` 记录 Android 已延期，不属于当前黑客松 release scope。
- [ ] 本轮不配置 Android package、不运行 Android build、不生成或发布 Android artifact。
- [ ] Android 安装、smoke 与发布验收均不执行，也不作为 Plan 08 Gate；启用前必须另走固定决策变更。

## 任务 5：准备四层演示降级

1. Installed Preview Build iPhone：完整八页 local-first 主路径。
2. Verified development/simulator build：在开发电脑上运行同一 deterministic catalogs 和 presets。
3. Polished pre-recorded full-flow video：完整八页成片，带提交叙事与剪辑。
4. 本地可用的关键路径 screen recording 副本：只覆盖八页主演示关键路径，无需网络或外部链接即可播放。

- [ ] `demo.md` 固定 launch state、settings、demo inputs、expected outputs、time checkpoints、presenter handoff。
- [ ] `model-outage.md` 说明 Worker/model 故障不影响八页主演示，并固定 infrastructure health checks 与“本 Demo 未调用 AI”的披露。
- [ ] 每层不改代码、不暴露 secret 即可启用。
- [ ] 设备充电、关闭通知、预开 QR/build links，并验证手机热点等 venue-network fallback。

## 任务 6：补齐 Repository 文档

- [ ] README 包含 problem、八页 architecture diagram、local setup、environment names、preset mode、test commands、privacy boundary、safety limits、build/install、repository structure。
- [ ] `overview.md` 描述 eight-page mobile-private domain、local derivation、storage、gateway/shared-package boundaries 与四个独立 public routes。
- [ ] `security-privacy.md` 描述 journey draft/saved card/server data、SQLCipher、SecureStore、no-AI demo boundary、log allowlist、deletion、known limitations 与 non-medical disclaimer。
- [ ] GitHub repository topic 设置为 `shenicest-fission`；命题要求处使用 `#shenicest-fission`。
- [ ] 让一台 clean machine/clean checkout 无 API key 启动八页 flow，预期成功且无 network request。
- [ ] 提交：`git commit -am "docs: complete project and demo runbooks"`。

## 任务 7：萨福提交包

- [ ] `submission.md` 包含 track/command、final name、slogan、100—200 字描述、repository link、video link、install link、image inventory。
- [ ] `project-description.md` 包含 background、target user、八页 architecture、为什么 Demo 采用预设逻辑、privacy/safety、innovation、team split、development process、limitations、follow-up plan。
- [ ] `video-script.md` 以关系/情绪洞察开场，再展示身体认识 → 当前态度 → 预设表达练习 → 沟通卡。
- [ ] asset checklist 固定 hero、core-flow screenshots、architecture、privacy/safety、team/QR。
- [ ] 每个 technical claim 对照 shared manifest；禁止 production-grade 等无证据表述。

## 任务 8：Eazo 提交包

- [ ] 使用与萨福相同的 required fields 与 artifact links。
- [ ] `video-script.md` 以“静态知识不等于会处理真实场景”的 product gap 开场，再展示八页 observe/practice/prepare/share loop。
- [ ] project description 强调真实女性使用问题、产品完整性、持续价值、稳定性与 data safety。
- [ ] 不宣称 separate Eazo build、feature set、dataset 或 model。
- [ ] 每个 technical claim 与 shared manifest 一致。

## 任务 9：录屏与 assets 验证

- [ ] 使用 installed preview build 录制，画面可核对 app/build 且无通知或个人数据。
- [ ] Page 6 画面始终标记为预设对话；Page 8 标记为根据选择整理；任何镜头不得称为 AI 生成。
- [ ] 保存 clean master recording，再生成萨福/Eazo 不同开头与结尾的 edits。
- [ ] 另存本地关键路径 screen recording 副本；它与完整流程成片分离，并在无网络、无外部链接时独立播放验证。
- [ ] 两个 exported videos 从头到尾带声音播放；links/QR 在第二设备验证。
- [ ] screenshots 不含 API key、device identifier、private dialogue、debug overlay、无关 account data。

## 任务 10：最终提交审计与 Tag

- [ ] 对照 organizer checklist 检查两目录：command、name、slogan、description、image、repository/topic、project document、video、optional experience link。
- [ ] repository 与 shared links 无需开发者本地 session 即可访问。
- [ ] 最后一次验证 iPhone launch、Worker health，以及 Preview iPhone、verified development/simulator build、polished full-flow video、本地关键路径 screen recording 四层。
- [ ] 更新 Plan 00 状态与证据；提交：`git commit -am "docs: finalize dual hackathon submissions"`。
- [ ] 在该 final submission commit 创建 annotated tag `hackathon-submission`；确认其中 manifest 仍记录 tested/built `runtimeCommit`。

## 故障、回滚与降级

- Worker failure：继续本地八页演示并使用 recording；不部署未验证代码，也不暗示 Page 6 使用 Worker。
- iOS install failure：保留现有 verified preview build，排查新 build 时不得删除它。
- submission link failure：只替换 link/asset 并重验，不改 runtime。
- emergency runtime fix：创建 fix commit，重跑相关 Plan 07 tests/security/rehearsals，更新 manifest/builds 后重新 tag。

## 验收证据清单

- [ ] 主 iPhone 脱离开发电脑运行。
- [ ] Worker versions 与 manifest 一致。
- [ ] Preview iPhone、verified development/simulator build、polished full-flow video、本地关键路径 screen recording 四层已逐项验证。
- [ ] README、architecture 与 security docs 完整准确。
- [ ] 萨福/Eazo 叙事不同，technical facts 与 links 相同。
- [ ] organizer checklist 每项有 verified artifact/link。
- [ ] final tag 指向 final submission commit，manifest 指向 verified `runtimeCommit`。

**终态：** 四天 MVP 的代码发布证据、演示兜底与双命题材料全部封存。
