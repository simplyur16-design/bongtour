#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { getPgPool, probePgPoolTlsOrFallback } from "../lib/bongsim/db/pool";

if (existsSync(".env.local")) config({ path: ".env.local", override: true });

const ORDER_ID = "bf2efd5d-d0ad-49a7-9e58-7ed2e79e6fbe";

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

async function tryCancelV1(
  base: string,
  signKey: string,
  mid: string,
  tid: string,
  priceKrw: number,
  clientIp: string,
) {
  const timestamp = tsKst();
  const type = "Refund";
  const paymethod = "Card";
  const plain = signKey + type + paymethod + timestamp + clientIp + mid + tid;
  const hashData = createHash("sha512").update(plain, "utf8").digest("hex");
  const body = new URLSearchParams({
    type,
    paymethod,
    clientIp,
    mid,
    tid,
    msg: "cancel test",
    price: String(priceKrw),
    timestamp,
    hashData,
  });
  const res = await fetch(`${base}/api/v1/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });
  return { http: res.status, raw: (await res.text()).slice(0, 240) };
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
  const signKey = (process.env.WELCOMEPAY_INIAPI_KEY ?? "").trim();
  const tid = (row?.payment_reference ?? "").trim();
  const price = Number.parseInt(row?.grand_total_krw ?? "0", 10);
  const clientIp = (process.env.WELCOMEPAY_CANCEL_CLIENT_IP ?? "0.0.0.0").trim() || "0.0.0.0";

  console.log({ mid, tid: tid.slice(0, 24) + "…", price, signKeyLen: signKey.length, iv: (process.env.WELCOMEPAY_FIELD_ENCRYPT_IV ?? "").trim() });

  for (const [label, base] of [
    ["production", "https://iniapi.inicis.com"],
    ["staging", "https://stginiapi.inicis.com"],
  ] as const) {
    console.log(`\n[${label}]`, await tryCancelV1(base, signKey, mid, tid, price, clientIp));
  }
}

main();
