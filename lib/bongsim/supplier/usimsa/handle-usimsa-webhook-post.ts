import { NextResponse } from "next/server";

import { deliverEsimToCustomer } from "@/lib/bongsim/fulfillment/esim-delivery";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
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

/**
 * USIMSA Partner API 웹훅 공통 처리.
 * IP 화이트리스트 → `handleUsimsaWebhook` → QR·다운로드 링크 확보 시 `deliverEsimToCustomer`.
 * `/api/bongsim/webhooks/usimsa` · 레거시 `/api/usimsa/webhook` 모두 이 함수를 사용한다.
 */
export async function handleUsimsaWebhookPost(
  req: Request,
  logPrefix: string,
  leakGuardContext: string,
): Promise<NextResponse> {
  const clientIp = extractClientIp(req.headers);
  const allowed = getAllowedUsimsaWebhookIps();

  if (!isAllowedUsimsaIp(clientIp, allowed)) {
    console.warn(`[${logPrefix}] ip blocked`, { clientIp, allowed });
    return jsonWithLeakGuard({ ok: false, error: "forbidden" }, leakGuardContext, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.warn(`[${logPrefix}] invalid json`, { clientIp });
    return jsonWithLeakGuard({ ok: true, note: "invalid_json_swallowed" }, leakGuardContext, { status: 200 });
  }

  const payload = normalizeUsimsaWebhookPayload(body);

  let handleResult;
  try {
    handleResult = await handleUsimsaWebhook(body);
  } catch (e) {
    console.error(`[${logPrefix}] handleUsimsaWebhook threw`, {
      clientIp,
      error: e instanceof Error ? e.message : String(e),
    });
    return jsonWithLeakGuard({ ok: true, note: "error_swallowed" }, leakGuardContext, { status: 200 });
  }

  if (handleResult.outcome !== "applied" || !payload) {
    return jsonWithLeakGuard({ ok: true, handle: handleResult }, leakGuardContext, { status: 200 });
  }

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard(
      { ok: true, handle: handleResult, delivery: "skipped_db_unconfigured" },
      leakGuardContext,
      { status: 200 },
    );
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
    return jsonWithLeakGuard(
      { ok: true, handle: handleResult, delivery: "missing_topup_row" },
      leakGuardContext,
      { status: 200 },
    );
  }

  const qr =
    normalizeUsimsaQrCodeImgUrl(payload) ?? (topup.qr_code_img_url?.trim() || "");
  const dl = (payload.downloadLink?.trim() || topup.download_link?.trim() || "");
  if (!qr || !dl) {
    return jsonWithLeakGuard(
      { ok: true, handle: handleResult, delivery: "awaiting_qr_or_download_link" },
      leakGuardContext,
      { status: 200 },
    );
  }

  const delivery = await deliverEsimToCustomer(topup.order_id, qr, dl, {
    topup_row_id: handleResult.topup_row_id,
  });
  return jsonWithLeakGuard({ ok: true, handle: handleResult, delivery }, leakGuardContext, { status: 200 });
}
