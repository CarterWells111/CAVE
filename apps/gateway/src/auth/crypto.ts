const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function bytesToBase64Url(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const bits = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += BASE64URL_ALPHABET[(bits >>> 18) & 63];
    output += BASE64URL_ALPHABET[(bits >>> 12) & 63];
    if (second !== undefined) output += BASE64URL_ALPHABET[(bits >>> 6) & 63];
    if (third !== undefined) output += BASE64URL_ALPHABET[bits & 63];
  }
  return output;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function secureBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function normalizeEmail(input: string): string {
  const normalized = input.trim().normalize("NFC").toLowerCase();
  const control = Array.from(normalized).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });
  const parts = normalized.split("@");
  if (
    normalized.length < 3
    || normalized.length > 254
    || control
    || parts.length !== 2
    || parts[0]?.length === 0
    || !parts[1]?.includes(".")
  ) {
    throw new Error("invalid-email");
  }
  return normalized;
}

export function createNumericCode(
  random = () => crypto.getRandomValues(new Uint32Array(1)),
): string {
  const value = random()[0];
  if (value === undefined) throw new Error("secure-random-unavailable");
  return String(value % 1_000_000).padStart(6, "0");
}

const TOKEN_PREFIX = {
  access: "cave_at_",
  refresh: "cave_rt_",
  deletionGrant: "cave_dg_",
} as const;

export function createOpaqueToken(
  kind: keyof typeof TOKEN_PREFIX,
  random = secureBytes,
): string {
  const value = random(32);
  if (value.byteLength !== 32) throw new Error("secure-random-length");
  return `${TOKEN_PREFIX[kind]}${bytesToBase64Url(value)}`;
}

export async function digestOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export async function digestLowEntropySecret(key: string, value: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", material, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function secureEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
