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
    `SELECT payload_json, processed_at
       FROM bongsim_payment_provider_event
      WHERE order_id = $1::uuid AND payload_json->>'direction' = 'outbound_refund'
      ORDER BY processed_at DESC LIMIT 1`,
    [ORDER_ID],
  );
  const p = r.rows[0]?.payload_json as Record<string, unknown> | undefined;
  console.log(JSON.stringify({ processed_at: r.rows[0]?.processed_at, response: p?.response, resultMsg: (p?.response as Record<string, unknown>)?.resultMsg }, null, 2));
}

main();
