#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { getPgPool, probePgPoolTlsOrFallback } from "../lib/bongsim/db/pool";

if (existsSync(".env.local")) config({ path: ".env.local", override: true });

const ORDER_ID = "bf2efd5d-d0ad-49a7-9e58-7ed2e79e6fbe";

async function main() {
  await probePgPoolTlsOrFallback();
  const pool = getPgPool()!;
  const r = await pool.query<{ payload_json: unknown; processed_at: Date }>(
    `SELECT payload_json, processed_at FROM bongsim_payment_provider_event
      WHERE order_id = $1::uuid AND provider = 'welcomepay'
      ORDER BY processed_at ASC`,
    [ORDER_ID],
  );
  for (const row of r.rows) {
    const p = row.payload_json as Record<string, unknown>;
    const dir = p?.direction ?? p?.outcome ?? "?";
    console.log(row.processed_at.toISOString(), dir);
    const resp = p?.response ?? p?.parsed;
    console.log("---", dir);
    if (resp && typeof resp === "object") {
      const o = resp as Record<string, unknown>;
      for (const k of ["mid", "MID", "tid", "TID", "MOID", "resultCode", "ResultCode"]) {
        if (o[k] != null) console.log(`  ${k}:`, o[k]);
      }
    }
    if (dir === "?") console.log(JSON.stringify(p).slice(0, 400));
  }
}

main();
