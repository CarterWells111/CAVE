import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { appUrlForInvite, inviteFromFragment } from "../public/join.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("invite handoff", () => {
  it("accepts only one URL-safe opaque token in the fragment", () => {
    expect(inviteFromFragment("#invite=opaque-token_1.test~2")).toBe("opaque-token_1.test~2");
    expect(inviteFromFragment("#invite=")).toBeNull();
    expect(inviteFromFragment("#invite=one&invite=two")).toBeNull();
    expect(inviteFromFragment("#invite=one?next=https://elsewhere.example")).toBeNull();
    expect(inviteFromFragment("#other=opaque-token")).toBeNull();
  });

  it("passes the token to the native scheme as a single encoded parameter", () => {
    expect(appUrlForInvite("opaque-token_1.test~2")).toBe(
      "cave://join?invite=opaque-token_1.test~2"
    );
  });

  it("keeps the App unopened until the user clicks, then shows the installed-app fallback", async () => {
    const handlers = new Map<string, () => void>();
    const button = {
      disabled: true,
      addEventListener: vi.fn((name: string, handler: () => void) => handlers.set(name, handler))
    };
    const status = { textContent: "正在检查邀请链接…" };
    const assign = vi.fn();
    const replaceState = vi.fn();
    vi.stubGlobal("document", {
      querySelector: (selector: string) =>
        selector === "[data-open-app]" ? button : selector === "[data-join-status]" ? status : null
    });
    vi.stubGlobal("window", {
      location: { hash: "#invite=opaque-token", pathname: "/join/", search: "", assign },
      history: { replaceState }
    });

    await import("../public/join.js");

    expect(replaceState).toHaveBeenCalledWith(null, "", "/join/");
    expect(button.disabled).toBe(false);
    expect(assign).not.toHaveBeenCalled();
    expect(status.textContent).toContain("点击按钮");
    handlers.get("click")?.();
    expect(assign).toHaveBeenCalledExactlyOnceWith("cave://join?invite=opaque-token");
    expect(status.textContent).toContain("如果 App 没有打开");
  });

  it("does not enable the button or open the App without a valid token", async () => {
    const button = { disabled: true, addEventListener: vi.fn() };
    const status = { textContent: "正在检查邀请链接…" };
    const assign = vi.fn();
    vi.stubGlobal("document", {
      querySelector: (selector: string) =>
        selector === "[data-open-app]" ? button : selector === "[data-join-status]" ? status : null
    });
    vi.stubGlobal("window", {
      location: { hash: "#invite=bad&next=other", pathname: "/join/", search: "", assign },
      history: { replaceState: vi.fn() }
    });

    await import("../public/join.js");

    expect(button.disabled).toBe(true);
    expect(button.addEventListener).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(status.textContent).toContain("未找到有效的内测邀请");
  });

  it("publishes an explanation and only a local script on the join page", async () => {
    const [html, publishedScript] = await Promise.all([
      readFile(new URL("../dist/join/index.html", import.meta.url), "utf8"),
      readFile(new URL("../dist/join.js", import.meta.url), "utf8")
    ]);
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gu)];

    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.[1]).toBe("/join.js");
    expect(publishedScript).toContain("window.location.assign(appUrlForInvite(invite))");
    expect(publishedScript).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|console\./u);
    expect(html).toContain("data-open-app disabled");
    expect(html).toContain("双人异步演练");
    expect(html).toContain("双方都要自己授权");
    expect(html).toContain("只共享共同报告");
    expect(html).toContain("30 天后自动删除");
    expect(html).toContain("仅向受邀内测用户开放");
    expect(html).not.toMatch(/https?:\/\/[^"\s<]+\?invite=/u);
    expect(html).not.toMatch(/App\s*Store|Google\s*Play|应用商店/u);
  });
});
