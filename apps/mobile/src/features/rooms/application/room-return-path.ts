import { isRoomScenarioId, normalizeInviteToken } from "../domain/room";

export function roomReturnPath(value: unknown): string | null {
  if (value === "/(tabs)/rooms" || value === "/join") return value;
  if (typeof value !== "string") return null;
  const join = /^\/join\?invite=([^&]+)$/u.exec(value);
  if (join) {
    try {
      const token = normalizeInviteToken(decodeURIComponent(join[1]!));
      return token ? `/join?invite=${encodeURIComponent(token)}` : null;
    } catch { return null; }
  }
  const start = /^\/rooms\/start\?scenario=([^&]+)$/u.exec(value);
  if (start && isRoomScenarioId(start[1])) return value;
  const detail = /^\/rooms\/([A-Za-z0-9_-]{1,80})$/u.exec(value);
  if (detail) return value;
  return null;
}
