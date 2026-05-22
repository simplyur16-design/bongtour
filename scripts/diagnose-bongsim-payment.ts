#!/usr/bin/env tsx
/**
 * 로컬 결제 실패 원인 점검 — DATABASE_URL(.env.local) 기준
 * npx tsx scripts/diagnose-bongsim-payment.ts
 */
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";
import { probePgPoolTlsOrFallback } from "../lib/bongsim/db/pool";
import { processWelcomepayPaymentOutcome } from "../lib/bongsim/data/process-welcomepay-payment-outcome";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local" });
else if (existsSync(".env")) loadDotenv({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL 없음");
    process.exit(1);
  }

  const c = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/gi, "") });
  await c.connect();

  const cols = await c.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bongsim_order'
     ORDER BY ordinal_position`,
  );
  const names = new Set(cols.rows.map((r) => r.column_name));
  const required = ["paid_at", "payment_reference", "paid_amount_krw", "payment_provider"];
  console.log("\n[bongsim_order 컬럼]");
  for (const col of required) {
    console.log(`  ${col}: ${names.has(col) ? "OK" : "MISSING"}`);
  }

  const recent = await c.query<{
    order_number: string;
    status: string;
    grand_total_krw: string;
    created_at: Date;
  }>(
    `SELECT order_number, status, grand_total_krw::text, created_at
     FROM bongsim_order
     ORDER BY created_at DESC
     LIMIT 5`,
  );
  console.log("\n[최근 주문 5건]");
  for (const r of recent.rows) {
    console.log(`  ${r.order_number}  status=${r.status}  total=${r.grand_total_krw}  at=${r.created_at.toISOString()}`);
  }

  const attempts = await c.query<{
    order_number: string;
    status: string;
    provider: string;
    last_error: unknown;
    updated_at: Date;
  }>(
    `SELECT o.order_number, pa.status, pa.provider, pa.last_error, pa.updated_at
     FROM bongsim_payment_attempt pa
     JOIN bongsim_order o ON o.order_id = pa.order_id
     ORDER BY pa.updated_at DESC
     LIMIT 5`,
  );
  console.log("\n[최근 결제 시도 5건]");
  for (const r of attempts.rows) {
    const err =
      r.last_error && typeof r.last_error === "object"
        ? JSON.stringify(r.last_error)
        : r.last_error
          ? String(r.last_error)
          : "";
    console.log(`  ${r.order_number}  ${r.provider}/${r.status}  err=${err || "—"}`);
  }

  const welcomepayEnv = {
    WELCOMEPAY_MID: Boolean((process.env.WELCOMEPAY_MID ?? "").trim()),
    WELCOMEPAY_SIGN_KEY: Boolean((process.env.WELCOMEPAY_SIGN_KEY ?? "").trim()),
    WELCOMEPAY_ENV: (process.env.WELCOMEPAY_ENV ?? "(unset)").trim(),
    NEXT_PUBLIC_SITE_URL: (process.env.NEXT_PUBLIC_SITE_URL ?? "(unset)").trim(),
    NEXTAUTH_URL: (process.env.NEXTAUTH_URL ?? "(unset)").trim(),
  };
  console.log("\n[PG·사이트 env]");
  for (const [k, v] of Object.entries(welcomepayEnv)) {
    console.log(`  ${k}: ${typeof v === "boolean" ? (v ? "set" : "MISSING") : v}`);
  }

  const tables = [
    "bongsim_payment_provider_event",
    "bongsim_outbox",
    "bongsim_coupon_usage",
    "bongsim_coupon",
  ];
  console.log("\n[관련 테이블 존재]");
  for (const t of tables) {
    const r = await c.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS ok`,
      [t],
    );
    console.log(`  ${t}: ${r.rows[0]?.ok ? "OK" : "MISSING"}`);
  }

  const sample = recent.rows[0];
  if (sample) {
    const att = await c.query<{ payment_attempt_id: string; provider_session_id: string | null }>(
      `SELECT payment_attempt_id, provider_session_id
       FROM bongsim_payment_attempt pa
       JOIN bongsim_order o ON o.order_id = pa.order_id
       WHERE o.order_number = $1 AND pa.provider = 'welcomepay'
       ORDER BY pa.updated_at DESC LIMIT 1`,
      [sample.order_number],
    );
    const row = att.rows[0];
    if (row) {
      console.log("\n[캡처 UPDATE 시뮬레이션 — 트랜잭션 롤백]");
      try {
        await c.query("BEGIN");
        await c.query(
          `UPDATE bongsim_order
           SET status = 'paid', paid_at = now(), payment_reference = 'diag_test',
               paid_amount_krw = grand_total_krw, payment_provider = 'welcomepay', updated_at = now()
           WHERE order_number = $1 AND status = 'awaiting_payment'`,
          [sample.order_number],
        );
        await c.query("ROLLBACK");
        console.log("  paid 상태 UPDATE: OK (롤백함)");
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        console.log("  paid 상태 UPDATE: FAIL", e instanceof Error ? e.message : e);
      }

      const tls = await probePgPoolTlsOrFallback();
      console.log("\n[pg pool TLS probe]", tls);

      const beforePaid = await c.query<{ status: string }>(
        `SELECT status FROM bongsim_order WHERE order_number = $1`,
        [sample.order_number],
      );
      const statusBefore = beforePaid.rows[0]?.status ?? "";
      if (statusBefore === "paid" || statusBefore === "delivered" || statusBefore === "refunded") {
        console.log(
          "\n[processWelcomepayPaymentOutcome 테스트 캡처]",
          sample.order_number,
          "— 스킵 (이미",
          statusBefore,
          ", 되돌리기 방지)",
        );
      } else {
        const grand = Number.parseInt(sample.grand_total_krw, 10);
        console.log("\n[processWelcomepayPaymentOutcome 테스트 캡처]", sample.order_number);
        const fin = await processWelcomepayPaymentOutcome({
          providerEventId: `diag_${Date.now()}`,
          paymentAttemptId: row.payment_attempt_id,
          outcome: "captured",
          amountKrw: grand,
          paymentReference: "diag_test",
          rawPayload: { diag: true },
        });
        console.log("  결과:", JSON.stringify(fin));
        const after = await c.query<{ status: string }>(
          `SELECT status FROM bongsim_order WHERE order_number = $1`,
          [sample.order_number],
        );
        console.log("  주문 상태:", after.rows[0]?.status ?? "—");
        if (fin.ok && statusBefore === "awaiting_payment") {
          await c.query(
            `UPDATE bongsim_order SET status = 'awaiting_payment', paid_at = NULL,
             payment_reference = NULL, paid_amount_krw = NULL, payment_provider = NULL
             WHERE order_number = $1`,
            [sample.order_number],
          );
          await c.query(
            `UPDATE bongsim_payment_attempt SET status = 'redirected', last_error = NULL
             WHERE payment_attempt_id = $1`,
            [row.payment_attempt_id],
          );
          console.log("  (진단 후 awaiting_payment 로 되돌림)");
        }
      }
    }
  }

  console.log(
    "\n[로컬 결제 콜백 URL (welcomepayCheckoutCallbackOrigin 폴백)]",
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      "http://localhost:3000",
  );
  console.log(
    "  → NEXTAUTH_URL이 https://bongtour.com 이면 PG 승인 POST는 운영 도메인으로 갑니다. 로컬 npm run dev만 켜두면 콜백이 로컬에 안 옵니다.",
  );

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
