#!/usr/bin/env tsx
/**
 * eSIM 주문 환불(운영) — 주문번호 또는 order_id
 *
 *   npx tsx scripts/ops-refund-esim-order.ts BS-20260609-DF1C7205
 *   npx tsx scripts/ops-refund-esim-order.ts BS-20260609-DF1C7205 --tid WPC...  # 결제 콜백 누락 복구 후 환불
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";

register(pathToFileURL(join(process.cwd(), "scripts/stub-server-only.mjs")).href);

if (existsSync(".env.local")) loadDotenv({ path: ".env.local", override: true });
else if (existsSync(".env")) loadDotenv({ path: ".env", override: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim() || undefined;
}

const ORDER_KEY =
  process.argv
    .slice(2)
    .find((a) => !a.startsWith("-") && !a.endsWith(".ts") && !a.includes("node.exe")) ?? "";
const TID_OVERRIDE = arg("--tid");

async function pgClient() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL 없음");
  const c = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/gi, "") });
  await c.connect();
  return c;
}

async function recoverCaptureIfNeeded(
  c: Client,
  order: {
    order_id: string;
    status: string;
    grand_total_krw: string;
    payment_attempt_id: string | null;
  },
  tid: string,
) {
  if (order.status !== "awaiting_payment") return;
  const grand = Number.parseInt(order.grand_total_krw, 10);
  const { processWelcomepayPaymentOutcome } = await import("../lib/bongsim/data/process-welcomepay-payment-outcome");
  if (!order.payment_attempt_id) throw new Error("payment_attempt 없음 — 캡처 복구 불가");
  const fin = await processWelcomepayPaymentOutcome({
    providerEventId: `ops_recover_${tid}`,
    paymentAttemptId: order.payment_attempt_id,
    outcome: "captured",
    amountKrw: grand,
    paymentReference: tid,
    rawPayload: { ops_recover: true, tid },
  });
  if (!fin.ok) throw new Error(`캡처 복구 실패: ${JSON.stringify(fin)}`);
  console.log("[recover] paid 상태 반영:", tid);
}

async function main() {
  const key = (ORDER_KEY || arg("--order") || "").trim();
  if (!key) {
    console.error("Usage: npx tsx scripts/ops-refund-esim-order.ts <order_number|order_id> [--tid TID]");
    process.exit(1);
  }

  const c = await pgClient();
  const isUuid = /^[0-9a-f-]{36}$/i.test(key);
  const o = await c.query<{
    order_id: string;
    order_number: string;
    status: string;
    grand_total_krw: string;
    payment_reference: string | null;
    payment_provider: string | null;
  }>(
    isUuid
      ? `SELECT order_id::text, order_number, status, grand_total_krw::text, payment_reference, payment_provider
         FROM bongsim_order WHERE order_id = $1::uuid`
      : `SELECT order_id::text, order_number, status, grand_total_krw::text, payment_reference, payment_provider
         FROM bongsim_order WHERE order_number ILIKE $1`,
    [isUuid ? key : key],
  );
  const order = o.rows[0];
  if (!order) {
    console.error("주문 없음:", key);
    process.exit(1);
  }

  const att = await c.query<{ payment_attempt_id: string }>(
    `SELECT payment_attempt_id::text FROM bongsim_payment_attempt
     WHERE order_id = $1::uuid AND provider = 'welcomepay' ORDER BY created_at DESC LIMIT 1`,
    [order.order_id],
  );

  const tops = await c.query(
    `SELECT topup_id, status, iccid FROM bongsim_fulfillment_topup WHERE order_id = $1::uuid`,
    [order.order_id],
  );

  console.log("주문:", order);
  console.log("topups:", tops.rows);

  const { getRefundEligibility } = await import("../lib/bongsim/refund/refund-eligibility");
  const { checkUsimsaOrderDataUsageForRefund } = await import("../lib/bongsim/refund/usimsa-refund-usage");

  if (order.status === "awaiting_payment" && TID_OVERRIDE) {
    await recoverCaptureIfNeeded(
      c,
      {
        order_id: order.order_id,
        status: order.status,
        grand_total_krw: order.grand_total_krw,
        payment_attempt_id: att.rows[0]?.payment_attempt_id ?? null,
      },
      TID_OVERRIDE,
    );
    const refreshed = await c.query(
      `SELECT status, payment_reference FROM bongsim_order WHERE order_id = $1::uuid`,
      [order.order_id],
    );
    Object.assign(order, refreshed.rows[0]);
  }

  const elig = await getRefundEligibility(order.order_id);
  console.log("환불 가능:", elig);
  const usage = await checkUsimsaOrderDataUsageForRefund(order.order_id);
  console.log("사용량:", usage);

  if (!elig.eligible) {
    if (order.status === "awaiting_payment") {
      console.error(
        "\n결제 미확정 주문입니다. PG에서 승인됐다면 가맹점 콘솔 TID 확인 후:\n" +
          `  npx tsx scripts/ops-refund-esim-order.ts ${order.order_number} --tid <승인TID>`,
      );
    }
    process.exit(1);
  }

  const { processRefund } = await import("../lib/bongsim/refund/process-refund");
  const result = await processRefund(order.order_id, `운영 환불 ${order.order_number}`, {
    kind: "admin",
    id: "ops-refund-esim-order",
  });
  console.log("환불 결과:", result);

  const after = await c.query(
    `SELECT status FROM bongsim_order WHERE order_id = $1::uuid`,
    [order.order_id],
  );
  const topsAfter = await c.query(
    `SELECT topup_id, status, canceled_at FROM bongsim_fulfillment_topup WHERE order_id = $1::uuid`,
    [order.order_id],
  );
  console.log("환불 후 주문:", after.rows[0]);
  console.log("환불 후 topup:", topsAfter.rows);

  await c.end();
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
