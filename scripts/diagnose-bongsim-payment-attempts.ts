#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local" });

const nums = process.argv.slice(2);
if (!nums.length) {
  console.error("Usage: npx tsx scripts/diagnose-bongsim-payment-attempts.ts <order_number>...");
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) process.exit(1);
  const c = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/gi, "") });
  await c.connect();
  const r = await c.query(
    `SELECT o.order_number, o.status AS order_status, pa.status AS attempt_status,
            o.payment_reference, o.paid_amount_krw::text, pa.updated_at
     FROM bongsim_payment_attempt pa
     JOIN bongsim_order o ON o.order_id = pa.order_id
     WHERE o.order_number = ANY($1::text[]) AND pa.provider = 'welcomepay'
     ORDER BY pa.updated_at DESC`,
    [nums],
  );
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
}

main();
