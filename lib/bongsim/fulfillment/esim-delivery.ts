import { getPgPool } from "@/lib/bongsim/db/pool";
import { sendTravelEsimOrderQrMail } from "@/lib/bongsim/email/travel-esim-order-qr-mail";
import { isBongsimCheckoutTestMode } from "@/lib/bongsim/test-mode";

/**
 * 결제 완료 → 공급사 발급 → QR 확보 후 고객 전달(이메일·알림톡).
 */

export type DeliverEsimToCustomerResult =
  | { ok: true; status: "delivered" }
  | {
      ok: true;
      status: "skipped";
      reason: "already_delivered" | "order_not_found" | "invalid_transition";
    }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

async function sendEsimQrEmailBestEffort(params: {
  buyerEmail: string;
  orderNumber: string;
  qrCodeUrl: string;
  downloadLink: string;
}): Promise<void> {
  const send = await sendTravelEsimOrderQrMail({
    to: params.buyerEmail,
    orderNumber: params.orderNumber,
    qrCodeUrl: params.qrCodeUrl,
    downloadLink: params.downloadLink,
  });
  if (!send.ok) {
    console.warn("[bongsim:email:esim-qr]", send.error, { orderNumber: params.orderNumber });
  }
}

/** 추후 Solapi 알림톡 등으로 교체. */
function placeholderSendEsimAlimtalk(params: {
  buyerEmail: string;
  orderId: string;
  qrCodeUrl: string;
  downloadLink: string;
}): void {
  console.info("[bongsim:alimtalk:placeholder] eSIM QR 카카오 알림톡 발송 예정", params);
}

/**
 * USIMSA 웹훅에서 QR·다운로드 링크를 확보한 뒤 호출한다.
 * - `bongsim_order`: `paid` → `delivered` (멱등: 이미 delivered면 skip)
 * - 이메일·알림톡: 트랜잭션 커밋 후 best-effort placeholder
 */
export async function deliverEsimToCustomer(
  orderId: string,
  qrCodeUrl: string,
  downloadLink: string,
): Promise<DeliverEsimToCustomerResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const client = await pool.connect();
  let buyerEmail = "";
  let orderNumber = "";
  try {
    await client.query("BEGIN");
    const r = await client.query<{ status: string; buyer_email: string; order_number: string }>(
      `SELECT status, buyer_email, order_number FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [orderId],
    );
    const row = r.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: true, status: "skipped", reason: "order_not_found" };
    }
    buyerEmail = row.buyer_email;
    orderNumber = row.order_number;
    if (row.status === "delivered") {
      await client.query("ROLLBACK");
      return { ok: true, status: "skipped", reason: "already_delivered" };
    }
    if (row.status !== "paid") {
      await client.query("ROLLBACK");
      return { ok: true, status: "skipped", reason: "invalid_transition" };
    }

    await client.query(
      `UPDATE bongsim_order SET status = 'delivered', updated_at = now() WHERE order_id = $1::uuid`,
      [orderId],
    );
    await client.query("COMMIT");
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

  if (!isBongsimCheckoutTestMode()) {
    await sendEsimQrEmailBestEffort({
      buyerEmail,
      orderNumber,
      qrCodeUrl,
      downloadLink,
    });
    placeholderSendEsimAlimtalk({ buyerEmail, orderId, qrCodeUrl, downloadLink });
  }

  return { ok: true, status: "delivered" };
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
  if (!order || order.status !== "paid") return;

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

  const t = await pool.query<{ qr_code_img_url: string | null; download_link: string | null }>(
    `SELECT qr_code_img_url, download_link
       FROM bongsim_fulfillment_topup
      WHERE order_id = $1
        AND (COALESCE(qr_code_img_url, '') <> '' OR COALESCE(download_link, '') <> '')
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1`,
    [orderId],
  );
  const topup = t.rows[0];
  let qr = topup?.qr_code_img_url?.trim() ?? "";
  let dl = topup?.download_link?.trim() ?? "";

  if ((!qr || !dl) && job.supplier_id === "bongsim_mock_supplier") {
    const iccid = job.supplier_iccid?.trim() || "mock";
    qr = qr || `https://bongtour.com/travel/esim/mock-qr?order=${encodeURIComponent(order.order_number)}`;
    dl = dl || `LPA:1$mock.bongtour$${iccid}`;
  }

  if (!qr || !dl) return;

  await deliverEsimToCustomer(orderId, qr, dl);
}
