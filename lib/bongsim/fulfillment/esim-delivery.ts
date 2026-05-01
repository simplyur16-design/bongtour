import { getPgPool } from "@/lib/bongsim/db/pool";

/**
 * 결제 완료 → USIMSA 발급 → 웹훅으로 QR 수신 후 고객 전달(이메일·알림톡) 단계의 진입점.
 * 현재는 DB 상태만 반영하고, 메일·알림톡은 placeholder.
 */

export type DeliverEsimToCustomerResult =
  | { ok: true; status: "delivered" }
  | {
      ok: true;
      status: "skipped";
      reason: "already_delivered" | "order_not_found" | "invalid_transition";
    }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

/** 추후 nodemailer 등으로 교체. */
function placeholderSendEsimEmail(params: {
  buyerEmail: string;
  orderId: string;
  qrCodeUrl: string;
  downloadLink: string;
}): void {
  console.info("[bongsim:email:placeholder] eSIM QR 메일 발송 예정", params);
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
  try {
    await client.query("BEGIN");
    const r = await client.query<{ status: string; buyer_email: string }>(
      `SELECT status, buyer_email FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [orderId],
    );
    const row = r.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: true, status: "skipped", reason: "order_not_found" };
    }
    buyerEmail = row.buyer_email;
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

  const notify = { buyerEmail, orderId, qrCodeUrl, downloadLink };
  placeholderSendEsimEmail(notify);
  placeholderSendEsimAlimtalk(notify);

  return { ok: true, status: "delivered" };
}
