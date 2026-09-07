/**
 * Re-queue or immediately send Solapi LMS for delivered simplyur eSIM orders.
 * Does not print phone numbers or emails.
 *
 *   npx tsx scripts/resend-simplyur-esim-sms.ts --dry-run
 *   npx tsx scripts/resend-simplyur-esim-sms.ts --send-now
 *   npx tsx scripts/resend-simplyur-esim-sms.ts --order SU-...
 */
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local" });
else if (existsSync(".env")) loadDotenv({ path: ".env" });

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i < 0) return null;
  return process.argv[i + 1]?.trim() || null;
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  const onlyOrder = argValue("--order");
  const sendNow = process.argv.includes("--send-now");
  const dryRun = process.argv.includes("--dry-run");
  const stripped = url.replace(/[?&]sslmode=[^&]*/gi, "").replace(/\?&/, "?").replace(/[?&]$/, "");
  const local = /localhost|127\.0\.0\.1/.test(stripped);
  const c = new Client({
    connectionString: stripped,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    const rows = await c.query<{
      order_id: string;
      order_number: string;
      buyer_email: string;
      buyer_tel: string | null;
      consents: unknown;
      topup_row_id: string;
      qr_code_img_url: string | null;
      download_link: string | null;
      unit_index: string;
      unit_total: string;
    }>(
      `SELECT o.order_id::text,
              o.order_number,
              o.buyer_email,
              o.buyer_tel,
              o.consents,
              t.topup_row_id::text,
              t.qr_code_img_url,
              t.download_link,
              (row_number() OVER (PARTITION BY o.order_id ORDER BY t.created_at ASC))::text AS unit_index,
              (count(*) OVER (PARTITION BY o.order_id))::text AS unit_total
         FROM bongsim_order o
         JOIN bongsim_fulfillment_topup t ON t.order_id = o.order_id
        WHERE o.checkout_channel LIKE 'simplyur%'
          AND o.status = 'delivered'
          AND COALESCE(o.buyer_tel, '') <> ''
          AND t.status NOT IN ('canceled', 'failed')
          AND COALESCE(t.qr_code_img_url, '') <> ''
          AND COALESCE(t.download_link, '') <> ''
          AND ($1::text IS NULL OR o.order_number = $1 OR o.order_id::text = $1)
        ORDER BY o.updated_at DESC`,
      [onlyOrder],
    );

    if (dryRun) {
      console.log(
        JSON.stringify({
          matched: rows.rowCount ?? rows.rows.length,
          dry_run: true,
          order_filter: onlyOrder ?? "all_delivered_simplyur_with_phone",
        }),
      );
      return;
    }

    const { formatEsimNotifyOrderLabel } = await import("@/lib/bongsim/esim-install-presentation");
    const { enqueueEsimQrNotify, kickEsimQrNotifyDrain } = await import(
      "@/lib/bongsim/fulfillment/esim-qr-notify-outbox"
    );
    const { buildSimplyurEsimQrDeliveredLmsText } = await import("@/lib/bongsim/notifications/esim-qr-lms");
    const { sendEsimQrDeliveredLmsFallback } = await import("@/lib/notification-service");
    const { buildSimplyurMyEsimAbsoluteUrl, simplyurLocaleFromConsents } = await import(
      "@/lib/simplyur/notify/simplyur-qr-notify-policy"
    );

    let queued = 0;
    let sent = 0;
    let failed = 0;
    for (const row of rows.rows) {
      const payload = {
        order_id: row.order_id,
        order_number: row.order_number,
        delivery_email: row.buyer_email,
        delivery_phone: row.buyer_tel,
        qr_code_url: row.qr_code_img_url ?? "",
        download_link: row.download_link ?? "",
        topup_row_id: row.topup_row_id,
        unit_index: Number.parseInt(row.unit_index, 10) || 1,
        unit_total: Number.parseInt(row.unit_total, 10) || 1,
      };
      if (sendNow) {
        const orderLabel = formatEsimNotifyOrderLabel(
          payload.order_number,
          payload.unit_index,
          payload.unit_total,
        );
        const orderPageUrl = buildSimplyurMyEsimAbsoluteUrl(simplyurLocaleFromConsents(row.consents));
        const lms = await sendEsimQrDeliveredLmsFallback({
          orderId: payload.order_id,
          customerPhone: payload.delivery_phone ?? "",
          orderNumber: orderLabel,
          orderPageUrl,
          downloadLink: payload.download_link,
          text: buildSimplyurEsimQrDeliveredLmsText({
            orderNumber: orderLabel,
            orderPageUrl,
            downloadLink: payload.download_link,
          }),
        });
        if (lms.ok) sent += 1;
        else failed += 1;
        continue;
      }
      const r = await enqueueEsimQrNotify(payload, { forceResend: true });
      if (r.enqueued) queued += 1;
    }
    if (!sendNow) kickEsimQrNotifyDrain();
    console.log(
      JSON.stringify({
        matched: rows.rowCount ?? rows.rows.length,
        queued,
        sent,
        failed,
        send_now: sendNow,
        order_filter: onlyOrder ?? "all_delivered_simplyur_with_phone",
      }),
    );
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? `${e.name}: ${e.message}` : e);
  process.exit(1);
});
