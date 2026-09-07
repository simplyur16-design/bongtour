/**
 * 결제는 됐는데 발급·이메일이 안 간 주문 복구 (OrderPaid outbox 재처리).
 *
 *   npx tsx scripts/reprocess-bongsim-order-fulfillment.ts <order_id>
 *   npx tsx scripts/reprocess-bongsim-order-fulfillment.ts --all-pending
 */
import Module from "node:module";
import { register } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";

register(pathToFileURL(join(process.cwd(), "scripts/stub-server-only.mjs")).href);
const load = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function (
  request: unknown,
  parent: unknown,
  isMain: unknown,
) {
  if (request === "server-only") return {};
  return load.call(this, request, parent, isMain);
};

config({ path: resolve(process.cwd(), ".env.local"), override: true });
config({ path: resolve(process.cwd(), ".env"), override: false });

async function main() {
  const { getPgPool, probePgPoolTlsOrFallback } = await import("../lib/bongsim/db/pool");
  const { drainOrderPaidOutboxBestEffort } = await import("../lib/bongsim/fulfillment/process-order-paid-outbox");
  const { maybeDeliverEsimAfterFulfillment } = await import("../lib/bongsim/fulfillment/esim-delivery");
  const { drainEsimQrNotifyOutboxBestEffort } = await import(
    "../lib/bongsim/fulfillment/esim-qr-notify-outbox"
  );
  await probePgPoolTlsOrFallback();
  const pool = getPgPool();
  if (!pool) {
    console.error("DATABASE_URL / PG pool not configured");
    process.exit(1);
  }

  const arg = process.argv[2]?.trim();
  if (!arg) {
    console.error("Usage: npx tsx scripts/reprocess-bongsim-order-fulfillment.ts <order_id|--all-pending>");
    process.exit(1);
  }

  if (arg === "--all-pending") {
    const ins = await pool.query(
      `INSERT INTO bongsim_outbox (topic, payload, dedupe_key)
       SELECT 'OrderPaid', jsonb_build_object('order_id', o.order_id), 'bongsim:order_paid:' || o.order_id::text
         FROM bongsim_order o
        WHERE o.status = 'paid'
          AND NOT EXISTS (
            SELECT 1 FROM bongsim_fulfillment_job j WHERE j.order_id = o.order_id AND j.status = 'delivered'
          )
       ON CONFLICT (dedupe_key) DO NOTHING`,
    );
    await pool.query(
      `UPDATE bongsim_outbox
          SET locked_at = NULL, available_at = now()
        WHERE topic = 'OrderPaid'
          AND processed_at IS NULL`,
    );
    console.log("outbox (re)enqueue rows:", ins.rowCount);
  } else {
    await pool.query(
      `INSERT INTO bongsim_outbox (topic, payload, dedupe_key)
       VALUES ('OrderPaid', $1::jsonb, $2)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [JSON.stringify({ order_id: arg }), `bongsim:order_paid:${arg}`],
    );
    await pool.query(
      `UPDATE bongsim_outbox
          SET locked_at = NULL, available_at = now()
        WHERE topic = 'OrderPaid'
          AND processed_at IS NULL
          AND payload->>'order_id' = $1`,
      [arg],
    );
    console.log("outbox enqueued for", arg);
  }

  await drainOrderPaidOutboxBestEffort(16);
  if (arg !== "--all-pending") {
    await maybeDeliverEsimAfterFulfillment(arg);
    await pool.query(
      `UPDATE bongsim_outbox
          SET locked_at = NULL, available_at = now()
        WHERE topic = 'EsimQrNotify'
          AND processed_at IS NULL
          AND payload::text LIKE '%' || $1 || '%'`,
      [arg],
    );
    const notify = await drainEsimQrNotifyOutboxBestEffort(8);
    console.log("esim_qr_notify", notify);
  } else {
    const paid = await pool.query<{ order_id: string }>(
      `SELECT order_id FROM bongsim_order WHERE status = 'paid' ORDER BY paid_at DESC NULLS LAST LIMIT 20`,
    );
    for (const r of paid.rows) {
      await maybeDeliverEsimAfterFulfillment(r.order_id);
    }
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
