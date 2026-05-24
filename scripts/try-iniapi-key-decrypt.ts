#!/usr/bin/env tsx
/** 필드암호화 IV로 API KEY 복호 시도 → INIAPI hash 키 후보 */
import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { config } from "dotenv";

if (existsSync(".env.local")) config({ path: ".env.local", override: true });

const apiKeyHex = (process.env.WELCOMEPAY_INIAPI_KEY ?? "").trim();
const ivHex = (process.env.WELCOMEPAY_FIELD_ENCRYPT_IV ?? "").trim();
const signRaw = (process.env.WELCOMEPAY_SIGN_KEY ?? "").trim();

function keyCandidates(): Buffer[] {
  const out: Buffer[] = [];
  const add = (b: Buffer) => {
    if (b.length >= 16 && !out.some((x) => x.equals(b.slice(0, 16)))) out.push(b.slice(0, 16));
  };
  add(Buffer.from(signRaw, "utf8"));
  try {
    add(Buffer.from(signRaw, "base64"));
  } catch {
    /* */
  }
  try {
    add(Buffer.from(Buffer.from(signRaw, "base64").toString("utf8"), "utf8"));
  } catch {
    /* */
  }
  add(createHash("sha256").update(signRaw, "utf8").digest());
  add(createHash("md5").update(signRaw, "utf8").digest());
  return out;
}

function tryDecrypt(key: Buffer, iv: Buffer, ct: Buffer): string | null {
  try {
    const d = createDecipheriv("aes-128-cbc", key.slice(0, 16), iv.slice(0, 16));
    const p = Buffer.concat([d.update(ct), d.final()]);
    const s = p.toString("utf8").trim();
    if (s && /^[\x20-\x7e]+$/.test(s)) return s;
  } catch {
    /* */
  }
  return null;
}

function ivVariants(): Buffer[] {
  const hex = Buffer.from(ivHex, "hex");
  const utf = Buffer.from(ivHex, "utf8");
  return [
    hex,
    Buffer.concat([hex, hex]),
    Buffer.alloc(16, 0).fill(hex, 0, Math.min(16, hex.length)),
    utf.length >= 16 ? utf.slice(0, 16) : Buffer.concat([utf, Buffer.alloc(16 - utf.length, 0)]),
  ];
}

async function main() {
  const ct = Buffer.from(apiKeyHex, "hex");
  console.log({ apiKeyHexLen: apiKeyHex.length, ctLen: ct.length });

  for (const iv of ivVariants()) {
    for (let i = 0; i < keyCandidates().length; i++) {
      const plain = tryDecrypt(keyCandidates()[i]!, iv, ct);
      if (plain) console.log(`ok iv=${iv.length}b key#${i + 1} plainLen=${plain.length}`);
    }
  }
}

main();
