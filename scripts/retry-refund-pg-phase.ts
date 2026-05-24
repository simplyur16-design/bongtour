#!/usr/bin/env tsx
/**
 * refund_requested 주문 — PG(3단계)만 재시도. signKey 원본·base64 디코드 둘 다 시도.
 */
import { existsSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";

register(pathToFileURL(join(process.cwd(), "scripts/stub-server-only.mjs")).href);
if (existsSync(".env.local")) config({ path: ".env.local", override: true });

const ORDER_IDS = [
  "bf2efd5d-d0ad-49a7-9e58-7ed2e79e6fbe",
  "0365d407-002f-4f81-a6b8-4d8a338d1cbb",
  "436b891d-e5d1-470c-93ba-62456de28269",
  "b1a794fa-8190-461b-a89e-f81a121d7489",
  "e9e6259b-96ba-457f-892c-3a04a498efc3",
];

function signKeyCandidates(raw: string): string[] {
  const t = raw.trim();
  const out = [t];
  try {
    const decoded = Buffer.from(t, "base64").toString("utf8").trim();
    if (decoded && decoded !== t && !out.includes(decoded)) out.push(decoded);
  } catch {
    /* ignore */
  }
  return out;
}

async function main() {
  const { getPgPool, probePgPoolTlsOrFallback } = await import("../lib/bongsim/db/pool");
  const { processRefund } = await import("../lib/bongsim/refund/process-refund");

  await probePgPoolTlsOrFallback();
  const rawKey = (process.env.WELCOMEPAY_SIGN_KEY ?? "").trim();
  const mid = (process.env.WELCOMEPAY_MID ?? "").trim();
  if (!rawKey || !mid) {
    console.error("WELCOMEPAY env missing");
    process.exit(1);
  }

  const keys = signKeyCandidates(rawKey);
  console.log("[signKey candidates]", keys.length, "variants (values hidden)");

  for (let ki = 0; ki < keys.length; ki++) {
    process.env.WELCOMEPAY_SIGN_KEY = keys[ki]!;
    console.log(`\n=== try variant ${ki + 1}/${keys.length} ===`);
    let allOk = true;
    for (const orderId of ORDER_IDS) {
      const pool = getPgPool()!;
      const meta = await pool.query<{ order_number: string; status: string }>(
        `SELECT order_number, status FROM bongsim_order WHERE order_id = $1::uuid`,
        [orderId],
      );
      const row = meta.rows[0];
      if (row?.status === "refunded") {
        console.log(`  skip ${row.order_number} already refunded`);
        continue;
      }
      const result = await processRefund(orderId, "PG 3단계 재시도", { kind: "admin", id: "retry-pg-script" });
      console.log(`  ${row?.order_number ?? orderId}:`, result);
      if (!result.ok) allOk = false;
    }
    if (allOk) {
      console.log("\nAll refunds completed.");
      process.exit(0);
    }
  }

  console.error("\nAll signKey variants failed PG cancel.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
