import { getBongsimFulfillOutboxPool, getPgPool } from "@/lib/bongsim/db/pool";
import { resolveEsimDeliveryContact } from "@/lib/bongsim/checkout/gift-order";
import { resolveBuyerPhoneForOrder } from "@/lib/bongsim/data/resolve-buyer-phone";
import {
  buildBongsimOrderCompleteUrl,
  formatEsimNotifyOrderLabel,
} from "@/lib/bongsim/esim-install-presentation";
import { sendTravelEsimOrderQrMail } from "@/lib/bongsim/email/travel-esim-order-qr-mail";
import { sendSimplyurEsimQrMail } from "@/lib/simplyur/email/simplyur-esim-qr-mail";
import {
  buildSimplyurMyEsimAbsoluteUrl,
  simplyurLocaleFromConsents,
  simplyurNotifyRequiresKakaoPhone,
} from "@/lib/simplyur/notify/simplyur-qr-notify-policy";
import { pickPrimaryVerificationIccid } from "@/lib/bongsim/esim/iccid-verification";
import {
  enqueueEsimQrNotify,
  kickEsimQrNotifyDrain,
  esimQrNotifyDedupeKey,
  ESIM_QR_NOTIFY_TOPIC,
  type EsimQrNotifyPayload,
} from "@/lib/bongsim/fulfillment/esim-qr-notify-outbox";
import { sendEsimQrDeliveredAlimTalk } from "@/lib/bongsim/notifications/esim-qr-alimtalk";
import { shouldSendBongtourEsimOsQuickInstallLms } from "@/lib/bongsim/notifications/esim-qr-lms";
import { isBongsimCheckoutTestMode } from "@/lib/bongsim/test-mode";
import { sendEsimQrDeliveredLmsFallback } from "@/lib/notification-service";

/**
 * 결제 완료 → 공급사 발급 → QR 확보 후 고객 전달(이메일·알림톡).
 * 알림톡은 EsimQrNotify outbox로 순차 발송 (버스트 누락 방지).
 * REGRESSION-FREEZE[bongsim-esim-qr-notify-serialize]: deliver enqueues notify — manifest
 */

export type DeliverEsimToCustomerResult =
  | { ok: true; status: "delivered" }
  | {
      ok: true;
      status: "skipped";
      reason: "already_delivered" | "order_not_found" | "invalid_transition";
    }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

async function fetchTopupManualCredentials(
  orderId: string,
  topupRowId?: string | null,
): Promise<{
  smdp: string | null;
  activate_code: string | null;
  travelerVerificationIccid: string | null;
}> {
  const pool = getPgPool();
  if (!pool) return { smdp: null, activate_code: null, travelerVerificationIccid: null };
  try {
    const tid = (topupRowId ?? "").trim();
    const r = tid
      ? await pool.query<{ smdp: string | null; activate_code: string | null }>(
          `SELECT smdp, activate_code
             FROM bongsim_fulfillment_topup
            WHERE order_id = $1::uuid AND topup_row_id = $2::uuid
            LIMIT 1`,
          [orderId, tid],
        )
      : await pool.query<{ smdp: string | null; activate_code: string | null }>(
          `SELECT smdp, activate_code
             FROM bongsim_fulfillment_topup
            WHERE order_id = $1::uuid
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1`,
          [orderId],
        );
    const row = r.rows[0];

    const iccidRows = await pool.query<{ iccid: string | null }>(
      `SELECT iccid
         FROM bongsim_fulfillment_topup
        WHERE order_id = $1::uuid
        ORDER BY created_at ASC`,
      [orderId],
    );
    const travelerVerificationIccid = pickPrimaryVerificationIccid(iccidRows.rows);

    return {
      smdp: row?.smdp?.trim() || null,
      activate_code: row?.activate_code?.trim() || null,
      travelerVerificationIccid,
    };
  } catch {
    return { smdp: null, activate_code: null, travelerVerificationIccid: null };
  }
}

async function sendEsimQrEmailBestEffort(params: {
  buyerEmail: string;
  orderNumber: string;
  orderPageUrl: string;
  qrCodeUrl: string;
  downloadLink: string;
  smdp: string | null;
  activate_code: string | null;
  travelerVerificationIccid: string | null;
}): Promise<void> {
  const send = await sendTravelEsimOrderQrMail({
    to: params.buyerEmail,
    orderNumber: params.orderNumber,
    orderPageUrl: params.orderPageUrl,
    qrCodeUrl: params.qrCodeUrl,
    downloadLink: params.downloadLink,
    smDpPlusAddress: params.smdp,
    activationCode: params.activate_code,
    travelerVerificationIccid: params.travelerVerificationIccid ?? undefined,
  });
  if (!send.ok) {
    console.warn("[bongsim:email:esim-qr]", send.error, { orderNumber: params.orderNumber });
  }
}

/**
 * outbox worker 전용 — 알림톡 실패(+LMS 실패) 시 throw → 재시도.
 */
export async function sendQueuedEsimQrCustomerNotify(payload: EsimQrNotifyPayload): Promise<void> {
  const orderId = payload.order_id;
  const pool = getBongsimFulfillOutboxPool() ?? getPgPool();
  const channelRow = pool
    ? await pool.query<{ checkout_channel: string | null; consents: unknown }>(
        `SELECT checkout_channel, consents FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
        [orderId],
      )
    : { rows: [] as Array<{ checkout_channel: string | null; consents: unknown }> };
  const checkoutChannel = channelRow.rows[0]?.checkout_channel ?? null;
  const simplyurLocale = simplyurLocaleFromConsents(channelRow.rows[0]?.consents);
  const requireKakaoPhone = simplyurNotifyRequiresKakaoPhone(checkoutChannel);
  const orderPageUrl = requireKakaoPhone
    ? buildBongsimOrderCompleteUrl(orderId)
    : buildSimplyurMyEsimAbsoluteUrl(simplyurLocale);
  const phone = payload.delivery_phone ?? (await resolveBuyerPhoneForOrder(orderId));
  const { smdp, activate_code, travelerVerificationIccid } = await fetchTopupManualCredentials(
    orderId,
    payload.topup_row_id,
  );

  let phoneNotifyOk = !requireKakaoPhone || !phone;
  const orderLabel = formatEsimNotifyOrderLabel(
    payload.order_number,
    payload.unit_index,
    payload.unit_total,
  );
  // REGRESSION-FREEZE[simplyur-esim-delivery-install]: simplyur skips Kakao; email + install links — manifest

  if (requireKakaoPhone && phone) {
    const lmsPayload = {
      orderId,
      customerPhone: phone,
      orderNumber: orderLabel,
      orderPageUrl,
      downloadLink: payload.download_link,
    };
    // REGRESSION-FREEZE[bongsim-esim-qr-os-install-lms-always]: LPA면 원클릭 LMS 필수 — manifest
    if (shouldSendBongtourEsimOsQuickInstallLms(checkoutChannel, payload.download_link)) {
      const lms = await sendEsimQrDeliveredLmsFallback(lmsPayload);
      if (!lms.ok) {
        throw new Error(`[bongsim:esim-qr-notify] os_install_lms_failed order=${orderId}`);
      }
      phoneNotifyOk = true;
      const alim = await sendEsimQrDeliveredAlimTalk(orderId, {
        customerPhone: phone,
        orderNumber: orderLabel,
        orderPageUrl,
      });
      if (!alim.ok) {
        console.warn("[bongsim:alimtalk:esim-qr] companion_failed_after_os_lms", {
          orderId,
          detail: alim.detail,
        });
      }
    } else {
      const alim = await sendEsimQrDeliveredAlimTalk(orderId, {
        customerPhone: phone,
        orderNumber: orderLabel,
        orderPageUrl,
      });
      if (alim.ok) {
        phoneNotifyOk = true;
      } else if (alim.shouldSendLmsFallback) {
        // REGRESSION-FREEZE[bongsim-esim-lms-quick-install]: AlimTalk 실패 시에만 LMS — manifest
        const lms = await sendEsimQrDeliveredLmsFallback(lmsPayload);
        phoneNotifyOk = Boolean(lms.ok);
      }
    }
  } else if (requireKakaoPhone) {
    console.warn("[bongsim:alimtalk:esim-qr] no_phone", { orderId });
  }

  if (payload.delivery_email) {
    if (!requireKakaoPhone) {
      const send = await sendSimplyurEsimQrMail({
        to: payload.delivery_email,
        orderNumber: orderLabel,
        qrCodeUrl: payload.qr_code_url,
        downloadLink: payload.download_link,
        smDpPlusAddress: smdp,
        activationCode: activate_code,
        myEsimUrl: orderPageUrl,
      });
      if (!send.ok) {
        throw new Error(`[simplyur:esim-qr-mail] ${send.error} order=${orderId}`);
      }
    } else {
      await sendEsimQrEmailBestEffort({
        buyerEmail: payload.delivery_email,
        orderNumber: orderLabel,
        orderPageUrl,
        qrCodeUrl: payload.qr_code_url,
        downloadLink: payload.download_link,
        smdp,
        activate_code,
        travelerVerificationIccid,
      });
    }
  }

  if (!requireKakaoPhone && !payload.delivery_email) {
    throw new Error(`[simplyur:esim-qr-mail] missing_email order=${orderId}`);
  }

  if (!phoneNotifyOk) {
    throw new Error(`[bongsim:esim-qr-notify] phone_notify_failed order=${orderId}`);
  }
}

/**
 * USIMSA 웹훅에서 QR·다운로드 링크를 확보한 뒤 호출한다.
 * - `bongsim_order`: `paid` → `delivered` (멱등: 이미 delivered면 skip)
 * - 이메일·알림톡: topup별 EsimQrNotify enqueue (qty>1 → N건)
 */
export async function deliverEsimToCustomer(
  orderId: string,
  qrCodeUrl: string,
  downloadLink: string,
  opts?: { topup_row_id?: string | null },
): Promise<DeliverEsimToCustomerResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const client = await pool.connect();
  let deliveryEmail = "";
  let deliveryPhone: string | null = null;
  let orderNumber = "";
  let result: DeliverEsimToCustomerResult = { ok: true, status: "delivered" };
  try {
    await client.query("BEGIN");
    const r = await client.query<{
      status: string;
      buyer_email: string;
      buyer_tel: string | null;
      order_number: string;
      consents: unknown;
    }>(
      `SELECT status, buyer_email, buyer_tel, order_number, consents
         FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [orderId],
    );
    const row = r.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: true, status: "skipped", reason: "order_not_found" };
    }
    const contact = resolveEsimDeliveryContact({
      buyer_email: row.buyer_email,
      buyer_tel: row.buyer_tel,
      consents: row.consents,
    });
    deliveryEmail = contact.email;
    deliveryPhone = contact.phone;
    orderNumber = row.order_number;
    if (row.status === "delivered") {
      await client.query("ROLLBACK");
      result = { ok: true, status: "skipped", reason: "already_delivered" };
    } else if (row.status !== "paid") {
      await client.query("ROLLBACK");
      return { ok: true, status: "skipped", reason: "invalid_transition" };
    } else {
      await client.query(
        `UPDATE bongsim_order SET status = 'delivered', updated_at = now() WHERE order_id = $1::uuid`,
        [orderId],
      );
      await client.query("COMMIT");
      result = { ok: true, status: "delivered" };
    }
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, reason: "db_error" };
  } finally {
    client.release();
  }

  const shouldEnqueueNotify =
    result.ok &&
    (result.status === "delivered" ||
      (result.status === "skipped" && result.reason === "already_delivered"));

  if (!isBongsimCheckoutTestMode() && shouldEnqueueNotify) {
    const q = qrCodeUrl.trim();
    const d = downloadLink.trim();
    if (q && d) {
      const topupRowId = (opts?.topup_row_id ?? "").trim() || null;
      // already_delivered 재진입: 해당 topup 알림이 이미 성공 처리면 재큐/킥 스킵 (이중 발송·레이스 축소)
      if (result.status === "skipped" && result.reason === "already_delivered") {
        const dedupe = esimQrNotifyDedupeKey(orderId, topupRowId);
        const existing = await pool.query<{ processed_at: Date | null }>(
          `SELECT processed_at FROM bongsim_outbox
            WHERE topic = $1 AND dedupe_key = $2
            LIMIT 1`,
          [ESIM_QR_NOTIFY_TOPIC, dedupe],
        );
        if (existing.rows[0]?.processed_at) {
          return result;
        }
      }
      let unit_index: number | null = null;
      let unit_total: number | null = null;
      if (topupRowId) {
        const units = await pool.query<{ topup_row_id: string }>(
          `SELECT topup_row_id::text AS topup_row_id
             FROM bongsim_fulfillment_topup
            WHERE order_id = $1::uuid
              AND status NOT IN ('canceled', 'failed')
            ORDER BY created_at ASC`,
          [orderId],
        );
        unit_total = units.rows.length;
        const idx = units.rows.findIndex((r) => r.topup_row_id === topupRowId);
        unit_index = idx >= 0 ? idx + 1 : null;
      }
      await enqueueEsimQrNotify({
        order_id: orderId,
        order_number: orderNumber,
        delivery_email: deliveryEmail,
        delivery_phone: deliveryPhone,
        qr_code_url: q,
        download_link: d,
        topup_row_id: topupRowId,
        unit_index,
        unit_total,
      });
      kickEsimQrNotifyDrain();
    }
  }

  return result;
}

/**
 * mock 공급사 등 웹훅 없이 job만 `delivered` 된 경우, topup/ job에서 QR·링크를 모아 고객 전달을 시도한다.
 */
export async function maybeDeliverEsimAfterFulfillment(orderId: string): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;

  const o = await pool.query<{ status: string; order_number: string }>(
    `SELECT status, order_number FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
    [orderId],
  );
  const order = o.rows[0];
  if (!order || (order.status !== "paid" && order.status !== "delivered")) return;

  const j = await pool.query<{ status: string; supplier_id: string | null; supplier_iccid: string | null }>(
    `SELECT status, supplier_id, supplier_iccid
       FROM bongsim_fulfillment_job
      WHERE order_id = $1
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1`,
    [orderId],
  );
  const job = j.rows[0];
  if (!job || job.status !== "delivered") return;

  const t = await pool.query<{
    topup_row_id: string;
    qr_code_img_url: string | null;
    download_link: string | null;
  }>(
    `SELECT topup_row_id::text AS topup_row_id, qr_code_img_url, download_link
       FROM bongsim_fulfillment_topup
      WHERE order_id = $1
        AND status NOT IN ('canceled', 'failed')
        AND (
          COALESCE(qr_code_img_url, '') <> ''
          OR COALESCE(download_link, '') <> ''
        )
      ORDER BY created_at ASC`,
    [orderId],
  );

  if (t.rows.length === 0 && job.supplier_id === "bongsim_mock_supplier") {
    const iccid = job.supplier_iccid?.trim() || "mock";
    const qr = `https://bongtour.com/travel/esim/mock-qr?order=${encodeURIComponent(order.order_number)}`;
    const dl = `LPA:1$mock.bongtour$${iccid}`;
    await deliverEsimToCustomer(orderId, qr, dl);
    return;
  }

  for (const topup of t.rows) {
    let qr = topup.qr_code_img_url?.trim() ?? "";
    let dl = topup.download_link?.trim() ?? "";
    if ((!qr || !dl) && job.supplier_id === "bongsim_mock_supplier") {
      const iccid = job.supplier_iccid?.trim() || "mock";
      qr = qr || `https://bongtour.com/travel/esim/mock-qr?order=${encodeURIComponent(order.order_number)}`;
      dl = dl || `LPA:1$mock.bongtour$${iccid}`;
    }
    if (!qr || !dl) continue;
    await deliverEsimToCustomer(orderId, qr, dl, { topup_row_id: topup.topup_row_id });
  }
}
