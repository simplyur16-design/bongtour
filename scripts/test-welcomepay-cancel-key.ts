#!/usr/bin/env tsx
/** PAYAPI 전체취소 스모크 — `server-only` 모듈 import 없이 스크립트 단독 실행 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { getPgPool, probePgPoolTlsOrFallback } from "../lib/bongsim/db/pool";

if (existsSync(".env.local")) config({ path: ".env.local", override: true });

const ORDER_ID = process.env.WELCOMEPAY_CANCEL_TEST_ORDER_ID?.trim() || "bf2efd5d-d0ad-49a7-9e58-7ed2e79e6fbe";

function resolveEnv(): "production" | "test" {
  const raw = (process.env.WELCOMEPAY_ENV ?? "test").trim().toLowerCase();
  if (raw === "production" || raw === "prod" || raw === "live") return "production";
  return "test";
}

function cancelUrl(): string {
  const base =
    resolveEnv() === "production"
      ? "https://payapi.paywelcome.co.kr"
      : "https://tpayapi.paywelcome.co.kr";
  return `${base}/cancel/cancel`;
}

function tsKst(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .replace(/[-\s:]/g, "");
}

function mkey(signKey: string): string {
  return createHash("sha256").update(signKey, "utf8").digest("hex");
}

function signature(mid: string, mk: string, timestamp: string): string {
  const plain = `mid=${mid.trim()}&mkey=${mk}&timestamp=${timestamp}`;
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

async function main() {
  await probePgPoolTlsOrFallback();
  const pool = getPgPool()!;
  const o = await pool.query<{ payment_reference: string; grand_total_krw: string }>(
    `SELECT payment_reference, grand_total_krw::text FROM bongsim_order WHERE order_id = $1::uuid`,
    [ORDER_ID],
  );
  const row = o.rows[0];
  const mid = (process.env.WELCOMEPAY_MID ?? "").trim();
  const signKey = (process.env.WELCOMEPAY_SIGN_KEY ?? "").trim();
  const tid = (row?.payment_reference ?? "").trim();
  const price = Number.parseInt(row?.grand_total_krw ?? "0", 10);

  console.log({
    url: cancelUrl(),
    mid,
    tid: tid ? `${tid.slice(0, 24)}…` : "(empty)",
    price,
    signKeyLen: signKey.length,
    env: process.env.WELCOMEPAY_ENV ?? "test",
  });

  if (!mid || !signKey || !tid || price <= 0) {
    console.error("missing mid, WELCOMEPAY_SIGN_KEY, tid, or price");
    process.exit(1);
  }

  const timestamp = tsKst();
  const mk = mkey(signKey);
  const sig = signature(mid, mk, timestamp);
  const body = new URLSearchParams({
    payType: "card",
    mid,
    tid,
    price: String(price),
    currency: "WON",
    timestamp,
    signature: sig,
  });

  const res = await fetch(cancelUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });
  const raw = await res.text();
  console.log({ http: res.status, raw: raw.slice(0, 400) });
}

main();
