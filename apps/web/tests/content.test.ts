import { describe, expect, it } from "vitest";

import {
  experienceSteps,
  navItems,
  principles,
  privacyPoints,
  site,
  supportFaq
} from "../src/content/site";

describe("official site content", () => {
  it("uses the approved identity and five routes", () => {
    expect(site).toEqual({
      name: "内界 CAVE",
      owner: "ZHIQI LIANG",
      origin: "https://neijiecave.com",
      supportEmail: "support@neijiecave.com",
      eyebrow: "Consent · Awareness · Voice · Exploration",
      statement: "探索那些隐于沉默、未被好好说清的事。循着内心的回响，找到属于自己的靠近方式。",
      reassurance: "期待、紧张和犹豫，可以同时存在。",
      updatedAt: "2026-08-28"
    });
    expect(navItems).toEqual([
      { href: "/", label: "了解 CAVE" },
      { href: "/privacy/", label: "隐私" },
      { href: "/support/", label: "支持" },
      { href: "/safety/", label: "安全" },
      { href: "/sources/", label: "内容来源" }
    ]);
  });

  it("keeps the four consent principles and seven-step scope", () => {
    expect(principles).toEqual([
      "身体反应不等于同意。",
      "同意针对具体行为，并且持续、可以撤回。",
      "犹豫与期待可以同时存在。",
      "私密探索默认留在用户自己的设备上。"
    ]);
    expect(experienceSteps).toEqual([
      ["01", "成年确认", "确认这是面向 18 岁及以上成年人的体验。"],
      ["02", "看见期待与在意", "共同过夜不代表任何事情必须发生。"],
      ["03", "认识身体", "通过有来源、非色情的内容认识身体与常见差异。"],
      ["04", "分别感受每种靠近", "对不同靠近方式逐一留下此刻的感受。"],
      ["05", "听见自己的需要", "回看答案、表达难度与让自己更安心的条件。"],
      ["06", "练习放慢或暂停", "用预设情境练习改变、暂停或撤回同意。"],
      ["07", "整理并决定是否分享", "把私人准备与可给对方看的沟通卡清楚分开。"]
    ]);
  });

  it("freezes every nested navigation item and content tuple", () => {
    expect(navItems.every((item) => Object.isFrozen(item))).toBe(true);
    expect(experienceSteps.every((step) => Object.isFrozen(step))).toBe(true);
    expect(supportFaq.every((entry) => Object.isFrozen(entry))).toBe(true);
  });

  it("states the reviewed current-device privacy boundary", () => {
    expect(privacyPoints).toEqual([
      "首版无需账号或登录，也不会在 App 中收集邮箱地址。",
      "旅程选择、反思记录、练习结果、沟通卡和界面偏好只保存在当前设备，不会发送到 CAVE 自有服务器；开发预览环境可能使用临时内存存储。",
      "CAVE 不把这些内容用于广告、画像或行为分析。",
      "只有在你主动操作时，沟通卡图片才会进入系统相册，文字才会进入系统剪贴板。",
      "设备备份、相册同步和剪贴板由 Apple 与你的设备设置控制。",
      "设备被解锁或你导出内容后，他人可能通过系统功能看到相关内容；CAVE 不承诺绝对私密。"
    ]);
  });

  it("keeps the approved support FAQ and excludes forbidden exact phrases", () => {
    expect(supportFaq).toEqual([
      ["使用 CAVE 需要账号吗？", "不需要。首版可以直接使用，不创建远程账号。"],
      ["内容会自动发给别人吗？", "不会。预览、保存或复制都不等于发送，分享必须由你主动完成。"],
      ["怎样删除本机数据？", "在 App 的“设置”中选择“删除全部本机数据”，再次确认后完成清除。"],
      ["卸载等于删除吗？", "卸载行为由 iOS 管理。需要确定清除 CAVE 管理的数据时，请先使用 App 内的删除功能。"],
      ["为什么只面向成年人？", "当前内容和情境仅为 18 岁及以上成年人设计。"]
    ]);

    expect(
      JSON.stringify({ experienceSteps, navItems, principles, privacyPoints, site, supportFaq })
    ).not.toMatch(/AI|云同步|准备度分数|本机加密数据库/u);
  });
});
