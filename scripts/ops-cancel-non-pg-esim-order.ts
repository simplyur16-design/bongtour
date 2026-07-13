#!/usr/bin/env tsx
/**
 * 무상·오프라인 eSIM — 유심사 취소 + 주문 refunded (PG 없음, server-only 우회)
 *
 *   npx tsx scripts/ops-cancel-non-pg-esim-order.ts BS-20260713-A3C41D82
 *   npx tsx scripts/ops-cancel-non-pg-esim-order.ts 4a44a9c5-8cff-4f81-9913-62bf4ae748db
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";
import { createUsimsaSignature, createUsimsaTimestamp } from "../lib/usimsa/signature";
import { resolveSecretKey } from "../lib/usimsa/resolve-secret-key";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local", override: true });
else if (existsSync(".env")) loadDotenv({ path: ".env", override: true });

const KEY =
  process.argv.slice(2).find((a) => !a.startsWith("-") && !a.endsWith(".ts")) ?? "";
const reasonIdx = process.argv.indexOf("--reason");
const REASON =
  (reasonIdx >= 0 ? process.argv[reasonIdx + 1] : undefined)?.trim() ||
  "관리자 무상·오프라인 eSIM 취소";

function welcomepayEnv(): "production" | "test" {
  const raw = (process.env.WELCOMEPAY_ENV ?? "").trim().toLowerCase();
  if (raw === "production" || raw === "prod" || raw === "live") return "production";
  if (process.env.NODE_ENV === "production") return "production";
  return "production";
}

function resolveAccessKey(): string {
  const legacy = (process.env.USIMSA_ACCESS_KEY ?? "").trim();
  if (legacy) return legacy;
  const env = (process.env.USIMSA_ENV ?? "production").trim().toLowerCase();
  if (env === "production") return (process.env.USIMSA_PROD_ACCESS_KEY ?? "").trim();
  return (process.env.USIMSA_DEV_ACCESS_KEY ?? "").trim();
}

async function usimsaFetch(method: "GET" | "POST", path: string): Promise<Record<string, unknown>> {
  const accessKey = resolveAccessKey();
  if (!accessKey) throw new Error("USIMSA access key 없음 (ACCESS_KEY / PROD_ACCESS_KEY)");
  const runtime = welcomepayEnv() === "production" ? "production" : "development";
  const { secretKey } = resolveSecretKey(runtime);
  const host =
    runtime === "production" ? "https://open-api.usimsa.com" : "https://dev-open-api.usimsa.com";
  const pathAndQuery = `/api${path.startsWith("/") ? path : `/${path}`}`;
  const timestamp = createUsimsaTimestamp();
  const signature = createUsimsaSignature({
    method,
    pathAndQuery,
    timestamp,
    accessKey,
    secretKey,
  });
  const res = await fetch(`${host}${pathAndQuery}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-gat-access-key": accessKey,
      "x-gat-timestamp": timestamp,
      "x-gat-signature": signature,
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { code: "parse", message: text.slice(0, 200) };
  }
}

async function usimsaUsageMb(topupId: string): Promise<number> {
  const raw = await usimsaFetch("GET", `/v2/topup/${encodeURIComponent(topupId)}/usage/daily`);
  const usage = raw.usage;
  if (!usage || typeof usage !== "object") return 0;
  const history = (usage as { history?: unknown }).history;
  if (!Array.isArray(history)) return 0;
  let sum = 0;
  for (const row of history) {
    if (!row || typeof row !== "object") continue;
    const mb = Number.parseFloat(String((row as { usageMb?: unknown }).usageMb ?? "0"));
    if (Number.isFinite(mb)) sum += mb;
  }
  return sum;
}

async function main() {
  if (!KEY) {
    console.error("Usage: npx tsx scripts/ops-cancel-non-pg-esim-order.ts <order_id|order_number>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL?.trim()?.replace(/[?&]sslmode=[^&]*/gi, "") ?? "";
  if (!url) throw new Error("DATABASE_URL 없음");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  try {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(KEY.trim());
    const o = await c.query<{
      order_id: string;
      order_number: string;
      status: string;
      payment_provider: string | null;
    }>(
      isUuid
        ? `SELECT order_id::text, order_number, status, payment_provider
             FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`
        : `SELECT order_id::text, order_number, status, payment_provider
             FROM bongsim_order WHERE order_number = $1 LIMIT 1`,
      [KEY.trim()],
    );
    const order = o.rows[0];
    if (!order) throw new Error(`주문 없음: ${KEY}`);

    const provider = String(order.payment_provider ?? "");
    if (provider !== "complimentary" && provider !== "offline") {
      throw new Error(`비 PG 주문이 아님: provider=${provider}`);
    }
    if (order.status === "refunded" || order.status === "cancelled") {
      throw new Error(`이미 취소·환불됨: ${order.status}`);
    }
    if (order.status !== "paid" && order.status !== "delivered") {
      throw new Error(`취소 불가 상태: ${order.status}`);
    }

    console.log(`${order.order_number} | ${order.order_id} | ${order.status} | ${provider}`);

    const tops = await c.query<{ topup_id: string }>(
      `SELECT topup_id FROM bongsim_fulfillment_topup
        WHERE order_id = $1::uuid AND supplier_id = 'usimsa'
          AND status NOT IN ('canceled', 'failed')`,
      [order.order_id],
    );
    if (tops.rows.length === 0) throw new Error("취소할 topup 없음");

    const canceled: string[] = [];
    for (const t of tops.rows) {
      const mb = await usimsaUsageMb(t.topup_id);
      console.log(`  usage ${t.topup_id}: ${mb} MB`);
      if (mb > 0.01) throw new Error(`데이터 사용됨 (${mb} MB)`);
      const cancelRes = await usimsaFetch("POST", `/v2/cancel/${encodeURIComponent(t.topup_id)}`);
      const code = String(cancelRes.code ?? "");
      console.log("  usimsa cancel", t.topup_id, code, String(cancelRes.message ?? ""));
      if (code !== "0000" && code !== "9002") {
        throw new Error(`usimsa cancel failed code=${code}`);
      }
      await c.query(
        `UPDATE bongsim_fulfillment_topup
            SET status = 'canceled', canceled_at = COALESCE(canceled_at, now()), updated_at = now()
          WHERE topup_id = $1`,
        [t.topup_id],
      );
      canceled.push(t.topup_id);
    }

    await c.query("BEGIN");
    try {
      await c.query(`UPDATE bongsim_order SET status = 'refunded', updated_at = now() WHERE order_id = $1::uuid`, [
        order.order_id,
      ]);
      await c.query(
        `UPDATE bongsim_payment_attempt
            SET status = 'cancelled', updated_at = now()
          WHERE order_id = $1::uuid AND status = 'captured'`,
        [order.order_id],
      );
      const attempt = await c.query<{ payment_attempt_id: string }>(
        `SELECT payment_attempt_id::text FROM bongsim_payment_attempt
          WHERE order_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
        [order.order_id],
      );
      const eventId = `admin_non_pg_cancel_${order.order_id}_${Date.now()}_${randomBytes(4).toString("hex")}`;
      await c.query(
        `INSERT INTO bongsim_payment_provider_event (provider, provider_event_id, payment_attempt_id, order_id, payload_json)
         VALUES ($1, $2, $3::uuid, $4::uuid, $5::jsonb)
         ON CONFLICT (provider, provider_event_id) DO NOTHING`,
        [
          provider,
          eventId,
          attempt.rows[0]?.payment_attempt_id ?? null,
          order.order_id,
          JSON.stringify({
            direction: "admin_non_pg_esim_cancel",
            reason: REASON,
            admin_id: "ops-cli",
            topups: canceled,
          }),
        ],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }

    console.log(JSON.stringify({ ok: true, canceled_topup_ids: canceled }, null, 2));
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
