import { digestOpaqueToken } from "../auth/crypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function hexBytes(hex: string): Uint8Array {
  if (!/^[a-fA-F0-9]{64}$/u.test(hex)) throw new Error("room-encryption-key-invalid");
  return Uint8Array.from(hex.match(/.{2}/gu) ?? [], pair => Number.parseInt(pair, 16));
}

export function newInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `cave_ri_${btoa(String.fromCharCode(...bytes)).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "")}`;
}

export function newRoomId(): string { return crypto.randomUUID(); }
export { digestOpaqueToken };

export function createRoomCipher(secret: string) {
  const keyPromise = crypto.subtle.importKey("raw", hexBytes(secret), "AES-GCM", false, ["encrypt", "decrypt"]);
  return {
    async encrypt(roomId: string, field: string, value: unknown): Promise<string> {
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: encoder.encode(`${roomId}:${field}`) }, await keyPromise, encoder.encode(JSON.stringify(value))));
      return btoa(String.fromCharCode(...nonce, ...ciphertext));
    },
    async decrypt(roomId: string, field: string, sealed: string): Promise<unknown> {
      const bytes = Uint8Array.from(atob(sealed), char => char.charCodeAt(0));
      if (bytes.length < 29) throw new Error("room-ciphertext-invalid");
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: encoder.encode(`${roomId}:${field}`) }, await keyPromise, bytes.slice(12));
      return JSON.parse(decoder.decode(plaintext)) as unknown;
    },
  };
}
export type RoomCipher = ReturnType<typeof createRoomCipher>;
