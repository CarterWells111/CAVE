export const site = Object.freeze({
  name: "内界 CAVE",
  owner: "ZHIQI LIANG",
  origin: "https://neijiecave.com",
  supportEmail: "support@neijiecave.com",
  eyebrow: "Consent · Awareness · Voice · Exploration",
  statement: "探索那些隐于沉默、未被好好说清的事。循着内心的回响，找到属于自己的靠近方式。",
  reassurance: "期待、紧张和犹豫，可以同时存在。",
  updatedAt: "2026-08-29"
});

export type NavItem = Readonly<{
  href: string;
  label: string;
}>;

export type ExperienceStep = readonly [stepNumber: string, title: string, description: string];

export type DemoFeature = readonly [title: string, description: string];

export type FaqEntry = readonly [question: string, answer: string];

export const navItems: readonly NavItem[] = Object.freeze([
  Object.freeze({ href: "/", label: "了解 CAVE" }),
  Object.freeze({ href: "/demo/", label: "App 演示" }),
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
  Object.freeze(["01", "身体与安全知识", "通过有来源、非色情的内容认识身体差异、健康与同意边界；医学结构图可以选择不看。"] as const),
  Object.freeze(["02", "过夜期待与在意", "整理期待和担心；一起过夜不代表任何事情必须发生。"] as const),
  Object.freeze(["03", "行为地图与边界", "对不同靠近方式逐一留下此刻的感受；更具体的健康教育内容可以选择不看、不答。"] as const),
  Object.freeze(["04", "自我反思", "回看答案、表达难度与让自己更安心的条件；这里不会生成分数或准备度结论。"] as const),
  Object.freeze(["05", "预设沟通练习", "用不录音、不请求麦克风、也不使用 AI 的本机预设情境练习暂停、调整或停止。"] as const),
  Object.freeze(["06", "我的沟通草稿", "编辑并保存想保留的表达；段落可以暂时删除和恢复，内容只保存在本机。"] as const)
]);

export const demoFeatures: readonly DemoFeature[] = Object.freeze([
  Object.freeze(["六页引导旅程", "完成本机成年自我声明和前言后，从身体与安全知识开始，逐页整理期待、边界、感受与表达。"] as const),
  Object.freeze(["身体与安全知识", "查看有来源、非色情的身体知识；医学结构图可以选择不看，持续不适或明显新变化时会提示咨询医疗专业人员。"] as const),
  Object.freeze(["边界表达与不使用 AI 的预设练习", "在行为地图中逐项留下感受，再使用不录音、不请求麦克风、也不使用 AI 的本机预设对话，练习暂停、调整或停止。"] as const),
  Object.freeze(["只保存在本机的回顾、沟通草稿与内界手记", "编辑并保存只留在本机的沟通草稿，也可按主题回顾；登录后可把关键事件和后来的变化写进内界手记，登录仅用于同设备账号隔离。"] as const)
]);

export const privacyPoints = Object.freeze([
  "旅程、练习、沟通草稿和普通回顾无需账号；内界手记需要邮箱登录，以便在同一设备上按账号隔离。",
  "登录不等于同步：旅程选择、手记、反思记录、练习结果、沟通草稿和界面偏好仍只保存在当前设备，不会上传到 CAVE 自有服务器。",
  "登录服务保存账户、验证码、速率限制和会话所需的最少元数据；邮箱地址以不可逆的带密钥摘要用于查找，发送验证码时会临时交给邮件服务商。",
  "CAVE 不把本机内容或登录元数据用于广告、画像或行为分析。",
  "当前版本没有沟通草稿的复制全文、保存图片或系统分享入口。只有在预设练习的安全资源中主动点击“复制号码”时，该号码才会写入系统剪贴板。",
  "删除云端账户与删除本机内容是两个独立操作；能解锁设备并打开 CAVE 的人仍可能看到保存在本机的内容。"
]);

export const supportFaq: readonly FaqEntry[] = Object.freeze([
  Object.freeze(["使用 CAVE 需要账号吗？", "旅程、练习、沟通草稿和普通回顾无需账号；内界手记需要邮箱登录，以便在同一设备上按账号隔离。手记仍只保存在本机，不会开启内容同步。"] as const),
  Object.freeze(["怎样删除邮箱账户？", "登录后在账户管理中完成一次新的邮箱验证码确认，并选择保留锁定的本机手记，或先删除当前账号手记再删除云端账户。其他本机内容不受影响。"] as const),
  Object.freeze(["沟通草稿会自动发给别人吗？", "不会。当前版本没有沟通草稿的复制全文、保存图片或系统分享入口。编辑、全屏展示或保存到内界手记都不会把内容发给别人；预设练习中的“复制”只复制支持号码。"] as const),
  Object.freeze(["怎样删除本机数据？", "在 App 的“设置”中选择“删除全部本机数据”，再次确认后完成清除。"] as const),
  Object.freeze(["卸载等于删除吗？", "卸载行为由 iOS 管理。需要确定清除 CAVE 管理的数据时，请先使用 App 内的删除功能。"] as const),
  Object.freeze(["为什么只面向成年人？", "当前内容和情境仅为 18 岁及以上成年人设计。"] as const)
]);
