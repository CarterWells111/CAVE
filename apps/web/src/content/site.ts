export const site = Object.freeze({
  name: "内界 CAVE",
  owner: "ZHIQI LIANG",
  origin: "https://neijiecave.com",
  supportEmail: "support@neijiecave.com",
  eyebrow: "Consent · Awareness · Voice · Exploration",
  statement: "探索那些隐于沉默、未被好好说清的事。循着内心的回响，找到属于自己的靠近方式。",
  reassurance: "期待、紧张和犹豫，可以同时存在。",
  updatedAt: "2026-08-28"
});

export type NavItem = Readonly<{
  href: string;
  label: string;
}>;

export type ExperienceStep = readonly [stepNumber: string, title: string, description: string];

export type FaqEntry = readonly [question: string, answer: string];

export const navItems: readonly NavItem[] = Object.freeze([
  Object.freeze({ href: "/", label: "了解 CAVE" }),
  Object.freeze({ href: "/privacy/", label: "隐私" }),
  Object.freeze({ href: "/support/", label: "支持" }),
  Object.freeze({ href: "/safety/", label: "安全" }),
  Object.freeze({ href: "/sources/", label: "内容来源" })
]);

export const principles = Object.freeze([
  "身体反应不等于同意。",
  "同意针对具体行为，并且持续、可以撤回。",
  "犹豫与期待可以同时存在。",
  "私密探索默认留在用户自己的设备上。"
]);

export const experienceSteps: readonly ExperienceStep[] = Object.freeze([
  Object.freeze(["01", "成年确认", "确认这是面向 18 岁及以上成年人的体验。"] as const),
  Object.freeze(["02", "看见期待与在意", "共同过夜不代表任何事情必须发生。"] as const),
  Object.freeze(["03", "认识身体", "通过有来源、非色情的内容认识身体与常见差异。"] as const),
  Object.freeze(["04", "分别感受每种靠近", "对不同靠近方式逐一留下此刻的感受。"] as const),
  Object.freeze(["05", "听见自己的需要", "回看答案、表达难度与让自己更安心的条件。"] as const),
  Object.freeze(["06", "练习放慢或暂停", "用预设情境练习改变、暂停或撤回同意。"] as const),
  Object.freeze(["07", "整理并决定是否分享", "把私人准备与可给对方看的沟通卡清楚分开。"] as const)
]);

export const privacyPoints = Object.freeze([
  "旅程、练习、沟通卡和普通回顾无需账号；内界手记需要邮箱登录，以便在同一设备上按账号隔离。",
  "登录不等于同步：旅程选择、日记、反思记录、练习结果、沟通卡和界面偏好仍只保存在当前设备，不会上传到 CAVE 自有服务器。",
  "登录服务保存账户、验证码、速率限制和会话所需的最少元数据；邮箱地址以不可逆的带密钥摘要用于查找，发送验证码时会临时交给邮件服务商。",
  "CAVE 不把本机内容或登录元数据用于广告、画像或行为分析。",
  "只有在你主动操作时，沟通卡图片才会进入系统相册，文字才会进入系统剪贴板；相关系统服务由 Apple 与你的设备设置控制。",
  "删除云端账户与删除本机内容是两个独立操作；设备被解锁或你导出内容后，他人仍可能看到相关内容。"
]);

export const supportFaq: readonly FaqEntry[] = Object.freeze([
  Object.freeze(["使用 CAVE 需要账号吗？", "旅程、练习、沟通卡和普通回顾无需账号；内界手记需要邮箱登录，以便在同一设备上按账号隔离。手记仍只保存在本机，不会开启内容同步。"] as const),
  Object.freeze(["怎样删除邮箱账户？", "登录后在账户管理中完成一次新的邮箱验证码确认，并选择保留锁定的本机手记，或先删除当前账号手记再删除云端账户。其他本机内容不受影响。"] as const),
  Object.freeze(["内容会自动发给别人吗？", "不会。预览、保存或复制都不等于发送，分享必须由你主动完成。"] as const),
  Object.freeze(["怎样删除本机数据？", "在 App 的“设置”中选择“删除全部本机数据”，再次确认后完成清除。"] as const),
  Object.freeze(["卸载等于删除吗？", "卸载行为由 iOS 管理。需要确定清除 CAVE 管理的数据时，请先使用 App 内的删除功能。"] as const),
  Object.freeze(["为什么只面向成年人？", "当前内容和情境仅为 18 岁及以上成年人设计。"] as const)
]);
