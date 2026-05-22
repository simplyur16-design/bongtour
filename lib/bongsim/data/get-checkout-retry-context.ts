import { getPgPool } from "@/lib/bongsim/db/pool";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CheckoutRetryContext = {
  order_id: string;
  order_number: string;
  option_api_id: string;
  quantity: number;
  buyer_email: string;
  grand_total_krw: number;
};

export type GetCheckoutRetryContextResult =
  | { ok: true; context: CheckoutRetryContext }
  | { ok: false; reason: "db_unconfigured" | "invalid_order_id" | "not_found" | "not_payable" };

export async function getCheckoutRetryContext(orderIdRaw: string): Promise<GetCheckoutRetryContextResult> {
  const orderId = orderIdRaw.trim();
  if (!UUID_RE.test(orderId)) return { ok: false, reason: "invalid_order_id" };

  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const client = await pool.connect();
  try {
    const o = await client.query<{
      order_id: string;
      order_number: string;
      status: string;
      buyer_email: string;
      grand_total_krw: string;
    }>(
      `SELECT order_id, order_number, status, buyer_email, grand_total_krw::text AS grand_total_krw
       FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
      [orderId],
    );
    const order = o.rows[0];
    if (!order) return { ok: false, reason: "not_found" };
    if (order.status !== "awaiting_payment") return { ok: false, reason: "not_payable" };

    const line = await client.query<{ option_api_id: string; quantity: string }>(
      `SELECT option_api_id, quantity::text AS quantity
       FROM bongsim_order_line
       WHERE order_id = $1::uuid
       ORDER BY created_at ASC
       LIMIT 1`,
      [orderId],
    );
    const row = line.rows[0];
    if (!row?.option_api_id?.trim()) return { ok: false, reason: "not_found" };

    const quantity = Number.parseInt(row.quantity, 10);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      return { ok: false, reason: "not_found" };
    }

    const grand = Number.parseInt(order.grand_total_krw, 10);
    return {
      ok: true,
      context: {
        order_id: order.order_id,
        order_number: order.order_number,
        option_api_id: row.option_api_id.trim(),
        quantity,
        buyer_email: order.buyer_email.trim(),
        grand_total_krw: Number.isFinite(grand) ? grand : 0,
      },
    };
  } finally {
    client.release();
  }
}
