# 06 产品功能收口与体验完善实施计划

> 执行要求：只在已冻结的架构与 P0 范围内完善产品；萨福与 Eazo 的差异留在提交素材，不进入 runtime branch。

**目标（Goal）：** 把技术闭环收口成连贯、可访问、无死路的 MVP，不扩大公共契约或功能范围。

**架构（Architecture）：** 最终内容通过 validated packages 装配，由 reusable feature components 渲染。Brand text 与 submission framing 属于 config/assets；navigation、domain、storage 与 API contracts 始终共享。

**技术栈（Tech Stack）：** Expo/React Native、Expo Router、React Native SVG、已安装时使用 Reanimated、design tokens、React Native Testing Library、VoiceOver 真机测试。

---

**依赖计划：** Plan 05 complete。  
**输入：** 可运行移动闭环、reviewed content、submission-neutral brand config。  
**输出：** 最终内容装配、design system、完整 screen states、accessibility、privacy/model disclosures、guide。  
**明确排除：** account、social/community、checkout、cloud sync、新模型能力、sponsor code fork。  
**预计时间：** 5 小时。**负责人：** 两人共同；工程师负责实现，队友负责内容与商业披露审核。

## 准确文件路径

```text
apps/mobile/src/config/brand.ts
apps/mobile/src/core/design/{tokens,theme,motion}.ts
apps/mobile/src/core/ui/{Screen,Card,Button,StatusBanner,EmptyState,ErrorState}.tsx
apps/mobile/src/features/courses/ui/**
apps/mobile/src/features/practice/ui/**
apps/mobile/src/features/guide/{application,ui}/**
apps/mobile/src/features/privacy/ui/**
packages/content/data/**
packages/content/assets/**
apps/mobile/src/**/*.test.tsx
```

## 任务 1：冻结内容与 asset manifest

- [ ] 内容队友逐条核对 source、wording、scenario outcome，审核后才把 production record 改为 `reviewed`。
- [ ] asset manifest 写入 deterministic ID、dimensions、alt text、license/source metadata。
- [ ] 先写失败测试：missing asset、missing alt text、broken reference、unused required asset 必须使 validation 失败。
- [ ] 运行 production content validation；预期无 draft、missing source、broken reference 或缺失资源。
- [ ] 提交：`git commit -am "content: freeze reviewed mvp catalog"`。

## 任务 2：可替换 Brand 与 Design Tokens

- [ ] 定义 `brand.ts`：technical slug、display name、slogan、support URL、privacy URL、sponsor-neutral default copy；route 禁止 hardcode display name。
- [ ] 定义 semantic colors、typography scale、spacing、radii、shadows、elevation、minimum touch size、reduced-motion durations。
- [ ] 先写 contrast tests：正文/背景组合不满足 WCAG AA 时失败。
- [ ] 替换 P0 screens 的 raw color/spacing literal；只允许一个记录清楚的 platform system color exception。
- [ ] 重跑 token/contrast tests；提交：`git commit -am "feat: add replaceable brand and design tokens"`。

## 任务 3：共享 UI primitives 与状态覆盖

- [ ] 先为 `Screen`、`Card`、`Button`、`StatusBanner`、`EmptyState`、`ErrorState` 写 rendering/accessibility tests。
- [ ] `Button` 支持 default、pressed、disabled、loading、destructive、focus，并带 accessibility role/label。
- [ ] `Screen` 统一 Safe Area、keyboard avoidance、scroll、Dynamic Type、focus restoration。
- [ ] 为每个 P0 route 创建 loading、content、empty、offline、recoverable error、terminal error state matrix。
- [ ] component tests 证明每个状态都有 visible action 或明确 terminal explanation，不存在死路。
- [ ] 提交：`git commit -am "feat: standardize screen and state primitives"`。

## 任务 4：课程与练习 presentation 收口

- [ ] 用既有 Use Cases 装配 course map、lesson blocks、quiz feedback、practice setup/session/waiting/debrief/save confirmation。
- [ ] model waiting text 固定且与 roleplay text 分离。
- [ ] 先写 component tests：long text、largest font、smallest supported iPhone、empty linked lessons、multiple debrief alternatives。
- [ ] 处理 keyboard，任何支持屏幕上 input/send controls 都不得被遮挡。
- [ ] 遵循 reduced-motion；动画不得承载唯一信息或阻断 navigation。
- [ ] 提交：`git commit -am "feat: finish learning and practice presentation"`。

## 任务 5：隐私、模型与数据控制

- [ ] 隐私页准确说明 local progress、transient raw conversations、explicit save、Worker processing、delete-all。
- [ ] first live request 前显示一次 acknowledgement，明确哪些字段离开设备、gateway 不保留什么。
- [ ] Profile 提供 model mode、saved-data controls、per-record delete、delete-all。
- [ ] delete-all confirmation 禁止 shame 或 dark pattern。
- [ ] 先写测试：拒绝 live acknowledgement 后 local content 仍可用，practice 保持 Mock/disabled；接受后只持久化 acknowledgement flag。
- [ ] 提交：`git commit -am "feat: expose privacy and model controls"`。

## 任务 6：用品 Guide 与合作披露（P1）

- [ ] 从 local validated content 渲染 guide categories 与 educational selection criteria。
- [ ] guide navigation 与 practice/debrief 独立，永不根据 transcript 推荐产品。
- [ ] sponsored/affiliate entry 必须显示 disclosure 与 source metadata。
- [ ] 不实现 cart、checkout、affiliate tracking ID、external analytics。
- [ ] 先写测试：改变 practice state 不得影响 guide ordering/content。
- [ ] 提交：`git commit -am "feat: add independent educational guide"`。

## 任务 7：Accessibility 与 usability pass

- [ ] 为 illustration regions、buttons、quiz answers、message bubbles、progress、debrief dimensions、destructive actions 补 accessibility labels/hints。
- [ ] 真实 iPhone 上验证主流程 VoiceOver order。
- [ ] largest accessibility Dynamic Type 下只允许 vertical growth/scroll，不截断关键信息。
- [ ] 验证最小 44×44 point touch target，以及不只依赖颜色的 status indicator。
- [ ] submit failure 后 focus 移到 error/status banner。
- [ ] 把 device、font size、VoiceOver 结果记录进证据；提交：`git commit -am "fix: complete accessibility pass"`。

## 任务 8：证明双命题共用一个 Build

- [ ] 搜索 application source 中 `sappho`、`eazo` 与 sponsor-specific feature flags；除 `submissions/` 和可选 attribution 外预期为零。
- [ ] 两份 demo scripts 必须引用同一 bundle ID、app version、API contract 与 build URL。
- [ ] submission-specific opening copy 只进入 presentation/video assets，不进入 runtime branches。
- [ ] 提交：`git commit -am "docs: verify submission-neutral product build"`。

## 执行命令与预期结果

- [ ] `pnpm verify` 与 production content validation：退出码 0。
- [ ] mobile component tests 使用 large-text fixtures：全通过。
- [ ] 主 iPhone 完成 VoiceOver、keyboard、rotation/foreground checks。
- [ ] state matrix 的每个 P0 状态均可人工触发并与 snapshot 一致。
- [ ] 普通 practice 后打开 guide：ordering/content 不变。
- [ ] 扫描 `apps/mobile` 与 `packages/content` 中未审核样例标记：预期无命中。

## 故障、回滚与降级

- visual asset 阻断：改用可访问、token-based 的信息面板，不增加 rendering framework。
- Guide 威胁 P0：从 preview build 移除 route/content，保留为 P1 未交付项。
- animation 造成不稳定或 accessibility regression：删除动画，不推迟 Plan 07。
- sponsor framing 需要 runtime logic：把差异退回 submission materials。

## 验收证据清单

- [ ] P0 route 无 unreachable action 或 dead end。
- [ ] 所有 network/local state 都有 tested UI。
- [ ] VoiceOver 与 largest Dynamic Type 能完成主演示路径。
- [ ] privacy、save、delete、model、partnership disclosures 可达。
- [ ] production content/assets 通过 validation。
- [ ] source 无 sponsor-specific product fork。

**解锁下一计划：** 验收完成后解锁 Plan 07。
