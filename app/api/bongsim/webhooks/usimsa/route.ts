import { NextResponse } from "next/server";
import { deliverEsimToCustomer } from "@/lib/bongsim/fulfillment/esim-delivery";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  extractClientIp,
  getAllowedUsimsaWebhookIps,
  isAllowedUsimsaIp,
} from "@/lib/bongsim/supplier/usimsa/allowed-ips";
import {
  handleUsimsaWebhook,
  normalizeUsimsaWebhookPayload,
  normalizeUsimsaQrCodeImgUrl,
} from "@/lib/bongsim/supplier/usimsa/webhook-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * USIMSA Partner API 웹훅 (봉심 경로).
 * IP: `lib/bongsim/supplier/usimsa/allowed-ips.ts` — 운영 20.39.205.201, 개발 20.196.102.185 (또는 USIMSA_WEBHOOK_ALLOWED_IPS).
 *
 * 흐름: 기존 `handleUsimsaWebhook`으로 `bongsim_fulfillment_topup` 반영 후,
 * QR·다운로드 링크가 있으면 `deliverEsimToCustomer`로 주문 `delivered` + 알림 placeholder.
 */
export async function POST(req: Request) {
  const clientIp = extractClientIp(req.headers);
  const allowed = getAllowedUsimsaWebhookIps();

  if (!isAllowedUsimsaIp(clientIp, allowed)) {
    console.warn("[bongsim:webhooks:usimsa] ip blocked", { clientIp, allowed });
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.warn("[bongsim:webhooks:usimsa] invalid json", { clientIp });
    return NextResponse.json({ ok: true, note: "invalid_json_swallowed" }, { status: 200 });
  }

  const payload = normalizeUsimsaWebhookPayload(body);

  let handleResult;
  try {
    handleResult = await handleUsimsaWebhook(body);
  } catch (e) {
    console.error("[bongsim:webhooks:usimsa] handleUsimsaWebhook threw", {
      clientIp,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: true, note: "error_swallowed" }, { status: 200 });
  }

  if (handleResult.outcome !== "applied" || !payload) {
    return NextResponse.json({ ok: true, handle: handleResult }, { status: 200 });
  }

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json({ ok: true, handle: handleResult, delivery: "skipped_db_unconfigured" }, { status: 200 });
  }

  const tr = await pool.query<{
    order_id: string;
    qr_code_img_url: string | null;
    download_link: string | null;
  }>(
    `SELECT order_id, qr_code_img_url, download_link
       FROM bongsim_fulfillment_topup
      WHERE topup_row_id = $1::uuid`,
    [handleResult.topup_row_id],
  );
  const topup = tr.rows[0];
  if (!topup) {
    return NextResponse.json({ ok: true, handle: handleResult, delivery: "missing_topup_row" }, { status: 200 });
  }

  const qr =
    normalizeUsimsaQrCodeImgUrl(payload) ?? (topup.qr_code_img_url?.trim() || "");
  const dl = (payload.downloadLink?.trim() || topup.download_link?.trim() || "");
  if (!qr || !dl) {
    return NextResponse.json(
      { ok: true, handle: handleResult, delivery: "awaiting_qr_or_download_link" },
      { status: 200 },
    );
  }

  const delivery = await deliverEsimToCustomer(topup.order_id, qr, dl);
  return NextResponse.json({ ok: true, handle: handleResult, delivery }, { status: 200 });
}
