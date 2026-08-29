# Public First-Run Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 首次打开 App 时立即显示并可使用“首页 / 回顾 / 练习 / 我的”四个 Tab，同时让“开启旅程”和底栏在常见小屏首屏内可见，并继续保证成年声明前不打开私密数据库。

**Architecture:** 保留 `JourneyRuntimeProvider` 现有 public/authorized 安全边界。public 状态不注入伪 runtime；公共路由用 `useOptionalJourneyRuntime()` 分支渲染无私密仓库依赖的界面，authorized 子组件才读取 cards、shellState 和 reviewHistory。18+ 门禁仅保护 preface 与正式旅程；私密卡片、历史回顾详情继续单独门禁。

**Tech Stack:** Expo Router、React Native、TypeScript、Jest、Testing Library、SQLCipher/SecureStore 边界测试。

---

## 实施约束

- 不修改 `JourneyRuntimeProvider` 的 public/authorized 上下文隔离，不在 public 状态暴露 SQL repositories。
- 不在 public Tab 中调用 `useJourneyRuntime()`；必须先由 wrapper 调用 `useOptionalJourneyRuntime()`，再把非空 runtime 传给独立 authorized 子组件。
- `cards/_layout.tsx` 继续受 `ShellRouteGate` 保护；`reviews/[id].tsx` 在 reviews 公共布局解锁后自行加门禁。
- 不改变成年声明文案、六页顺序、草稿保存、未成年阻断、卡片/回顾数据模型。
- 不改通用 `Screen`、`Card`、`Button` 的尺寸；首页只做局部间距调整，保留 ScrollView 无障碍兜底。
- 工作树已有用户改动；每个任务只触碰列出的文件，不做全树格式化，不清理 stash。

## Task 1：入口和公共底部导航

**Files:**

- Modify: `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/src/features/shell/ui/JourneyLongTermNav.tsx`
- Modify: `apps/mobile/src/features/shell/app-index.test.tsx`
- Modify: `apps/mobile/src/features/shell/ui/JourneyLongTermNav.test.tsx`
- Modify: `apps/mobile/src/features/journey/ui/route-boundary.test.ts`
- Modify: `apps/mobile/src/features/journey/seven-screen-routes.integration.test.ts`

**Step 1: 写 RED 测试**

- 根入口断言 `router.replace("/(tabs)")`，并继续断言不读取 `shellState`。
- public runtime 为 `null` 时，`JourneyLongTermNav` 立即渲染四个 tab；点击分别 replace 到四个长期路径；不调用任何 shell/private repository。
- authorized 情况也保持相同行为，不等待 completion。

Run:

```powershell
node .\node_modules\jest\bin\jest.js src/features/shell/app-index.test.tsx src/features/shell/ui/JourneyLongTermNav.test.tsx src/features/journey/ui/route-boundary.test.ts src/features/journey/seven-screen-routes.integration.test.ts --runInBand
```

Expected: 旧 `/journey/welcome` 和隐藏 nav 的断言失败。

**Step 2: 最小实现**

- `IndexRoute` 仅把 replace 目标改为 `/(tabs)`。
- 将 `JourneyLongTermNav` 简化成不读取 runtime/completion 的纯导航：

```tsx
export function JourneyLongTermNav({ activeTab }: JourneyLongTermNavProps) {
  const router = useRouter();
  return (
    <LongTermBottomNav
      activeTab={activeTab}
      navigate={(tab) => router.replace(getLongTermDestination(tab).path)}
    />
  );
}
```

**Step 3: 跑定向测试并确认 GREEN。**

## Task 2：解除公共布局门禁，同时保护私密详情

**Files:**

- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/app/practice/_layout.tsx`
- Modify: `apps/mobile/app/reviews/_layout.tsx`
- Modify: `apps/mobile/app/reviews/[id].tsx`
- Modify: `apps/mobile/src/features/shell/shell-routes.integration.test.ts`
- Create: `apps/mobile/src/features/shell/review-detail-route.test.tsx`

**Step 1: 写 RED 测试**

- 源码契约要求 `(tabs)`、`practice`、`reviews` layout 不含 `ShellRouteGate`，并要求 `cards/_layout.tsx` 仍含门禁。
- public 深链渲染 `reviews/[id]` 时不调用 `reviewHistory.loadDetail()`，而是通过 `ShellRouteGate` 回到公共位置。
- authorized 深链保留现有详情加载、重试、删除和 branch 行为。

**Step 2: 最小实现**

- 三个公共 layout 直接渲染 `Tabs`/`Stack`。
- review detail 默认导出只做门禁；把现有 hook/data 逻辑移入独立子组件：

```tsx
export default function ReviewDetailRoute() {
  return (
    <ShellRouteGate>
      <AuthorizedReviewDetailRoute />
    </ShellRouteGate>
  );
}
```

`AuthorizedReviewDetailRoute` 才允许调用 `useJourneyRuntime()`。

**Step 3: 跑测试**

```powershell
node .\node_modules\jest\bin\jest.js src/features/shell/shell-routes.integration.test.ts src/features/shell/review-detail-route.test.tsx --runInBand
```

## Task 3：公共首页与 completion 四态

**Files:**

- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/src/features/shell/home-route.test.tsx`

**Step 1: 写 RED 测试**

覆盖：

- runtime `null`：显示 `开启旅程` 和设置；点击分别进入 `/journey/adult-gate`、`/settings`；cards/shellState 调用均为 0。
- authorized loading：显示现有本机加载状态，Tabs 由 layout 保持，不误显示长期首页。
- authorized completion 读取失败：显示可重试错误；重试成功后继续。
- authorized completion `null`：显示 `WelcomePage`；没有草稿时显示“开启旅程”，有已确认成年草稿时沿用原有“继续旅程”并按 `getResumePath`/preface 规则恢复。
- authorized completion value：显示现有 `HomeScreen`，并读取 metadata-only cards。
- 首次首页 `Screen` 带 `testID="first-run-home-scroll"`，保留默认 32pt 垂直留白和 `contentInsetAdjustmentBehavior="automatic"`；所有视口 `scrollEnabled=false`，受限视口只重排品牌锁定区。

**Step 2: 最小实现**

采用无条件 hook 安全的组件拆分：

```tsx
export default function HomeRoute() {
  const runtime = useOptionalJourneyRuntime();
  return runtime === null
    ? <FirstRunHomeRoute runtime={null} />
    : <AuthorizedHomeRoute runtime={runtime} />;
}
```

- `FirstRunHomeRoute` 只渲染公共 `WelcomePage`。
- `AuthorizedHomeRoute` 才加载 `shellState`；completion 为 `null` 时渲染 welcome，存在时加载 cards 并渲染长期 `HomeScreen`。
- 对 completion 的 loading/error/null/value 使用显式状态，不能把初始 `null` 当成读取完成。
- 首页 welcome 的 Screen 使用：

```tsx
<Screen
  alwaysBounceVertical={false}
  scrollEnabled={false}
  testID="first-run-home-scroll"
>
```

如 `Screen` 的 props 未透传 `testID`，给内部 ScrollView 增加明确且通用的 `testID` 透传，不改变其安全区行为。

**Step 3: 跑测试**

```powershell
node .\node_modules\jest\bin\jest.js src/features/shell/home-route.test.tsx src/features/shell/ui/HomeScreen.test.tsx --runInBand
```

## Task 4：公共回顾、练习和我的

**Files:**

- Modify: `apps/mobile/app/(tabs)/reviews.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/src/features/shell/profile-route.test.tsx`
- Create: `apps/mobile/src/features/shell/public-tab-routes.test.tsx`

**Step 1: 写 RED 测试**

- public 回顾显示主题入口；点击身体/边界进入 `/reviews/topic/:id`，点击练习主题进入 `/practice/session`；不读 shellState。
- public 完整六页入口不得绕过成年门禁，应进入 `/journey/adult-gate`。
- public 练习仍显示两项本机预设并能进入 session-only route（布局契约在 Task 2 覆盖）。
- public 我的显示“还没有沟通卡”和“还没有历史回顾”，设置按钮可用；cards/reviewHistory 调用均为 0。
- authorized 回顾和我的保留 metadata-only 加载、部分失败重试与旧记录打开行为。

**Step 2: 最小实现**

- `ReviewsRoute`、`ProfileRoute` 都用 optional runtime wrapper + authorized 子组件。
- public reviews 直接用：

```tsx
<ReviewsHubScreen
  activeJourney={null}
  loadState="ready"
  onStartFullReview={() => router.push("/journey/adult-gate")}
  onStartTopic={openTopic}
  topics={topics}
/>
```

- public profile 直接用两个 ready/empty 数组，不创建 repository effect。

**Step 3: 跑测试**

```powershell
node .\node_modules\jest\bin\jest.js src/features/shell/public-tab-routes.test.tsx src/features/shell/profile-route.test.tsx --runInBand
```

## Task 5：公共设置保持原有功能，但不伪造删除能力

**Files:**

- Modify: `apps/mobile/app/settings/index.tsx`
- Modify: `apps/mobile/app/journey/welcome.tsx`
- Modify: `apps/mobile/src/features/shell/ui/SettingsScreen.tsx`
- Modify: `apps/mobile/src/features/shell/ui/SettingsScreen.test.tsx`
- Create: `apps/mobile/src/features/shell/settings-route.test.tsx`

**Step 1: 写 RED 测试**

- public settings 不 redirect；外观三选项和返回按钮正常工作。
- public settings 不显示“删除全部本机数据”，也不调用 runtime/private repositories。
- authorized settings 保留二次确认、失败重试和删除成功流程；成功后进入 `/(tabs)`。
- `/journey/welcome` 与首次首页都始终提供设置入口。

**Step 2: 最小实现**

- `SettingsRoute` 无论 runtime 是否存在都读取 public/authorized ThemeProvider 的 `useThemePreference()`。
- `SettingsScreen` 把删除能力收束成可选对象，避免 no-op：

```ts
type DeleteCapability = {
  deleteAllData(): Promise<void>;
  onContinue(): void;
};

type SettingsScreenProps = {
  appearancePreference: ThemePreference;
  appearanceSaving: boolean;
  resolvedTheme: ResolvedTheme;
  onAppearancePreferenceChange(preference: ThemePreference): Promise<void>;
  onBack(): void;
  deletion?: DeleteCapability;
};
```

- 只有 `deletion` 存在时才渲染删除卡片；authorized route 注入真实能力，public 不传。
- 删除成功回到 `/(tabs)`；Provider 撤销 authorized context 后仍能落在公共 Tabs。

**Step 3: 跑测试**

```powershell
node .\node_modules\jest\bin\jest.js src/features/shell/settings-route.test.tsx src/features/shell/ui/SettingsScreen.test.tsx src/features/journey/ui/pages/WelcomePage.test.tsx --runInBand
```

## Task 6：首页按视口固定单屏

**Files:**

- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/journey/welcome.tsx`
- Create: `apps/mobile/src/features/journey/ui/first-run-layout.ts`
- Create: `apps/mobile/src/features/journey/ui/first-run-layout.test.ts`
- Modify: `apps/mobile/src/features/journey/ui/pages/WelcomePage.tsx`
- Modify: `apps/mobile/src/features/journey/ui/pages/WelcomePage.test.tsx`

**Step 1: 写 RED 样式测试**

- 给 brand/actions 增加 `testID="welcome-brand"`、`testID="welcome-actions"`。
- `StyleSheet.flatten` 断言：landing gap 仍为 24、brand `paddingTop` 仍为 20、actions gap 为 12，且 `marginTop` 未定义。
- `resolveFirstRunLayout` 断言 360×780 使用原纵排；360×667、320 宽或字体缩放超过 1.1 时只把 CAVE/内界改成横排。
- `开启旅程` 按钮最小高度继续为 52；不得通过压缩触摸目标达成首屏。

**Step 2: 最小实现**

```ts
page: {
  flexGrow: 1,
  gap: theme.space.lg,
  minWidth: 0,
  position: "relative" as const,
},
brand: {
  alignItems: "center" as const,
  gap: theme.space.xs,
  paddingTop: theme.space.card,
},
actions: { gap: theme.space.compact },
```

不修改文案、字号、通用 Card 或品牌留白。首页始终关闭滚动和 iOS 垂直回弹；受限视口通过品牌中英文横向重排减少占高，不统一压缩页面。

**Step 3: 跑测试**

```powershell
node .\node_modules\jest\bin\jest.js src/features/journey/ui/pages/WelcomePage.test.tsx src/features/shell/home-route.test.tsx --runInBand
```

## Task 7：清理旧启动契约并验证私密存储边界

**Files:**

- Modify: `apps/mobile/src/features/shell/application/app-shell-service.ts`
- Modify: `apps/mobile/src/features/shell/application/app-shell-service.test.ts`
- Modify: `apps/mobile/src/features/journey/runtime/JourneyRuntimeProvider.test.tsx`
- Modify: `apps/mobile/src/features/shell/runtime-composition.integration.test.ts`
- Modify: `apps/mobile/src/features/shell/shell-routes.integration.test.ts`

**Step 1: 写 RED 测试**

- `resolveShellLaunchPath` 对 completion `null` 和 value 都返回 `/(tabs)`；或若确认无生产调用，删除该旧 API 及其断言。
- native harness 在 public 首页、回顾、练习、我的、设置可渲染/操作时断言：`getDatabaseKey`、`getOrCreateDatabaseKey`、`openDatabaseAsync` 和 SQL 调用均为 0。
- 点击“开启旅程”只导航；只有成年确认成功后才执行既有 `service.initialize()` 和数据库打开流程。
- Expo Go 全局预览提示继续不存在。

**Step 2: 最小实现**

- 只调整旧 launch contract 与测试；不要弱化 Provider 的 fail-closed 行为。
- 成年声明读取失败、待删除状态、恢复删除、创建 runtime 失败的现有测试必须继续通过。

**Step 3: 定向回归**

```powershell
$env:NODE_PATH='..\..\node_modules\.pnpm\@babel+runtime@7.29.7\node_modules'
node .\node_modules\jest\bin\jest.js src/features/journey/runtime/JourneyRuntimeProvider.test.tsx src/features/shell/runtime-composition.integration.test.ts src/features/shell/application/app-shell-service.test.ts src/features/shell/shell-routes.integration.test.ts --runInBand
```

## Task 8：全量验收

从 `apps/mobile` 执行：

```powershell
$env:NODE_PATH='..\..\node_modules\.pnpm\@babel+runtime@7.29.7\node_modules'
node .\node_modules\jest\bin\jest.js --runInBand
node '..\..\node_modules\typescript\bin\tsc' --noEmit -p tsconfig.json
node '..\..\node_modules\eslint\bin\eslint.js' .
```

再执行：

```powershell
git diff --check
git status --short
```

验收清单：

- 冷启动直接进入四 Tab；四个入口从 public 状态即可见、可切换。
- public 首页同时可见品牌、说明卡、“开启旅程”和底栏；默认小屏无需滚动。
- public 设置正常打开，外观可改；无私密数据时不伪造删除入口。
- public 回顾主题、预设练习可用；完整六页入口仍经过 18+。
- public 我的显示真实空状态；没有 repository 调用。
- preface、六页正式旅程、私密卡片和历史回顾详情仍按原规则保护。
- 成年声明前数据库密钥、SQLCipher 打开和 SQL 调用全部为 0。
- 顶部/底部不再出现重复安全区背景条；Expo Go 全局预览提示不存在。
