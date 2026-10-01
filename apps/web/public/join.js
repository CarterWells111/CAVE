/* global document, window */

const inviteFragment = /^#invite=([A-Za-z0-9._~-]{1,512})$/u;

export function inviteFromFragment(fragment) {
  return inviteFragment.exec(fragment)?.[1] ?? null;
}

export function appUrlForInvite(invite) {
  return `cave://join?invite=${encodeURIComponent(invite)}`;
}

if (typeof document !== "undefined") {
  const openButton = document.querySelector("[data-open-app]");
  const status = document.querySelector("[data-join-status]");
  const invite = inviteFromFragment(window.location.hash);

  // Keep the invitation out of the visible URL and this page's browser history entry.
  if (window.location.hash.startsWith("#invite=")) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  if (openButton && status && invite) {
    openButton.disabled = false;
    status.textContent = "邀请已就绪。准备好后，点击按钮打开内界 App。";
    openButton.addEventListener("click", () => {
      status.textContent = "如果 App 没有打开，请确认已安装内测版内界 App，并从原邀请链接重试。";
      window.location.assign(appUrlForInvite(invite));
    });
  } else if (status) {
    status.textContent = "未找到有效的内测邀请。请从收到的完整邀请链接重新打开此页面。";
  }
}
