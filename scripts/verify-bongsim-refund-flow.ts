#!/usr/bin/env tsx
/**
 * 봉심 환불 3단계 플로우 점검
 *   npx tsx scripts/verify-bongsim-refund-flow.ts
 *   npx tsx scripts/verify-bongsim-refund-flow.ts --order-id <uuid> --execute
 */
import "./load-env-for-scripts";
import { getPgPool, probePgPoolTlsOrFallback } from "../lib/bongsim/db/pool";
import type { Pool } from "pg";

const WELCOMEPAY_PROVIDER_ID = "welcomepay";

async function checkRefundEligible(
  pool: Pool,
  orderId: string,
): Promise<{ eligible: boolean; code?: string; message?: string }> {
  const r = await pool.query<{ status: string; payment_provider: string | null; payment_reference: string | null }>(
    `SELECT status, payment_provider, payment_reference FROM bongsim_order WHERE order_id = $1::uuid`,
    [orderId],
  );
  const o = r.rows[0];
  if (!o) return { eligible: false, code: "not_found", message: "주문 없음" };
  if (o.status === "refunded") return { eligible: false, code: "already_refunded" };
  if (o.status === "refund_requested") return { eligible: false, code: "refund_in_progress" };
  if (o.status !== "paid" && o.status !== "delivered") return { eligible: false, code: "invalid_status" };
  if ((o.payment_provider ?? "").trim() !== WELCOMEPAY_PROVIDER_ID) {
    return { eligible: false, code: "unsupported_provider" };
  }
  if (!(o.payment_reference ?? "").trim()) return { eligible: false, code: "missing_payment_reference" };
  const iccid = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM bongsim_fulfillment_topup t
       WHERE t.order_id = $1::uuid AND t.supplier_id = 'usimsa'
         AND t.iccid IS NOT NULL AND trim(t.iccid) <> ''
     ) AS ok`,
    [orderId],
  );
  if (iccid.rows[0]?.ok) return { eligible: false, code: "esim_activated" };
  return { eligible: true };
}

const REFUND_DIRECTIONS = [
  "refund_card_cancel_requested",
  "refund_supplier_applied",
  "outbound_refund",
] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim() || undefined;
}

const execute = process.argv.includes("--execute");
const orderIdArg = arg("--order-id");

async function auditRefundEvents(orderId: string) {
  const pool = getPgPool();
  if (!pool) return;
  const r = await pool.query<{
    direction: string | null;
    processed_at: Date;
    provider_event_id: string;
  }>(
    `SELECT payload_json->>'direction' AS direction, processed_at, provider_event_id
       FROM bongsim_payment_provider_event
      WHERE order_id = $1::uuid AND provider = $2
        AND payload_json->>'direction' = ANY($3::text[])
      ORDER BY processed_at ASC`,
    [orderId, WELCOMEPAY_PROVIDER_ID, REFUND_DIRECTIONS],
  );
  console.log(`\n[환불 이벤트] order_id=${orderId}`);
  if (r.rows.length === 0) {
    console.log("  (없음)");
    return;
  }
  for (const row of r.rows) {
    console.log(`  ${row.processed_at.toISOString()}  ${row.direction}  id=${row.provider_event_id.slice(0, 48)}…`);
  }
}

async function main() {
  const poolOk = await probePgPoolTlsOrFallback();
  if (!poolOk) {
    console.error("[verify-refund] DB 연결 실패 — DATABASE_URL 확인");
    process.exit(1);
  }
  const pool = getPgPool()!;

  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL?.trim()),
    WELCOMEPAY_MID: Boolean((process.env.WELCOMEPAY_MID ?? "").trim()),
    WELCOMEPAY_SIGN_KEY: Boolean((process.env.WELCOMEPAY_SIGN_KEY ?? "").trim()),
    USIMSA_ACCESS_KEY: Boolean((process.env.USIMSA_ACCESS_KEY ?? "").trim()),
    USIMSA_SECRET_KEY: Boolean((process.env.USIMSA_SECRET_KEY ?? "").trim()),
  };
  console.log("[환불 환경]", env);

  const stuck = await pool.query<{
    order_id: string;
    order_number: string;
    status: string;
  }>(
    `SELECT order_id::text, order_number, status
       FROM bongsim_order
      WHERE status = 'refund_requested'
      ORDER BY updated_at DESC
      LIMIT 10`,
  );
  console.log(`\n[refund_requested 주문] ${stuck.rows.length}건`);
  for (const o of stuck.rows) {
    console.log(`  ${o.order_number}  ${o.order_id}`);
    await auditRefundEvents(o.order_id);
  }

  const candidates = await pool.query<{
    order_id: string;
    order_number: string;
    status: string;
    grand_total_krw: string;
    topup_count: string;
    iccid_count: string;
  }>(
    `SELECT o.order_id::text, o.order_number, o.status, o.grand_total_krw::text,
            COUNT(t.topup_id)::text AS topup_count,
            COUNT(t.topup_id) FILTER (
              WHERE t.iccid IS NOT NULL AND trim(t.iccid) <> ''
            )::text AS iccid_count
       FROM bongsim_order o
       LEFT JOIN bongsim_fulfillment_topup t ON t.order_id = o.order_id AND t.supplier_id = 'usimsa'
      WHERE o.status IN ('paid', 'delivered')
        AND o.payment_provider = $1
        AND trim(COALESCE(o.payment_reference, '')) <> ''
      GROUP BY o.order_id, o.order_number, o.status, o.grand_total_krw
     HAVING COUNT(t.topup_id) FILTER (
              WHERE t.iccid IS NOT NULL AND trim(t.iccid) <> ''
            ) = 0
      ORDER BY o.updated_at DESC
      LIMIT 5`,
    [WELCOMEPAY_PROVIDER_ID],
  );

  console.log(`\n[환불 가능 후보 paid/delivered] ${candidates.rows.length}건 (최대 5)`);
  for (const o of candidates.rows) {
    const elig = await checkRefundEligible(pool, o.order_id);
    console.log(
      `  ${o.order_number}  id=${o.order_id}  ${o.status}  ${o.grand_total_krw}원  topups=${o.topup_count}  eligible=${elig.eligible ? "yes" : "no"}`,
    );
    if (!elig.eligible) console.log(`    → ${elig.code}: ${elig.message}`);
  }

  if (!orderIdArg) {
    if (!execute) {
      console.log("\n실제 환불 실행: --order-id <uuid> --execute");
      return;
    }
    console.error("\n--execute 는 --order-id 와 함께 사용하세요.");
    process.exit(1);
  }

  const elig = await checkRefundEligible(pool, orderIdArg);
  console.log(`\n[대상 주문] ${orderIdArg}`);
  console.log(`  eligibility:`, elig);

  if (!execute) {
    console.log("  (드라이런 — --execute 없음, processRefund 미호출)");
    await auditRefundEvents(orderIdArg);
    return;
  }

  if (!elig.eligible && elig.code !== "refund_in_progress") {
    console.error("  환불 불가 — 실행 중단");
    process.exit(1);
  }

  console.log("\n[processRefund 실행] server-only 의존 → 동적 import");
  const { processRefund } = await import("../lib/bongsim/refund/process-refund");
  const result = await processRefund(orderIdArg, "verify-bongsim-refund-flow script", {
    kind: "admin",
    id: "verify-script",
  });
  console.log("  result:", result);

  const after = await pool.query<{ status: string }>(
    `SELECT status FROM bongsim_order WHERE order_id = $1::uuid`,
    [orderIdArg],
  );
  console.log(`  order.status after: ${after.rows[0]?.status ?? "(missing)"}`);
  await auditRefundEvents(orderIdArg);

  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
