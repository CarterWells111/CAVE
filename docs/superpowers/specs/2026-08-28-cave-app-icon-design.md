# 内界 CAVE App 图标设计

## 目标

将用户提供的 `logo.png` 作为内界 CAVE 的统一产品图标。当前范围包括 iOS 本地开发、EAS preview、EAS production，以及官网 favicon；本次不配置 Android 图标。

## 视觉处理

- 以用户提供的透明 PNG 为唯一视觉源，不使用 AI 预览图作为发布资产。
- 保持原图的位置、比例、颜色、纹理和边缘不变。
- 仅将透明区域精确合成到纯色深紫黑背景 `#1B0D1F`。
- iOS 成品为 1024×1024 的不透明 PNG，不预先添加圆角、边框、文字、阴影或光晕。
- 官网 favicon 使用同一合成图的等比例缩小版本，不重新绘制 logo。

## 配置与资产

### iOS App

- 在移动端项目内保存发布用图标资产。
- 在 Expo `app.config.ts` 的公共配置中设置 `icon`，使 development、preview 和 production 构建共用同一文件。
- 保持现有 iOS bundle identifier 与 EAS profiles 不变。
- 不新增 `android` 图标或 adaptive icon 配置。

### 官网

- 官网当前位于独立的干净 `main` 工作树中。
- 用新 PNG favicon 替换旧的 `favicon.svg` 品牌标记。
- 更新 HTML 图标引用和现有静态控制测试，使构建产物只引用新的 favicon。

## 验证

- 静态检查 iOS 图标为 1024×1024 PNG，所有像素均不透明，四角颜色为 `#1B0D1F`。
- 解析 Expo 最终配置，确认所有 EAS profile 共享同一个 `icon`，且没有新增 Android 配置。
- 运行移动端相关测试、类型检查或 Expo 配置校验。
- 运行官网 favicon 测试与生产构建，确认构建产物包含并引用新 PNG。
- 检查两个工作树的差异，只包含图标、相关配置、测试与本设计文档，不纳入用户已有的未提交改动。

