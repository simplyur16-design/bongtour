/**
 * EsimQrNotify 1건을 풀 없이 바로 솔라피 발송 후 processed 표시.
 *
 *   npx tsx scripts/ops-send-one-esim-qr-notify.ts eb95ff15-fda1-4401-b97d-023dfb5d962a
 */
import Module from "node:module";
import { register } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";

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

if (existsSync(".env.local")) loadDotenv({ path: ".env.local", override: true });

async function main() {
  const orderId = process.argv[2]?.trim();
  if (!orderId) {
    console.error("usage: npx tsx scripts/ops-send-one-esim-qr-notify.ts <order_id>");
    process.exit(1);
  }
  const raw = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DIRECT_URL/DATABASE_URL missing");
  const url = raw.replace(/[?&]sslmode=[^&]*/gi, "").replace(/\?&/, "?").replace(/[?&]$/, "");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const row = await c.query<{ id: string; payload: unknown; processed: boolean }>(
      `SELECT id::text,
              payload,
              (processed_at IS NOT NULL) AS processed
         FROM bongsim_outbox
        WHERE topic = 'EsimQrNotify'
          AND payload::text LIKE '%' || $1 || '%'
        ORDER BY processed_at NULLS FIRST
        LIMIT 1`,
      [orderId],
    );
    const hit = row.rows[0];
    if (!hit) {
      console.log(JSON.stringify({ ok: false, reason: "notify_row_missing" }));
      return;
    }
    if (hit.processed) {
      console.log(JSON.stringify({ ok: true, already_processed: true }));
      return;
    }
    const { sendQueuedEsimQrCustomerNotify } = await import("../lib/bongsim/fulfillment/esim-delivery");
    const payload = hit.payload as {
      order_id: string;
      order_number: string;
      delivery_email: string;
      delivery_phone: string | null;
      qr_code_url: string;
      download_link: string;
      topup_row_id?: string | null;
      unit_index?: number | null;
      unit_total?: number | null;
    };
    await sendQueuedEsimQrCustomerNotify(payload);
    await c.query(`UPDATE bongsim_outbox SET processed_at = now(), locked_at = now() WHERE id = $1::uuid`, [
      hit.id,
    ]);
    console.log(JSON.stringify({ ok: true, sent: true, has_phone: Boolean(payload.delivery_phone) }));
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
