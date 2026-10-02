import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const virtualStore = join(import.meta.dirname, "..", "node_modules", ".pnpm");
const packageDirectory = readdirSync(virtualStore).find(
  (name) => name.startsWith("node-forge@1.4.0") && name.includes("patch_hash"),
);

if (!packageDirectory) throw new Error("patched node-forge@1.4.0 is not installed");

const requireForge = createRequire(join(
  virtualStore, packageDirectory, "node_modules", "node-forge", "package.json",
));
const forge = requireForge("node-forge");

describe("patched node-forge RSA verification", () => {
  it("accepts a valid DigestInfo and rejects an extra nested element", () => {
    const { publicKey, privateKey } = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
    const digest = forge.md.sha256.create().update("CAVE signing check").digest().getBytes();
    const { Class, Type } = forge.asn1;
    const item = (type: number, value: unknown, constructed = false) =>
      forge.asn1.create(Class.UNIVERSAL, type, constructed, value);
    const digestInfo = (extra: boolean) => forge.asn1.toDer(item(Type.SEQUENCE, [
      item(Type.SEQUENCE, [
        item(Type.OID, forge.asn1.oidToDer(forge.oids.sha256).getBytes()),
        item(Type.NULL, ""),
        ...(extra ? [item(Type.OCTETSTRING, "unconsumed garbage")] : []),
      ], true),
      item(Type.OCTETSTRING, digest),
    ], true)).getBytes();

    expect(publicKey.verify(digest, privateKey.sign(digestInfo(false), "NONE"))).toBe(true);
    expect(() => publicKey.verify(digest, privateKey.sign(digestInfo(true), "NONE")))
      .toThrow(/DigestInfo value/u);
  });
});
