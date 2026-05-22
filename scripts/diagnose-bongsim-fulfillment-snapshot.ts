#!/usr/bin/env tsx
/** paid 주문의 fulfillment·outbox·알림 env 스냅샷 */
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local" });
else if (existsSync(".env")) loadDotenv({ path: ".env" });

const ORDER_NUMBERS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["BS-20260522-E78F8FB7", "BS-20260522-9312B2A2"];

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL 없음");
    process.exit(1);
  }
  const c = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/gi, "") });
  await c.connect();

  for (const n of ORDER_NUMBERS) {
    const o = await c.query<{
      order_id: string;
      status: string;
      paid_at: Date | null;
      payment_reference: string | null;
      buyer_tel: string | null;
      buyer_email: string | null;
    }>(
      `SELECT order_id, status, paid_at, payment_reference, buyer_tel, buyer_email
       FROM bongsim_order WHERE order_number = $1`,
      [n],
    );
    const row = o.rows[0];
    if (!row) {
      console.log(`\n=== ${n} === NOT FOUND`);
      continue;
    }
    console.log(`\n=== ${n} ===`);
    console.log("  status:", row.status, "paid_at:", row.paid_at?.toISOString() ?? "—");
    console.log("  TID:", row.payment_reference ?? "—");
    console.log("  buyer_tel:", row.buyer_tel ?? "—", "email:", row.buyer_email ?? "—");

    const jobs = await c.query(
      `SELECT job_id, status, supplier_id, last_error, created_at, updated_at
       FROM bongsim_fulfillment_job WHERE order_id = $1`,
      [row.order_id],
    );
    console.log("  fulfillment_job:", jobs.rows.length ? jobs.rows : "(없음)");

    const top = await c.query(
      `SELECT topup_id, status,
              (COALESCE(qr_code_img_url, '') <> '') AS has_qr,
              (COALESCE(download_link, '') <> '') AS has_dl
       FROM bongsim_fulfillment_topup WHERE order_id = $1`,
      [row.order_id],
    );
    console.log("  topup:", top.rows.length ? top.rows : "(없음 — QR 전)");

    const ob = await c.query(
      `SELECT id, topic, dedupe_key, available_at, locked_at, processed_at
       FROM bongsim_outbox
       WHERE payload::text LIKE '%' || $1 || '%'
       ORDER BY available_at DESC LIMIT 8`,
      [row.order_id],
    );
    console.log("  outbox:", ob.rows.length ? ob.rows : "(없음)");
  }

  console.log("\n[로컬 .env — 알림·공급사 (운영 호스팅과 별개)]");
  const flag = (k: string) => Boolean((process.env[k] ?? "").trim());
  console.log("  SOLAPI_API_KEY:", flag("SOLAPI_API_KEY"));
  console.log("  SOLAPI_API_SECRET:", flag("SOLAPI_API_SECRET"));
  console.log("  SOLAPI_TPL_ESIM_QR_DELIVERED:", flag("SOLAPI_TPL_ESIM_QR_DELIVERED"));
  console.log(
    "  SOLAPI_KAKAO_PFID:",
    flag("SOLAPI_KAKAO_PFID") || flag("SOLAPI_PFID"),
  );
  console.log(
    "  SMTP:",
    flag("SMTP_HOST") && flag("SMTP_USER") && flag("SMTP_PASS") && flag("SMTP_FROM_EMAIL"),
  );
  console.log(
    "  USIMSA keys:",
    flag("USIMSA_PROD_ACCESS_KEY") || flag("USIMSA_ACCESS_KEY"),
    flag("USIMSA_PROD_SECRET_KEY") || flag("USIMSA_SECRET_KEY"),
  );
  console.log("  BONGSIM_SUPPLIER_CLIENT_ID:", (process.env.BONGSIM_SUPPLIER_CLIENT_ID ?? "").trim() || "(unset)");
  console.log("  BONGSIM_CHECKOUT_TEST_MODE:", (process.env.BONGSIM_CHECKOUT_TEST_MODE ?? "").trim() || "(off)");

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
