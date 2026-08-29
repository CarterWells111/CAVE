# 内界 CAVE 启动页设计

## 目标

在 Expo Go 加载项目时提供品牌化的启动画面，并让之后的 iOS preview 与 production 构建使用同一视觉。启动页与已配置的 iOS 桌面图标保持一致，但不新增 Android 桌面图标配置。

## 视觉

- 使用用户提供的透明 CAVE logo，不重新绘制或改变颜色、比例和细节。
- 背景使用已确认的纯色深紫黑 `#1B0D1F`。
- logo 居中显示，目标宽度为 200px，使用 `contain`，不裁切、不拉伸。
- 不添加文字、圆角、边框、额外阴影、动画或进度指示器。

## 实现

- 将透明 logo 的精确副本保存为移动端启动页资产。
- 安装与 Expo SDK 54 匹配的 `expo-splash-screen` 直接依赖。
- 在 Expo 公共插件配置中添加 `expo-splash-screen`，设置图片、背景色、宽度与缩放方式。
- 保持现有 `ios.icon` 配置不变；顶层 `icon`、`android.icon` 与 `android.adaptiveIcon` 继续为空。
- development、preview 和 production 使用同一启动页配置。

## 验证

- 测试三个 EAS profile 的 splash 插件配置完全一致。
- 校验启动页资产与用户源图 SHA-256 完全一致，并保留透明通道。
- 解析 Expo public config，确认 splash 插件存在且 iOS-only App 图标范围未回退。
- 运行移动端聚焦测试、typecheck 与 Expo Doctor。
- Expo Go 仅用于观察开发期模拟效果；真实原生启动页以 iOS preview 或 production build 为准。
