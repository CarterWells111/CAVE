import type { Href, Router } from "expo-router";

export function backOrHome(router: Pick<Router, "back" | "canGoBack" | "replace">): void {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

// Convert untrusted deep-link input into concrete, typed local destinations.
export function journalReturnDestination(value: unknown): Href | null {
  if (typeof value !== "string" || !/^\/journal(?:[/?]|$)/u.test(value) || /[\\#]/u.test(value)) return null;
  const [path = "", query = ""] = value.split("?");
  let segments: string[];
  try { segments = path.split("/").slice(2).map(decodeURIComponent); } catch { return null; }
  if (segments.some((part) => !part || part === "." || part === ".." || /[/\\?#]/u.test(part))) return null;
  const search = new URLSearchParams(query);
  const params: Record<string, string> = {};
  for (const name of ["cardId", "reviewId"]) {
    const item = search.get(name);
    if (item) params[name] = item;
  }
  const source = Object.keys(params).length ? { params } : {};
  if (segments.length === 0) return { pathname: "/(tabs)/journal", ...source };
  const [id, action, entryId] = segments;
  if (segments.length === 1) {
    if (id === "new") return { pathname: "/journal/new", ...source };
    if (id === "review") return { pathname: "/journal/review", ...source };
    return { pathname: "/journal/[id]", params: { ...params, id: id! } };
  }
  if (segments.length === 2 && action === "edit") return { pathname: "/journal/[id]/edit", params: { ...params, id: id! } };
  if (segments.length === 2 && action === "add") return { pathname: "/journal/[id]/add", params: { ...params, id: id! } };
  if (segments.length === 3 && action === "entry") return { pathname: "/journal/[id]/entry/[entryId]", params: { ...params, id: id!, entryId: entryId! } };
  return null;
}
